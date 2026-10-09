package com.adelost.designkit.ui

import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Where a held card's frame starts, which way it turns and where it ends: what the wearer watches while the
 * gate is spent. A frame that ran anticlockwise, or started in a corner, would still "fill", so each case
 * names the place on the card the eye finds it.
 */
class CircleProgressOutlineTest {

    private val card = Size(200f, 100f)

    @Test
    fun `nothing is traced before the press has spent any of the gate`() {
        assertTrue(circleOutlineTrace(card, cornerPx = 20f, inset = 0f, fraction = 0f).pieces.isEmpty())
    }

    @Test
    fun `the frame starts at the top centre and runs right along the top`() {
        val trace = circleOutlineTrace(card, cornerPx = 20f, inset = 0f, fraction = 0.05f)
        assertEquals(Offset(100f, 0f), trace.start)
        val end = trace.pieces.last().end
        assertTrue("a twentieth in, the frame has moved right of the top centre, it is at $end", end.x > 100f)
        assertEquals(0f, end.y, 0.001f)
    }

    @Test
    fun `a quarter of the way it is coming down the right side`() {
        val end = circleOutlineTrace(card, cornerPx = 20f, inset = 0f, fraction = 0.25f).pieces.last().end
        assertEquals("a quarter in, the frame is on the right side", 200f, end.x, 0.001f)
        assertTrue("and between the two right corners, it is at $end", end.y in 20f..80f)
    }

    @Test
    fun `the whole gate closes the frame where it began`() {
        val trace = circleOutlineTrace(card, cornerPx = 20f, inset = 0f, fraction = 1f)
        val end = trace.pieces.last().end
        assertEquals(trace.start.x, end.x, 0.001f)
        assertEquals(trace.start.y, end.y, 0.001f)
    }

    @Test
    fun `a corner of half the shorter side traces a disc that is at its bottom halfway`() {
        // The same reading as the gesture's own ring, which runs from the top and is at the bottom at half.
        val end = circleOutlineTrace(Size(100f, 100f), cornerPx = 50f, inset = 0f, fraction = 0.5f).pieces.last().end
        assertEquals(50f, end.x, 0.01f)
        assertEquals(100f, end.y, 0.01f)
    }
}
