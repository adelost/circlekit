package com.adelost.servicekit

import android.content.Context
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

interface ServiceClock {
    fun wallMs(): Long
    fun monotonicNs(): Long
}

object SystemServiceClock : ServiceClock {
    override fun wallMs(): Long = System.currentTimeMillis()
    override fun monotonicNs(): Long = System.nanoTime()
}

interface ServiceSnapshotStore {
    fun load(): List<ServiceSnapshot>
    fun save(snapshots: List<ServiceSnapshot>)
}

/**
 * One process-wide, data-only record of service work.
 *
 * Operations describe the user-visible fetch; transfers describe actual HTTP
 * traffic. Keeping both avoids calling a disk-cache hit a network request and
 * lets multi-request sources such as PMTiles report honest wire totals.
 */
class ServiceTelemetry(
    private val clock: ServiceClock = SystemServiceClock,
    private val eventCapacity: Int = DEFAULT_EVENT_CAPACITY,
) {
    private val _snapshots = MutableStateFlow<Map<ServiceId, ServiceSnapshot>>(emptyMap())
    val snapshots: StateFlow<Map<ServiceId, ServiceSnapshot>> = _snapshots.asStateFlow()

    private val _events = MutableStateFlow<List<ServiceEvent>>(emptyList())
    val events: StateFlow<List<ServiceEvent>> = _events.asStateFlow()

    private var store: ServiceSnapshotStore? = null

    init {
        require(eventCapacity > 0)
    }

    @Synchronized
    fun install(store: ServiceSnapshotStore) {
        if (this.store != null) return
        val restored = store.load().associateBy(ServiceSnapshot::serviceId)
        attach(store, restored)
    }

    /** Android storage is attached off the UI thread; live process events win. */
    suspend fun install(context: Context) = withContext(Dispatchers.IO) {
        val preferenceStore = PreferencesServiceSnapshotStore(context.applicationContext)
        val restored = preferenceStore.load().associateBy(ServiceSnapshot::serviceId)
        attach(preferenceStore, restored)
    }

    @Synchronized
    private fun attach(
        store: ServiceSnapshotStore,
        restored: Map<ServiceId, ServiceSnapshot>,
    ) {
        if (this.store != null) return
        this.store = store
        // Operations may have started while Android loaded preferences. Their
        // process-live counters and outcomes are newer than the disk snapshot.
        _snapshots.value = restored + _snapshots.value
    }

    fun beginOperation(serviceId: ServiceId): ServiceOperation {
        started(serviceId, ServiceEventKind.OPERATION)
        return ServiceOperation(
            telemetry = this,
            serviceId = serviceId,
            startedWallMs = clock.wallMs(),
            startedMonoNs = clock.monotonicNs(),
        )
    }

    fun beginTransfer(serviceId: ServiceId, kind: ServiceEventKind = ServiceEventKind.TRANSFER): ServiceTransfer {
        require(kind != ServiceEventKind.OPERATION)
        started(serviceId, kind)
        return ServiceTransfer(
            telemetry = this,
            serviceId = serviceId,
            kind = kind,
            startedWallMs = clock.wallMs(),
            startedMonoNs = clock.monotonicNs(),
        )
    }

    internal fun nowWallMs(): Long = clock.wallMs()

    internal fun elapsedMs(startedMonoNs: Long): Long =
        ((clock.monotonicNs() - startedMonoNs) / 1_000_000L).coerceAtLeast(0L)

    @Synchronized
    fun recordCache(serviceId: ServiceId, bytes: Long, itemCount: Int? = null) {
        require(bytes >= 0L)
        val current = _snapshots.value[serviceId] ?: ServiceSnapshot(serviceId)
        publish(
            current.copy(
                cache = ServiceCacheSummary(clock.wallMs(), bytes, itemCount),
            ),
        )
    }

    @Synchronized
    internal fun finish(event: ServiceEvent) {
        val current = _snapshots.value[event.serviceId] ?: ServiceSnapshot(event.serviceId)
        val next = when (event.kind) {
            ServiceEventKind.OPERATION -> current.copy(
                lastAttempt = ServiceAttemptSummary(
                    atMs = event.completedAtMs,
                    durationMs = event.durationMs,
                    outcome = event.outcome,
                    detail = event.detail,
                ),
                lastSuccessAtMs = event.completedAtMs
                    .takeIf { event.outcome == ServiceOutcome.SUCCESS }
                    ?: current.lastSuccessAtMs,
                attemptCount = current.attemptCount + 1L,
                activeOperations = (current.activeOperations - 1).coerceAtLeast(0),
            )
            ServiceEventKind.TRANSFER,
            ServiceEventKind.PROBE -> current.copy(
                lastTransfer = ServiceTransferSummary(
                    atMs = event.completedAtMs,
                    durationMs = event.durationMs,
                    downloadedBytes = event.downloadedBytes,
                    uploadedBytes = event.uploadedBytes,
                    httpCode = event.httpCode,
                    outcome = event.outcome,
                    detail = event.detail,
                ),
                lastSuccessAtMs = event.completedAtMs
                    .takeIf { event.outcome == ServiceOutcome.SUCCESS }
                    ?: current.lastSuccessAtMs,
                networkCallCount = current.networkCallCount + 1L,
                totalDownloadedBytes = current.totalDownloadedBytes + event.downloadedBytes,
                totalUploadedBytes = current.totalUploadedBytes + event.uploadedBytes,
                activeTransfers = (current.activeTransfers - 1).coerceAtLeast(0),
            )
        }
        val history = (_events.value + event).takeLast(eventCapacity)
        _events.value = history
        publish(next)
    }

    @Synchronized
    private fun started(serviceId: ServiceId, kind: ServiceEventKind) {
        val current = _snapshots.value[serviceId] ?: ServiceSnapshot(serviceId)
        publish(
            when (kind) {
                ServiceEventKind.OPERATION -> current.copy(activeOperations = current.activeOperations + 1)
                ServiceEventKind.TRANSFER,
                ServiceEventKind.PROBE -> current.copy(activeTransfers = current.activeTransfers + 1)
            },
            persist = false,
        )
    }

    private fun publish(snapshot: ServiceSnapshot, persist: Boolean = true) {
        _snapshots.value = _snapshots.value + (snapshot.serviceId to snapshot)
        if (persist) {
            runCatching {
                store?.save(_snapshots.value.values.sortedBy { it.serviceId.value })
            }
        }
    }

    companion object {
        const val DEFAULT_EVENT_CAPACITY = 160
        val shared = ServiceTelemetry()
    }
}

