package com.adelost.ringkit.data

import com.adelost.servicekit.ServiceClock
import com.adelost.servicekit.ServiceTelemetry
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.runBlocking
import kotlin.time.Duration.Companion.minutes

/** Controlled clocks and transport boundaries shared by scheduler behavior tests. */
internal class FakeClock(var mono: Long = 0L, var wall: Long = 1_000_000L) : MonoClock {
    override fun nowMs(): Long = mono
    override fun wallMs(): Long = wall
    fun advanceMinutes(m: Long) { mono += m * 60_000; wall += m * 60_000 }
    fun advanceSeconds(s: Long) { mono += s * 1_000; wall += s * 1_000 }
}

/** Controllable source: auto-completes unless [pendingMode] is set. */
internal class FakeSource(
    key: String,
    private val log: MutableList<String>? = null,
) : DataSource<String> {
    override val id = SourceId(key)
    var calls = 0
    var pendingMode = false
    var nextResult: FetchResult<String> = FetchResult.Success("v")
    var pending: CompletableDeferred<FetchResult<String>>? = null
    var lastOnProgress: ((Progress) -> Unit)? = null
    val requests = mutableListOf<FetchRequest>()

    override suspend fun fetchOnce(
        request: FetchRequest,
        onProgress: (Progress) -> Unit,
    ): FetchResult<String> {
        calls++
        requests += request
        log?.add(id.key)
        lastOnProgress = onProgress
        if (!pendingMode) return nextResult
        val d = CompletableDeferred<FetchResult<String>>()
        pending = d
        return d.await()
    }
}

internal class Harness(
    rows: List<SchedulerRow<*>>,
    val clock: FakeClock = FakeClock(),
    store: SourceStore = SourceStore.None,
    maxConcurrent: Int = 2,
) {
    val telemetry = ServiceTelemetry(object : ServiceClock {
        override fun wallMs(): Long = clock.wallMs()
        override fun monotonicNs(): Long = clock.nowMs() * 1_000_000L
    })
    val gate = MutableStateFlow(true)
    val visible = MutableStateFlow<Set<SourceId>>(emptySet())
    val pulses = MutableSharedFlow<Unit>()
    val ticks = MutableSharedFlow<Unit>()
    val networkReturns = MutableSharedFlow<Unit>()
    val scope = CoroutineScope(Dispatchers.Unconfined + Job())
    val scheduler = FetchScheduler(
        rows = rows,
        scope = scope,
        clock = clock,
        gateOpen = gate,
        priorityWindowPulses = pulses,
        visibleSources = visible,
        ttlTicks = ticks,
        networkReturns = networkReturns,
        store = store,
        maxConcurrent = maxConcurrent,
        telemetry = telemetry,
    )
    fun tick() = runBlocking { ticks.emit(Unit) }
    fun pulse() = runBlocking { pulses.emit(Unit) }
    fun networkReturned() = runBlocking { networkReturns.emit(Unit) }
}

internal fun visiblePolicy(ttlMinutes: Int = 15) = SourcePolicy(
    ttl = ttlMinutes.minutes,
    triggers = setOf(Trigger.VISIBLE),
)

