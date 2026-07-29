package com.adelost.ringkit.data

import com.adelost.servicekit.ServiceId
import com.adelost.servicekit.ServiceTelemetry
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * The ONLY fetch decision point. Nothing else in an app built on datakit is
 * allowed to hit the network (seam-gated once the app adopts it). Main logic
 * stays simple because policy is data: the scheduler reacts to five
 * events and re-evaluates one guard chain.
 *
 * Events:
 *  - the visible-source set changed  -> fetch stale VISIBLE sources
 *  - a high-priority pulse              -> fetch declared priority-window sources
 *  - [manual]                        -> fetch that source, bypassing TTL
 *  - cache invalidation              -> refetch on its next eligible surface
 *  - a TTL tick (production: 1/min while anything is visible)
 *
 * Guards, in order: enabled && !inFlight && gate open && (due by trigger).
 * While the host closes the gate, no request starts, including manual ones.
 * Pending work resumes when the host reopens it.
 *
 * Execution: due sources run priority-ordered with a small concurrency cap,
 * back-to-back with no idle between them — a sweep is ONE radio window (the
 * radio's power tail is the real battery cost on a watch, not the bytes).
 */
class FetchScheduler(
    rows: List<SchedulerRow<*>>,
    private val scope: CoroutineScope,
    private val clock: MonoClock,
    gateOpen: Flow<Boolean>,
    priorityWindowPulses: Flow<Unit>,
    visibleSources: Flow<Set<SourceId>>,
    ttlTicks: Flow<Unit>,
    private val store: SourceStore = SourceStore.None,
    private val maxConcurrent: Int = 2,
    private val telemetry: ServiceTelemetry = ServiceTelemetry.shared,
) {
    private val rowsById = rows.associateBy { it.source.id }
    private val states = rows.associate { row ->
        row.source.id to MutableStateFlow(initialState(row))
    }
    private val fetchPlans = MutableStateFlow<Map<SourceId, FetchPlan>>(emptyMap())
    private val jobs = mutableMapOf<SourceId, Job>()
    private val manualPending = mutableSetOf<SourceId>()
    private val invalidated = mutableSetOf<SourceId>()
    private var priorityWindowPending = false
    private var visible: Set<SourceId> = emptySet()
    private var open = true

    /** Failure count per source since last success; indexes [SourcePolicy.retryBackoff]. */
    private val failureCount = mutableMapOf<SourceId, Int>()
    private val nextRetryAtMono = mutableMapOf<SourceId, Long>()
    private val completedContextKeys = mutableMapOf<SourceId, String?>()

    /** Everything mutating scheduler bookkeeping runs under this lock. */
    private val lock = Any()

    init {
        publishPlans()
        scope.launch { gateOpen.collect { onGate(it) } }
        scope.launch { visibleSources.collect { onVisible(it) } }
        scope.launch { priorityWindowPulses.collect { onPriorityWindowPulse() } }
        scope.launch { ttlTicks.collect { evaluate() } }
    }

    fun state(id: SourceId): StateFlow<SourceState<*>> = requireNotNull(states[id]) {
        "unknown source ${id.key} — every source must be a scheduler row"
    }.asStateFlow()

    /** One observable plan map for diagnostics on every host surface. */
    val plans: StateFlow<Map<SourceId, FetchPlan>> = fetchPlans.asStateFlow()

    fun plan(id: SourceId): Flow<FetchPlan> {
        require(id in rowsById) { "unknown source ${id.key}" }
        return plans.map { requireNotNull(it[id]) }.distinctUntilChanged()
    }

    /**
     * Subscribe to PROJECTIONS, never raw state: tile progress emits dozens of
     * times per fetch and must not recompose a screen that only shows health.
     */
    fun <R> select(id: SourceId, projection: (SourceState<*>) -> R): Flow<R> =
        state(id).map(projection).distinctUntilChanged()

    fun health(id: SourceId): Flow<Health> {
        val policy = policyOf(id)
        return select(id) { healthOf(it, policy, clock.nowMs()) }
    }

    /** The refresh ring on a detail screen. Bypasses TTL, still respects the gate. */
    fun manual(id: SourceId) {
        require(id in rowsById) { "unknown source ${id.key}" }
        synchronized(lock) { manualPending.add(id) }
        publishPlans()
        evaluate()
    }

    /**
     * Marks cached knowledge unusable without bypassing visibility or the
     * airborne gate. This is the cache-clear/config-reset counterpart to
     * [manual]: the next eligible attempt is explicit in diagnostics and
     * forces the adapter past any surviving repository cache.
     */
    fun invalidate(id: SourceId) {
        require(id in rowsById) { "unknown source ${id.key}" }
        synchronized(lock) { invalidated.add(id) }
        publishPlans()
        evaluate()
    }

    // --- event handlers -------------------------------------------------

    private fun onGate(nowOpen: Boolean) {
        synchronized(lock) { open = nowOpen }
        publishPlans()
        if (nowOpen) evaluate()
    }

    private fun onVisible(next: Set<SourceId>) {
        val hidden: List<SourceId>
        synchronized(lock) {
            hidden = (visible - next).filter { id ->
                policyOf(id).cancelOnHide && jobs[id]?.isActive == true
            }
            visible = next
        }
        // Leaving a screen cancels big batches (tiles); small payloads finish
        // and land in cache. Cancellation is not a failure: no retry advance,
        // the stale value simply stays stale until next look.
        hidden.forEach { id -> jobs[id]?.cancel() }
        publishPlans()
        evaluate()
    }

    private fun onPriorityWindowPulse() {
        synchronized(lock) { priorityWindowPending = true }
        publishPlans()
        evaluate()
    }

    // --- the guard chain ------------------------------------------------

    private fun evaluate(excludeId: SourceId? = null) {
        val toLaunch = mutableListOf<DueSource>()
        synchronized(lock) {
            if (!open) return
            var slots = maxConcurrent - jobs.count { it.value.isActive }
            if (slots <= 0) return
            val now = clock.nowMs()
            val due = rowsById.values
                .filter { it.source.id != excludeId }
                .mapNotNull { row -> dueRequest(row, now)?.let { DueSource(row, it) } }
                .sortedBy { it.row.policy.stagePriority }
            for (dueSource in due) {
                if (slots <= 0) break
                toLaunch.add(dueSource)
                slots--
            }
            // The pulse is consumed by one evaluation pass with the gate open;
            // sources that didn't fit in the cap are still stale and get the
            // freed slot on fetch completion below.
            if (priorityWindowPending && due.isEmpty()) priorityWindowPending = false
            publishPlansLocked(now)
        }
        toLaunch.forEach { launchFetch(it.row, it.request) }
    }

    private fun dueRequest(row: SchedulerRow<*>, now: Long): FetchRequest? {
        val id = row.source.id
        val policy = row.policy
        if (!policy.enabled()) return null
        val s = states.getValue(id).value
        if (s.inFlight) return null
        if (policy.blockedPlan() != null) return null
        if (id in manualPending) return FetchRequest(FetchCause.MANUAL)
        if (!policy.automaticEnabled()) return null
        // The retry backoff gates EVERY automatic path: a failed source stays
        // stale, so without this gate staleness alone would retry-storm.
        nextRetryAtMono[id]?.let { retryAt -> if (now < retryAt) return null }
        val stale = isStale(s, policy, now)
        val contextChanged = completedContextKeys[id] != policy.contextKey()
        if (Trigger.VISIBLE in policy.triggers && id in visible && id in invalidated) {
            return FetchRequest(FetchCause.INVALIDATED)
        }
        if (Trigger.VISIBLE in policy.triggers && id in visible && contextChanged) {
            return FetchRequest(FetchCause.CONTEXT_CHANGED)
        }
        if (
            priorityWindowPending && policy.triggers.containsPriorityWindow() &&
            (stale || contextChanged || id in invalidated)
        ) {
            return FetchRequest(FetchCause.HIGH_PRIORITY_WINDOW)
        }
        if (Trigger.VISIBLE in policy.triggers && id in visible && stale) {
            return FetchRequest(FetchCause.VISIBLE)
        }
        return null
    }

    private fun launchFetch(row: SchedulerRow<*>, request: FetchRequest) {
        val id = row.source.id
        val stateFlow = states.getValue(id)
        synchronized(lock) {
            if (jobs[id]?.isActive == true) return // in-flight dedup
            stateFlow.value = stateFlow.value.copy(inFlight = true, progress = null)
            publishPlansLocked(clock.nowMs())
            val job = scope.launch {
                val operation = telemetry.beginOperation(ServiceId(id.key))
                try {
                    val result = row.source.fetchOnce(request) { p ->
                        stateFlow.value = stateFlow.value.copy(progress = p)
                    }
                    onFetchDone(row, result)
                    when (result) {
                        is FetchResult.Success -> operation.success(
                            if (result.coverage < 1f) "PARTIAL" else null,
                        )
                        is FetchResult.Failure -> operation.failed(result.error.word)
                    }
                } catch (cancelled: CancellationException) {
                    operation.cancelled()
                    throw cancelled
                } catch (failure: Throwable) {
                    operation.failed(failure.javaClass.simpleName)
                    throw failure
                }
            }
            jobs[id] = job
            job.invokeOnCompletion { cause ->
                if (cause != null) {
                    // Cancelled (or died): clear inFlight, keep the old value and
                    // retry bookkeeping untouched — cancellation is not failure.
                    stateFlow.value = stateFlow.value.copy(inFlight = false, progress = null)
                    synchronized(lock) {
                        jobs.remove(id)
                        publishPlansLocked(clock.nowMs())
                    }
                }
            }
        }
    }

    private fun onFetchDone(row: SchedulerRow<*>, result: FetchResult<*>) {
        val id = row.source.id
        val stateFlow = states.getValue(id)
        synchronized(lock) {
            when (result) {
                is FetchResult.Success -> {
                    stateFlow.value = SourceState(
                        value = result.value,
                        fetchedAtMono = clock.nowMs(),
                        fetchedAtWall = clock.wallMs(),
                        coverage = result.coverage,
                    )
                    failureCount.remove(id)
                    nextRetryAtMono.remove(id)
                    invalidated.remove(id)
                    completedContextKeys[id] = row.policy.contextKey()
                    persist(row, result.value)
                }
                is FetchResult.Failure -> {
                    stateFlow.value = stateFlow.value.copy(
                        inFlight = false,
                        progress = null,
                        lastError = result.error,
                    )
                    val count = (failureCount[id] ?: 0)
                    val backoff = row.policy.retryBackoff
                    val delay = backoff[count.coerceAtMost(backoff.lastIndex)]
                    failureCount[id] = count + 1
                    nextRetryAtMono[id] = clock.nowMs() + delay.inWholeMilliseconds
                }
            }
            manualPending.remove(id)
            jobs.remove(id)
            publishPlansLocked(clock.nowMs())
        }
        // Fill the freed concurrency slot back-to-back: the sweep stays one
        // radio window instead of waiting for the next tick. The finished
        // source EXCLUDES ITSELF: a still-stale outcome (partial coverage)
        // must wait for the next tick, not respin inline forever.
        evaluate(excludeId = id)
    }

    // --- helpers ----------------------------------------------------------

    private fun policyOf(id: SourceId): SourcePolicy =
        requireNotNull(rowsById[id]) { "unknown source ${id.key}" }.policy

    private fun publishPlans() {
        synchronized(lock) { publishPlansLocked(clock.nowMs()) }
    }

    private fun publishPlansLocked(nowMono: Long) {
        val nowWall = clock.wallMs()
        fetchPlans.value = rowsById.values.associate { row ->
            row.source.id to fetchPlan(row, nowMono, nowWall)
        }
    }

    private fun fetchPlan(row: SchedulerRow<*>, nowMono: Long, nowWall: Long): FetchPlan {
        val id = row.source.id
        val policy = row.policy
        val state = states.getValue(id).value
        if (!policy.enabled()) return FetchPlan.Unavailable
        if (state.inFlight) return FetchPlan.Fetching
        policy.blockedPlan()?.let { return it }
        if (id in manualPending) {
            return if (open) FetchPlan.Queued
            else FetchPlan.WaitingFor(FetchTrigger.EXECUTION_RESUMED)
        }
        if (!policy.automaticEnabled()) return FetchPlan.ManualOnly
        nextRetryAtMono[id]?.let { retryAt ->
            if (nowMono < retryAt) {
                return FetchPlan.RetryAt(nowWall + (retryAt - nowMono))
            }
        }

        val stale = isStale(state, policy, nowMono)
        val contextChanged = completedContextKeys[id] != policy.contextKey()
        val due = stale || contextChanged || id in invalidated
        if (!due) {
            val fetchedAt = requireNotNull(state.fetchedAtMono)
            return FetchPlan.FreshUntil(
                atWallMs = nowWall + (fetchedAt + policy.ttl.inWholeMilliseconds - nowMono)
                    .coerceAtLeast(0L),
                trigger = policy.fetchTrigger(),
            )
        }
        if (!open) return FetchPlan.WaitingFor(FetchTrigger.EXECUTION_RESUMED)
        if (dueRequest(row, nowMono) != null) return FetchPlan.Queued
        return FetchPlan.WaitingFor(policy.fetchTrigger())
    }

    private fun SourcePolicy.fetchTrigger(): FetchTrigger = when {
        Trigger.VISIBLE in triggers && triggers.containsPriorityWindow() ->
            FetchTrigger.VISIBLE_OR_HIGH_PRIORITY_WINDOW
        triggers.containsPriorityWindow() -> FetchTrigger.HIGH_PRIORITY_WINDOW
        else -> FetchTrigger.VISIBLE
    }

    /**
     * The deprecated entry remains executable for one compatibility cycle so
     * an already-compiled host never silently loses its priority fetches.
     */
    @Suppress("DEPRECATION")
    private fun Set<Trigger>.containsPriorityWindow(): Boolean =
        Trigger.HIGH_PRIORITY_WINDOW in this || Trigger.PHASE_PREFETCH in this

    private data class DueSource(
        val row: SchedulerRow<*>,
        val request: FetchRequest,
    )

    private fun initialState(row: SchedulerRow<*>): SourceState<Any?> {
        val codec = row.codec ?: return SourceState()
        val persisted = store.load(row.source.id) ?: return SourceState()
        val value = codec.decode(persisted.serialized) ?: return SourceState()
        // Persisted knowledge has UNKNOWN monotonic age (reboot resets the
        // monotonic clock), so it renders AGING until refreshed — honest, and
        // infinitely better than a grey dashboard on every cold start.
        return SourceState(value = value, fetchedAtMono = null, fetchedAtWall = persisted.wallMs)
    }

    private fun persist(row: SchedulerRow<*>, value: Any?) {
        val codec = row.codec ?: return
        if (value == null) return
        // Scheduler rows intentionally erase T; the row keeps codec and source paired.
        @Suppress("UNCHECKED_CAST")
        val encoded = (codec as SourceCodec<Any?>).encode(value)
        store.save(row.source.id, encoded, clock.wallMs())
    }
}