class ServiceOperation internal constructor(
    private val telemetry: ServiceTelemetry,
    private val serviceId: ServiceId,
    private val startedWallMs: Long,
    private val startedMonoNs: Long,
) {
    private val finished = AtomicBoolean(false)

    fun success(detail: String? = null) = finish(ServiceOutcome.SUCCESS, detail)
    fun failed(detail: String? = null) = finish(ServiceOutcome.FAILED, detail)
    fun cancelled() = finish(ServiceOutcome.CANCELLED, "CANCELLED")

    private fun finish(outcome: ServiceOutcome, detail: String?) {
        if (!finished.compareAndSet(false, true)) return
        val completedAt = telemetry.nowWallMs()
        telemetry.finish(
            ServiceEvent(
                serviceId = serviceId,
                kind = ServiceEventKind.OPERATION,
                outcome = outcome,
                startedAtMs = startedWallMs,
                completedAtMs = completedAt,
                durationMs = telemetry.elapsedMs(startedMonoNs),
                detail = detail.sanitizedDiagnostic(),
            ),
        )
    }
}

class ServiceTransfer internal constructor(
    private val telemetry: ServiceTelemetry,
    private val serviceId: ServiceId,
    private val kind: ServiceEventKind,
    private val startedWallMs: Long,
    private val startedMonoNs: Long,
) {
    private val finished = AtomicBoolean(false)
    private val downloaded = AtomicLong(0L)
    private val uploaded = AtomicLong(0L)
    @Volatile private var httpCode: Int? = null

    fun downloaded(byteCount: Long) { if (byteCount > 0L) downloaded.addAndGet(byteCount) }
    fun uploaded(byteCount: Long) { if (byteCount > 0L) uploaded.addAndGet(byteCount) }
    fun http(code: Int) { httpCode = code }
    fun success(detail: String? = null) = finish(ServiceOutcome.SUCCESS, detail)
    fun failed(detail: String? = null) = finish(ServiceOutcome.FAILED, detail)
    fun cancelled() = finish(ServiceOutcome.CANCELLED, "CANCELLED")

    private fun finish(outcome: ServiceOutcome, detail: String?) {
        if (!finished.compareAndSet(false, true)) return
        val completedAt = telemetry.nowWallMs()
        telemetry.finish(
            ServiceEvent(
                serviceId = serviceId,
                kind = kind,
                outcome = outcome,
                startedAtMs = startedWallMs,
                completedAtMs = completedAt,
                durationMs = telemetry.elapsedMs(startedMonoNs),
                downloadedBytes = downloaded.get(),
                uploadedBytes = uploaded.get(),
                httpCode = httpCode,
                detail = detail.sanitizedDiagnostic(),
            ),
        )
    }
}

suspend inline fun <T> ServiceTelemetry.observeOperation(
    serviceId: ServiceId,
    crossinline block: suspend () -> T,
): T {
    val operation = beginOperation(serviceId)
    return try {
        block().also { operation.success() }
    } catch (cancelled: CancellationException) {
        operation.cancelled()
        throw cancelled
    } catch (failure: Throwable) {
        operation.failed(failure.javaClass.simpleName)
        throw failure
    }
}

suspend inline fun <T> ServiceTelemetry.observeTransfer(
    serviceId: ServiceId,
    kind: ServiceEventKind = ServiceEventKind.TRANSFER,
    crossinline block: suspend (ServiceTransfer) -> T,
): T {
    val transfer = beginTransfer(serviceId, kind)
    return try {
        block(transfer).also { transfer.success() }
    } catch (cancelled: CancellationException) {
        transfer.cancelled()
        throw cancelled
    } catch (failure: Throwable) {
        transfer.failed(failure.javaClass.simpleName)
        throw failure
    }
}

private fun String?.sanitizedDiagnostic(): String? = this
    ?.replace(Regex("https?://\\S+"), "URL")
    ?.take(96)
