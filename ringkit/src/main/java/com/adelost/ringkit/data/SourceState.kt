package com.adelost.ringkit.data

/**
 * The canonical live state of one fetched source. Owned by [FetchScheduler]
 * (adapters never mutate state; they only produce [FetchResult]s), so the
 * robustness invariants live in exactly one place:
 *
 *  - [value] is the LAST GOOD value: failures never erase it.
 *  - [fetchedAtMono] is monotonic; null means "age unknown" (persisted value
 *    loaded after a reboot) and always reads as AGING, never FRESH.
 *  - [coverage] < 1 means a partial multi-part fetch: still a value, but
 *    AGING until an attempt completes it.
 */
data class SourceState<out T>(
    val value: T? = null,
    /** Monotonic stamp for staleness math. Null = unknown age (persisted). */
    val fetchedAtMono: Long? = null,
    /** Wall stamp ONLY for rendering "12 min ago". Never used for staleness. */
    val fetchedAtWall: Long? = null,
    val inFlight: Boolean = false,
    val progress: Progress? = null,
    val lastError: FetchError? = null,
    val coverage: Float = 1f,
)

/**
 * Derives the ring colour. Pure: state + policy + now -> [Health].
 *
 * BROKEN is reserved for "no usable value at all"; an error on top of an old
 * value reads AGING (the old value is still the best truth we have).
 * A never-fetched enabled source also reads AGING ("nothing yet, look at me"),
 * not BROKEN — nothing failed.
 */
fun healthOf(state: SourceState<*>, policy: SourcePolicy, nowMono: Long): Health = when {
    !policy.enabled() -> Health.OFF
    state.value == null && state.lastError != null -> Health.BROKEN
    state.value == null -> Health.AGING
    state.fetchedAtMono == null -> Health.AGING
    state.coverage < 1f -> Health.AGING
    (nowMono - state.fetchedAtMono) > policy.ttl.inWholeMilliseconds -> Health.AGING
    else -> Health.FRESH
}

/** Staleness for the scheduler: should a trigger consider this source due? */
internal fun isStale(state: SourceState<*>, policy: SourcePolicy, nowMono: Long): Boolean = when {
    state.value == null -> true
    state.fetchedAtMono == null -> true
    state.coverage < 1f -> true
    else -> (nowMono - state.fetchedAtMono) > policy.ttl.inWholeMilliseconds
}
