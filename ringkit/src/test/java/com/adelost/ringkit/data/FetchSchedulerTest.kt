package com.adelost.ringkit.data

import com.adelost.servicekit.ServiceId
import com.adelost.servicekit.ServiceOutcome
import kotlinx.coroutines.launch
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
    fun `A priority pulse sweeps stale priority-window sources in declared order`() {
        val order = mutableListOf<String>()
        val p1 = FakeSource("p1", order); val p2 = FakeSource("p2", order)
        val v = FakeSource("v", order)
        val h = Harness(listOf(
            SchedulerRow(
                p2,
                SourcePolicy(15.minutes, setOf(Trigger.HIGH_PRIORITY_WINDOW), stagePriority = 2),
            ),
            SchedulerRow(
                p1,
                SourcePolicy(15.minutes, setOf(Trigger.HIGH_PRIORITY_WINDOW), stagePriority = 1),
            ),
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
    fun `Frozen gate blocks everything and queued work runs when execution resumes`() {
        val a = FakeSource("a")
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy())))
        h.gate.value = false
        h.visible.value = setOf(a.id)
        h.scheduler.manual(a.id)
        h.tick()
        assertEquals(0, a.calls)
        assertEquals(
            FetchPlan.WaitingFor(FetchTrigger.EXECUTION_RESUMED),
            h.scheduler.plans.value[a.id],
        )
        h.gate.value = true
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
            triggers = setOf(Trigger.VISIBLE, Trigger.HIGH_PRIORITY_WINDOW),
        )
        val h = Harness(listOf(SchedulerRow(a, policy)))

        h.visible.value = setOf(a.id)

        assertEquals(
            FetchPlan.FreshUntil(
                atWallMs = h.clock.wall + 15 * 60_000L,
                trigger = FetchTrigger.VISIBLE_OR_HIGH_PRIORITY_WINDOW,
            ),
            h.scheduler.plans.value[a.id],
        )
    }

    @Suppress("DEPRECATION")
    @Test
    fun `legacy priority trigger remains executable for one compatibility cycle`() {
        val a = FakeSource("legacy")
        val h = Harness(
            listOf(
                SchedulerRow(
                    a,
                    SourcePolicy(
                        ttl = 15.minutes,
                        triggers = setOf(Trigger.PHASE_PREFETCH),
                    ),
                ),
            ),
        )

        h.pulse()

        assertEquals(1, a.calls)
        assertEquals(FetchCause.HIGH_PRIORITY_WINDOW, a.requests.single().cause)
    }

    @Test
    fun `declared prerequisite blocks manual work and becomes visible in the plan`() {
        val a = FakeSource("a")
        var waitingForHome = true
        val policy = visiblePolicy().copy(
            blockedPlan = {
                if (waitingForHome) FetchPlan.WaitingFor(FetchTrigger.CONTEXT_READY) else null
            },
        )
        val h = Harness(listOf(SchedulerRow(a, policy)))

        h.visible.value = setOf(a.id)
        h.scheduler.manual(a.id)
        assertEquals(0, a.calls)
        assertEquals(
            FetchPlan.WaitingFor(FetchTrigger.CONTEXT_READY),
            h.scheduler.plans.value[a.id],
        )

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
        assertEquals("lastKnown", s.value)       // the host remembers what it knew
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
    fun `a served cache ages on the value's clock, not the attempt's`() {
        // The adapter answered with a 10-minute-old cache (valueAgeMs), so
        // with a 15-minute TTL the source must come due 5 minutes later —
        // NOT 15 minutes after the attempt that merely delivered it.
        val a = FakeSource("a")
        a.nextResult = FetchResult.Success("cached", valueAgeMs = 10 * 60_000L)
        val h = Harness(listOf(SchedulerRow(a, visiblePolicy(ttlMinutes = 15))))
        h.visible.value = setOf(a.id)
        assertEquals(1, a.calls)

        a.nextResult = FetchResult.Success("fresh")
        h.clock.advanceMinutes(6)
        h.tick()

        assertEquals("10 + 6 > 15: the served value's own age expired the TTL", 2, a.calls)
        val stamped = h.scheduler.state(a.id).value
        assertEquals("a genuinely fetched value is stamped at the attempt", h.clock.mono, stamped.fetchedAtMono)
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
    @Test
    fun `a network return re-attempts at once the sources whose last attempt failed offline`() {
        val offline = FakeSource("traffic").apply { nextResult = FetchResult.Failure(FetchError.Offline) }
        val broken = FakeSource("weather").apply { nextResult = FetchResult.Failure(FetchError.Timeout) }
        var heldUntil: Long? = null
        val held = FakeSource("aircraft").apply { nextResult = FetchResult.Failure(FetchError.Offline) }
        val h = Harness(
            listOf(
                SchedulerRow(offline, visiblePolicy()),
                SchedulerRow(broken, visiblePolicy()),
                SchedulerRow(held, visiblePolicy().copy(blockedPlan = { heldUntil?.let(FetchPlan::RetryAt) })),
            ),
            maxConcurrent = 3,
        )
        h.visible.value = setOf(offline.id, broken.id, held.id)
        h.clock.advanceSeconds(31); h.tick()
        assertEquals(2, offline.calls)            // second offline failure: the backoff is now 2 min
        assertEquals(2, broken.calls)
        assertEquals(2, held.calls)

        heldUntil = h.clock.wall + 60_000L        // the provider asked for a wait (429)
        h.clock.advanceSeconds(10)
        h.networkReturned()
        assertEquals("offline failure re-attempts at once, not after 2 min", 3, offline.calls)
        assertEquals(FetchCause.NETWORK_RETURN, offline.requests.last().cause)
        assertEquals("a failure that was not for lack of network keeps its backoff", 2, broken.calls)
        assertEquals("a provider wait still holds", 2, held.calls)

        offline.nextResult = FetchResult.Success("v")
        h.clock.advanceSeconds(20); h.tick()
        assertEquals("once: the re-attempt failed offline again, so it waits the first rung", 3, offline.calls)
        h.clock.advanceSeconds(11); h.tick()
        assertEquals(4, offline.calls)
        heldUntil = null
        h.tick()
        assertEquals("the held source runs when its wait ends, through the normal path", 3, held.calls)
    }
}
