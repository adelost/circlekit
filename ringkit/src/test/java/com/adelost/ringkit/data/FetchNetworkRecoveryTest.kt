package com.adelost.ringkit.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FetchNetworkRecoveryTest {
    @Test
    fun `hiding a cancelled recovery keeps its replacement pending until the consumer returns`() {
        val source = FakeSource("tiles")
        val h = Harness(listOf(SchedulerRow(source, visiblePolicy().copy(cancelOnHide = true))))
        h.visible.value = setOf(source.id)
        source.nextResult = FetchResult.Failure(FetchError.Offline)
        h.scheduler.manual(source.id)
        source.pendingMode = true
        h.networkReturned()

        h.visible.value = emptySet()
        assertFalse(h.scheduler.state(source.id).value.inFlight)
        h.visible.value = setOf(source.id)

        assertEquals("cancellation must not lose recovery while the kept cache is fresh", 4, source.calls)
        source.pending!!.complete(FetchResult.Success("replacement"))
        assertEquals("replacement", h.scheduler.state(source.id).value.value)
        h.scope.coroutineContext[kotlinx.coroutines.Job]!!.cancel()
    }

    @Test
    fun `a failed refresh retries after reconnect even when the kept value is fresh`() {
        val source = FakeSource("weather")
        val h = Harness(listOf(SchedulerRow(source, visiblePolicy())))
        h.visible.value = setOf(source.id)
        val originalStamp = h.scheduler.state(source.id).value.fetchedAtMono
        source.nextResult = FetchResult.Failure(FetchError.Offline)
        h.clock.advanceSeconds(10)
        h.scheduler.manual(source.id)
        assertEquals(originalStamp, h.scheduler.state(source.id).value.fetchedAtMono)

        source.pendingMode = true
        h.networkReturned()

        assertEquals("a failed manual refresh needs a real replacement, not a new TTL", 3, source.calls)
        assertTrue(source.requests.last().forceNetwork)
        assertEquals(originalStamp, h.scheduler.state(source.id).value.fetchedAtMono)
        source.pending!!.complete(FetchResult.Success("recovered"))
        assertEquals("recovered", h.scheduler.state(source.id).value.value)
        h.scope.coroutineContext[kotlinx.coroutines.Job]!!.cancel()
    }

    @Test
    fun `a failure arriving after reconnect gets one recovery attempt and cannot restore the old wait`() {
        val source = FakeSource("weather").apply { pendingMode = true }
        val h = Harness(listOf(SchedulerRow(source, visiblePolicy())))
        h.visible.value = setOf(source.id)
        val offlineAttempt = source.pending!!
        h.networkReturned()
        assertEquals("do not duplicate the attempt still in flight", 1, source.calls)

        offlineAttempt.complete(FetchResult.Failure(FetchError.Offline))

        assertEquals("the old connection's late failure must not reinstate backoff", 2, source.calls)
        assertTrue(h.scheduler.state(source.id).value.inFlight)
        source.pending!!.complete(FetchResult.Failure(FetchError.Offline))
        h.tick()
        assertEquals("one recovery attempt, no retry loop", 2, source.calls)
        assertFalse(h.scheduler.state(source.id).value.inFlight)
        assertTrue(h.scheduler.plans.value[source.id] is FetchPlan.RetryAt)
        h.scope.coroutineContext[kotlinx.coroutines.Job]!!.cancel()
    }

    @Test
    fun `recovery waits for visibility execution and provider permission without losing the request`() {
        val source = FakeSource("traffic").apply { nextResult = FetchResult.Failure(FetchError.Offline) }
        var hold: FetchPlan? = null
        val h = Harness(listOf(SchedulerRow(source, visiblePolicy().copy(blockedPlan = { hold }))))
        h.visible.value = setOf(source.id)
        h.visible.value = emptySet()
        h.gate.value = false
        hold = FetchPlan.RetryAt(h.clock.wall + 60_000L)
        h.networkReturned()
        source.nextResult = FetchResult.Success("recovered")

        h.gate.value = true
        h.visible.value = setOf(source.id)
        h.scheduler.manual(source.id)
        assertEquals("even a manual request cannot override provider 429", 1, source.calls)
        h.visible.value = emptySet()
        hold = null
        h.tick()
        // The explicit manual request may run without a visible consumer.
        assertEquals(2, source.calls)
        h.visible.value = setOf(source.id)
        assertEquals("the completed manual attempt also satisfies recovery", 2, source.calls)
        h.scope.coroutineContext[kotlinx.coroutines.Job]!!.cancel()
    }
}
