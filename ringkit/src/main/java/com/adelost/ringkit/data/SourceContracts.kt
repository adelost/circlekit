package com.adelost.ringkit.data

import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

/**
 * datakit — the fetched-data half of the shared RingKit Android library
 * (spec: docs/qa/2026-07-09-ringkit-master/ARCHITECTURE.md). Pure Kotlin:
 * this package must never import a product app, so it stays JVM-testable and
 * portable across host surfaces.
 *
 * Sensors (barometer/GPS/attitude, P1b contracts) are NOT DataSources: a
 * stream has no TTL, no fetch and no offline state. The two families meet
 * only in the presentation layer (a StatRow takes any value+health provider).
 */

@JvmInline
value class SourceId(val key: String)

/** The four ring colours. Derived, never stored — see [healthOf]. */
enum class Health { FRESH, AGING, BROKEN, OFF }

enum class Trigger {
    /** Fetch when a screen that renders the source is open AND the TTL expired. */
    VISIBLE,

    /** Fetch once when the host declares a bounded high-priority data window. */
    HIGH_PRIORITY_WINDOW,

    /** Compatibility alias for [HIGH_PRIORITY_WINDOW]. Removed after one release cycle. */
    @Deprecated(
        message = "Use HIGH_PRIORITY_WINDOW",
        replaceWith = ReplaceWith("HIGH_PRIORITY_WINDOW"),
    )
    PHASE_PREFETCH,
}

/**
 * The scheduler's honest answer to "what happens next?". It deliberately
 * models eligibility separately from execution: a fresh source becomes due
 * at [FreshUntil.atWallMs], but still needs its declared [trigger] before a
 * network request may start.
 *
 * UI reads this projection; it never guesses a timer from the last request.
 */
sealed interface FetchPlan {
    data object Fetching : FetchPlan
    data object Queued : FetchPlan
    data object ManualOnly : FetchPlan
    data object Unavailable : FetchPlan
    data class FreshUntil(
        val atWallMs: Long,
        val trigger: FetchTrigger,
    ) : FetchPlan
    data class RetryAt(val atWallMs: Long) : FetchPlan
    data class WaitingFor(val trigger: FetchTrigger) : FetchPlan

    /** Non-TTL services still declare their real event in the service catalog. */
    data class EventDriven(
        val event: String,
        val compact: String = event,
    ) : FetchPlan {
        init {
            require(event.isNotBlank()) { "event-driven fetch plans need a label" }
            require(compact.isNotBlank()) { "event-driven fetch plans need a compact label" }
        }
    }
}

enum class FetchTrigger {
    VISIBLE,

    /** The host's bounded high-priority data window. */
    HIGH_PRIORITY_WINDOW,

    /** Either a visible consumer or the high-priority window can make this source due. */
    VISIBLE_OR_HIGH_PRIORITY_WINDOW,

    /** Execution is gated now; retry when the host reopens its execution window. */
    EXECUTION_RESUMED,

    /** A source-specific context prerequisite is not ready yet. */
    CONTEXT_READY,

    /** Compatibility aliases retained for one release cycle. */
    @Deprecated(
        message = "Use HIGH_PRIORITY_WINDOW",
        replaceWith = ReplaceWith("HIGH_PRIORITY_WINDOW"),
    )
    CLIMB,

    @Deprecated(
        message = "Use VISIBLE_OR_HIGH_PRIORITY_WINDOW",
        replaceWith = ReplaceWith("VISIBLE_OR_HIGH_PRIORITY_WINDOW"),
    )
    VISIBLE_OR_CLIMB,

    @Deprecated(
        message = "Use EXECUTION_RESUMED",
        replaceWith = ReplaceWith("EXECUTION_RESUMED"),
    )
    LANDING,

    @Deprecated(
        message = "Use CONTEXT_READY",
        replaceWith = ReplaceWith("CONTEXT_READY"),
    )
    HOME,
}

/** Multi-part fetch progress ("3/9 tiles"), rendered as a ProgressArc. */
data class Progress(val done: Int, val total: Int)

/** Error words are DATA: [word] is what the detail-screen chip renders. */
sealed class FetchError(val word: String) {
    object Offline : FetchError("OFFLINE")
    object Timeout : FetchError("TIMEOUT")
    data class Http(val code: Int) : FetchError("HTTP $code")
    data class Failed(val why: String) : FetchError("FAILED")
}

