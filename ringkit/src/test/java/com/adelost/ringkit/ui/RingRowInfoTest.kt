package com.adelost.ringkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class RingRowInfoTest {
    @Test
    fun `only the most recently touched explainable row owns the info affordance`() {
        val first = nextRingRowInfoSelection(
            current = RingRowInfoSelection(),
            touchedRowKey = "units",
            hasExplanation = true,
        )
        val unchanged = nextRingRowInfoSelection(first, "units", hasExplanation = true)
        val moved = nextRingRowInfoSelection(first, "precision", hasExplanation = true)

        assertEquals("units", first.selectedRowKey)
        assertSame(first, unchanged)
        assertEquals("precision", moved.selectedRowKey)
    }

    @Test
    fun `touching a row without explanation removes the transient affordance`() {
        val selected = RingRowInfoSelection("units")

        assertEquals(
            null,
            nextRingRowInfoSelection(selected, "separator", hasExplanation = false).selectedRowKey,
        )
    }

}
