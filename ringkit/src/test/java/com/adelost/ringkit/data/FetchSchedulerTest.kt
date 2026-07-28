package com.adelost.ringkit.data

import com.adelost.servicekit.ServiceClock
import com.adelost.servicekit.ServiceId
import com.adelost.servicekit.ServiceOutcome
import com.adelost.servicekit.ServiceTelemetry
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.time.Duration.Companion.minutes

/**
 * The 11 cases spec'd in docs/qa/2026-07-09-ringkit-master/ARCHITECTURE.md,
 * written BEFORE the scheduler. Everything is driven by injected flows + a
 * fake monotonic clock; Dispatchers.Unconfined makes emissions synchronous
 * (same pattern as the repo's other coroutine tests).
 */
class FetchSchedulerTest {

    private class FakeClock(var mono: Long = 0L, var wall: Long = 1_000_000L) : MonoClock {
        override fun nowMs(): Long = mono
        override fun wallMs(): Long = wall
        fun advanceMinutes(m: Long) { mono += m * 60_000; wall += m * 60_000 }
        fun advanceSeconds(s: Long) { mono += s * 1_000; wall += s * 1_000 }
    }

    /** Controllable source: auto-completes unless [pendingMode] is set. */
    private class FakeSource(
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

    private class Harness(
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
        val scope = CoroutineScope(Dispatchers.Unconfined + Job())
        val scheduler = FetchScheduler(
            rows = rows,
            scope = scope,
            clock = clock,
            gateOpen = gate,
            prefetchPulses = pulses,
            visibleSources = visible,
            ttlTicks = ticks,
            store = store,
            maxConcurrent = maxConcurrent,
            telemetry = telemetry,
        )
        fun tick() = runBlocking { ticks.emit(Unit) }
        fun pulse() = runBlocking { pulses.emit(Unit) }
    }

    private fun visiblePolicy(ttlMinutes: Int = 15) = SourcePolicy(
        ttl = ttlMinutes.minutes,
        triggers = setOf(Trigger.VISIBLE),
    )

    // 1 ------------------------------------------------------------------
    @Test
    fun `TTL expiry fires a visible source, a non-visible source stays silent`() {
        val a = FakeSource("a"); val b = FakeSource("b")
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy()), SchedulerRow(b, visiblePolicy())))
        h.visible.value = setOf(a.id)
        assertEquals(1, a.calls) // stale-on-first-look
        assertEquals(0, b.calls)
        h.clock.advanceMinutes(16)
        h.tick()
        assertEquals(2, a.calls) // ttl expired, still visible
        assertEquals(0, b.calls) // never visible, never fetched
    }

    // 2 ------------------------------------------------------------------
    @Test
    fun `A prefetch pulse sweeps stale PHASE_PREFETCH sources, priority ordered, fresh skipped`() {
        val order = mutableListOf<String>()
        val p1 = FakeSource("p1", order); val p2 = FakeSource("p2", order)
        val v = FakeSource("v", order)
        val h = Harness(listOf(
            SchedulerRow(p2, SourcePolicy(15.minutes, setOf(Trigger.PHASE_PREFETCH), stagePriority = 2)),
            SchedulerRow(p1, SourcePolicy(15.minutes, setOf(Trigger.PHASE_PREFETCH), stagePriority = 1)),
            SchedulerRow(v, visiblePolicy()),
        ))
        h.pulse()
        assertEquals(listOf("p1", "p2"), order) // priority order, v untouched
        // A second pulse with everything fresh fetches nothing.
        h.pulse()
        assertEquals(1, p1.calls); assertEquals(1, p2.calls); assertEquals(0, v.calls)
    }

    // 3 ------------------------------------------------------------------
    @Test
    fun `Frozen gate blocks everything, manual included, and queued work runs on landing`() {
        val a = FakeSource("a")
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy())))
        h.gate.value = false
        h.visible.value = setOf(a.id)
        h.scheduler.manual(a.id)
        h.tick()
        assertEquals(0, a.calls) // frozen mid-jump
        assertEquals(FetchPlan.WaitingFor(FetchTrigger.LANDING), h.scheduler.plans.value[a.id])
        h.gate.value = true      // landed
        assertEquals(1, a.calls) // the queued manual runs
    }

    // 4 ------------------------------------------------------------------
    @Test
    fun `Concurrency cap holds and freed slots fill back-to-back`() {
        val a = FakeSource("a").apply { pendingMode = true }
        val b = FakeSource("b").apply { pendingMode = true }
        val c = FakeSource("c").apply { pendingMode = true }
        val h = Harness(listOf(
            SchedulerRow(a, visiblePolicy().copy(stagePriority = 1)),
            SchedulerRow(b, visiblePolicy().copy(stagePriority = 2)),
            SchedulerRow(c, visiblePolicy().copy(stagePriority = 3)),
        ))
        h.visible.value = setOf(a.id, b.id, c.id)
        assertEquals(1, a.calls); assertEquals(1, b.calls)
        assertEquals(0, c.calls) // cap 2
        a.pending!!.complete(FetchResult.Success("v"))
        assertEquals(1, c.calls) // freed slot fills immediately, same radio window
    }

    // 5 ------------------------------------------------------------------
    @Test
    fun `Retry backoff runs 30s-2m while visible and resets on success`() {
        val a = FakeSource("a").apply { nextResult = FetchResult.Failure(FetchError.Timeout) }
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy())))
        h.visible.value = setOf(a.id)
        assertEquals(1, a.calls)                 // first attempt fails
        assertEquals(FetchPlan.RetryAt(h.clock.wall + 30_000L), h.scheduler.plans.value[a.id])
        h.clock.advanceSeconds(10); h.tick()
        assertEquals(1, a.calls)                 // before 30s backoff: silent
        h.clock.advanceSeconds(25); h.tick()
        assertEquals(2, a.calls)                 // past 30s: retry (fails again)
        h.clock.advanceSeconds(35); h.tick()
        assertEquals(2, a.calls)                 // second backoff is 2m, not 30s
        h.clock.advanceSeconds(90); h.tick()
        assertEquals(3, a.calls)                 // past 2m total: retry
        a.nextResult = FetchResult.Success("v")
        h.clock.advanceSeconds(601); h.tick()
        assertEquals(4, a.calls)                 // succeeds -> counters reset
        a.nextResult = FetchResult.Failure(FetchError.Timeout)
        h.clock.advanceMinutes(16); h.tick()     // ttl refetch fails
        assertEquals(5, a.calls)
        h.clock.advanceSeconds(31); h.tick()
        assertEquals(6, a.calls)                 // back to the 30s rung: reset worked
    }

    @Test
    fun `plan exposes freshness deadline and the policy trigger without guessing a fetch time`() {
        val a = FakeSource("a")
        val policy = SourcePolicy(
            ttl = 15.minutes,
            triggers = setOf(Trigger.VISIBLE, Trigger.PHASE_PREFETCH),
        )
        val h = Harness(listOf(SchedulerRow(a, policy)))

        h.visible.value = setOf(a.id)

        assertEquals(
            FetchPlan.FreshUntil(
                atWallMs = h.clock.wall + 15 * 60_000L,
                trigger = FetchTrigger.VISIBLE_OR_CLIMB,
            ),
            h.scheduler.plans.value[a.id],
        )
    }

    @Test
    fun `declared prerequisite blocks manual work and becomes visible in the plan`() {
        val a = FakeSource("a")
        var waitingForHome = true
        val policy = visiblePolicy().copy(
            blockedPlan = {
                if (waitingForHome) FetchPlan.WaitingFor(FetchTrigger.HOME) else null
            },
        )
        val h = Harness(listOf(SchedulerRow(a, policy)))

        h.visible.value = setOf(a.id)
        h.scheduler.manual(a.id)
        assertEquals(0, a.calls)
        assertEquals(FetchPlan.WaitingFor(FetchTrigger.HOME), h.scheduler.plans.value[a.id])

        waitingForHome = false
        h.tick()
        assertEquals(1, a.calls)
    }

    // 6 ------------------------------------------------------------------
    @Test
    fun `Partial success keeps the partial value as AGING and retries while visible`() {
        val a = FakeSource("a").apply { nextResult = FetchResult.Success("6of9", coverage = 6 / 9f) }
        val row = SchedulerRow(a, visiblePolicy())
        val h = Harness(listOf(row))
        h.visible.value = setOf(a.id)
        val s = h.scheduler.state(a.id).value
        assertEquals("6of9", s.value)            // partial success IS success
        assertNull(s.lastError)
        assertEquals(Health.AGING, healthOf(s, row.policy, h.clock.nowMs()))
        h.tick()
        assertEquals(2, a.calls)                 // still due: tries to complete the mosaic
    }

    // 7 ------------------------------------------------------------------
    @Test
    fun `A persisted value loads on start and reads AGING, never FRESH`() {
        val a = FakeSource("a")
        val codec = object : SourceCodec<String> {
            override fun encode(value: String) = value
            override fun decode(serialized: String) = serialized
        }
        val store = object : SourceStore {
            override fun load(id: SourceId) = SourceStore.Persisted("lastKnown", wallMs = 123L)
            override fun save(id: SourceId, serialized: String, wallMs: Long) = Unit
        }
        val row = SchedulerRow(a, visiblePolicy(), codec)
        val h = Harness(listOf(row), store = store)
        val s = h.scheduler.state(a.id).value
        assertEquals("lastKnown", s.value)       // the watch remembers what it knew
        assertNull(s.fetchedAtMono)              // unknown age after reboot
        assertEquals(Health.AGING, healthOf(s, row.policy, h.clock.nowMs()))
    }

    // 8 ------------------------------------------------------------------
    @Test
    fun `Staleness is monotonic - a wall-clock jump neither expires nor refreshes a value`() {
        val a = FakeSource("a")
        val row = SchedulerRow(a, visiblePolicy())
        val h = Harness(listOf(row))
        h.visible.value = setOf(a.id)
        assertEquals(1, a.calls)
        h.clock.wall += 3_600_000L * 24          // time sync jumps a day
        h.clock.mono += 60_000L                  // one real minute passed
        h.tick()
        assertEquals(1, a.calls)                 // still fresh: age is monotonic
        assertEquals(Health.FRESH, healthOf(h.scheduler.state(a.id).value, row.policy, h.clock.nowMs()))
    }

    // 9 ------------------------------------------------------------------
    @Test
    fun `cancelOnHide cancels big batches on leave, small payloads land in cache`() {
        val tiles = FakeSource("tiles").apply { pendingMode = true }
        val weather = FakeSource("weather").apply { pendingMode = true }
        val h = Harness(listOf(
            SchedulerRow(tiles, visiblePolicy().copy(cancelOnHide = true)),
            SchedulerRow(weather, visiblePolicy().copy(cancelOnHide = false)),
        ))
        h.visible.value = setOf(tiles.id, weather.id)
        h.visible.value = emptySet()             // user leaves the screen
        assertFalse(h.scheduler.state(tiles.id).value.inFlight)   // batch cancelled
        assertTrue(h.scheduler.state(weather.id).value.inFlight)  // payload finishes
        weather.pending!!.complete(FetchResult.Success("landed"))
        assertEquals("landed", h.scheduler.state(weather.id).value.value)
        h.visible.value = setOf(tiles.id)
        assertEquals(2, tiles.calls)             // cancelled work refetches on next look
    }

    // 10 -----------------------------------------------------------------
    @Test
    fun `An in-flight source is never double-fetched`() {
        val a = FakeSource("a").apply { pendingMode = true }
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy())))
        h.visible.value = setOf(a.id)
        h.tick(); h.tick()
        h.scheduler.manual(a.id)
        assertEquals(1, a.calls)                 // dedup: one attempt in flight
    }

    // 11 -----------------------------------------------------------------
    @Test
    fun `select emits distinct projections - progress spam never leaks`() {
        val a = FakeSource("a").apply { pendingMode = true }
        val row = SchedulerRow(a, visiblePolicy())
        val h = Harness(listOf(row))
        val healths = mutableListOf<Health>()
        h.scope.launch {
            h.scheduler.select(a.id) { healthOf(it, row.policy, h.clock.nowMs()) }
                .collect { healths.add(it) }
        }
        h.visible.value = setOf(a.id)
        val emissionsBefore = healths.size
        a.lastOnProgress!!(Progress(1, 9))
        a.lastOnProgress!!(Progress(2, 9))
        a.lastOnProgress!!(Progress(3, 9))       // progress spam...
        assertEquals(emissionsBefore, healths.size) // ...projection stays silent
        a.pending!!.complete(FetchResult.Success("v"))
        assertEquals(Health.FRESH, healths.last())
    }

    @Test
    fun `manual intent is visible to the adapter and bypasses TTL`() {
        val a = FakeSource("a")
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy())))
        h.visible.value = setOf(a.id)
        assertEquals(FetchCause.VISIBLE, a.requests.single().cause)

        h.scheduler.manual(a.id)

        assertEquals(2, a.calls)
        assertEquals(FetchCause.MANUAL, a.requests.last().cause)
        assertTrue(a.requests.last().forceNetwork)
    }

    @Test
    fun `context change refetches a visible fresh source through the same gate`() {
        var context = "home-a"
        val a = FakeSource("a")
        val policy = visiblePolicy().copy(contextKey = { context })
        val h = Harness(listOf(SchedulerRow(a, policy)))
        h.visible.value = setOf(a.id)
        assertEquals(FetchCause.CONTEXT_CHANGED, a.requests.single().cause)

        context = "home-b"
        h.tick()

        assertEquals(2, a.calls)
        assertEquals(FetchCause.CONTEXT_CHANGED, a.requests.last().cause)
    }

    @Test
    fun `manual-only policy stays silent automatically but accepts explicit refresh`() {
        val a = FakeSource("a")
        val policy = visiblePolicy().copy(automaticEnabled = { false })
        val h = Harness(listOf(SchedulerRow(a, policy)))

        h.visible.value = setOf(a.id)
        h.tick()
        assertEquals(0, a.calls)

        h.scheduler.manual(a.id)
        assertEquals(1, a.calls)
        assertEquals(FetchCause.MANUAL, a.requests.single().cause)
    }

    @Test
    fun `invalidation refetches only when visible and stays behind the safety gate`() {
        val a = FakeSource("a")
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy())))
        h.visible.value = setOf(a.id)
        assertEquals(1, a.calls)

        h.visible.value = emptySet()
        h.scheduler.invalidate(a.id)
        assertEquals(1, a.calls)

        h.gate.value = false
        h.visible.value = setOf(a.id)
        assertEquals(1, a.calls)

        h.gate.value = true
        assertEquals(2, a.calls)
        assertEquals(FetchCause.INVALIDATED, a.requests.last().cause)
        assertTrue(a.requests.last().forceNetwork)
    }

    @Test
    fun `every scheduled attempt publishes one durable service operation outcome`() {
        val source = FakeSource("weather")
        val h = Harness(listOf(SchedulerRow(source, visiblePolicy())))

        h.visible.value = setOf(source.id)
        var snapshot = h.telemetry.snapshots.value.getValue(ServiceId("weather"))
        assertEquals(ServiceOutcome.SUCCESS, snapshot.lastAttempt?.outcome)
        assertEquals(1L, snapshot.attemptCount)

        source.nextResult = FetchResult.Failure(FetchError.Timeout)
        h.scheduler.manual(source.id)
        snapshot = h.telemetry.snapshots.value.getValue(ServiceId("weather"))
        assertEquals(ServiceOutcome.FAILED, snapshot.lastAttempt?.outcome)
        assertEquals("TIMEOUT", snapshot.lastAttempt?.detail)
        assertEquals(2L, snapshot.attemptCount)
        assertTrue(snapshot.lastSuccessAtMs != null)
    }
}