/**
 * One attempt's outcome. PARTIAL SUCCESS IS SUCCESS: a fetch that lands 6/9
 * tiles returns Success(coverage = 6/9f) — the value is kept and health reads
 * AGING until a later attempt completes it. BROKEN is reserved for "no usable
 * value at all".
 */
sealed interface FetchResult<out T> {
    data class Success<T>(val value: T, val coverage: Float = 1f) : FetchResult<T>
    data class Failure(val error: FetchError) : FetchResult<Nothing>
}

/**
 * A fetched source: ONE attempt, fully parsed domain value, never throws.
 * No retry/TTL/cadence logic in here — the [FetchScheduler] owns all of that,
 * so an adapter is a thin wrap around an existing repo fetch function.
 */
interface DataSource<T> {
    val id: SourceId
    suspend fun fetchOnce(
        request: FetchRequest,
        onProgress: (Progress) -> Unit = {},
    ): FetchResult<T>
}

/** Why one attempt became due. Adapters may force a network refresh only for
 * MANUAL while automatic paths remain cache-aware. */
enum class FetchCause {
    VISIBLE,
    HIGH_PRIORITY_WINDOW,
    CONTEXT_CHANGED,
    INVALIDATED,
    MANUAL,

    /** Compatibility alias for [HIGH_PRIORITY_WINDOW]. Removed after one release cycle. */
    @Deprecated(
        message = "Use HIGH_PRIORITY_WINDOW",
        replaceWith = ReplaceWith("HIGH_PRIORITY_WINDOW"),
    )
    PHASE_PREFETCH,
}

data class FetchRequest(val cause: FetchCause) {
    val forceNetwork: Boolean get() = cause == FetchCause.MANUAL || cause == FetchCause.INVALIDATED
}

/**
 * Per-source policy as DATA (one catalog row): tuning cadence or triggers is
 * a value edit, never scheduler code.
 */
data class SourcePolicy(
    val ttl: Duration,
    val triggers: Set<Trigger>,
    /** Lower = fetched first. Safety-relevant sources take low numbers. */
    val stagePriority: Int = 100,
    /** The per-source ON/OFF chip reads/writes this. */
    val enabled: () -> Boolean = { true },
    /** Automatic visibility/prefetch may be MANUAL while explicit refresh is
     * still allowed. This never overrides [enabled]. */
    val automaticEnabled: () -> Boolean = { true },
    /** Dynamic prerequisite expressed as data, not hidden in the adapter. */
    val blockedPlan: () -> FetchPlan? = { null },
    /**
     * Retry after failure, only while a consumer is visible; resets on
     * success. A transient blip must not wait a full TTL. Capped at the last
     * entry. Production ticks are 1/min, so a 30s backoff fires on the next
     * tick (up to ~60s late) — accepted.
     */
    val retryBackoff: List<Duration> = listOf(30.seconds, 2.minutes, 10.minutes),
    /**
     * Cancel in-flight work when the consumer leaves? Big batches yes
     * (tiles); small payloads finish and land in cache (weather).
     */
    val cancelOnHide: Boolean = false,
    /** Query identity (home/provider/radius). A changed key is due under the
     * normal trigger/gate instead of spawning an ad-hoc repository call. */
    val contextKey: () -> String? = { null },
)

/** One scheduler row: the source, its policy, optionally how to persist it. */
data class SchedulerRow<T>(
    val source: DataSource<T>,
    val policy: SourcePolicy,
    val codec: SourceCodec<T>? = null,
)

/**
 * Monotonic time for staleness (immune to wall-clock sync) + wall time only
 * for rendering "12 min ago". Injectable so the scheduler is clock-testable.
 */
interface MonoClock {
    fun nowMs(): Long
    fun wallMs(): Long
}

/**
 * LAST GOOD VALUE PERSISTS: a cold start renders the watch's last knowledge
 * with honest AGING rings, never a grey dashboard begging for manual
 * refreshes. Persisted entries load with unknown monotonic age -> AGING.
 */
interface SourceStore {
    fun load(id: SourceId): Persisted?
    fun save(id: SourceId, serialized: String, wallMs: Long)

    data class Persisted(val serialized: String, val wallMs: Long)

    object None : SourceStore {
        override fun load(id: SourceId): Persisted? = null
        override fun save(id: SourceId, serialized: String, wallMs: Long) = Unit
    }
}

/** How a source's value survives process death. Optional per row. */
interface SourceCodec<T> {
    fun encode(value: T): String
    fun decode(serialized: String): T?
}
