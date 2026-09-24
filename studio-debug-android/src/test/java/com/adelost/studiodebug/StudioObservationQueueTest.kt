package com.adelost.studiodebug

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StudioObservationQueueTest {
    @Test
    fun fullQueueReportsTheExactLostRangeBeforeLaterEvents() {
        val queue = StudioObservationQueue(maxEvents = 2, maxBytes = 100)
        queue.offer("{\"kind\":\"decision\"}", 10L)
        queue.offer("{\"kind\":\"decision\"}", 11L)
        queue.offer("{\"kind\":\"decision\"}", 12L)
        queue.offer("{\"kind\":\"decision\"}", 13L)
        val first = queue.take()
        assertEquals(listOf(0, 1, 2), first.map { it.from })
        assertEquals(3, first.last().to)
        assertTrue(first.last() is StudioObservationQueue.Loss)
        queue.offer("{\"kind\":\"port\"}", 14L)
        assertEquals(4, queue.take().single().from)
        assertTrue(queue.isEmpty())
    }
}
