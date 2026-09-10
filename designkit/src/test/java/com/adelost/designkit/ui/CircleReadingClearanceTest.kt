package com.adelost.designkit.ui

import androidx.compose.ui.geometry.Rect
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleReadingClearanceTest {
    private val back = listOf(CircleChromeSlot.HOUR_9)

    @Test fun `empty paragraph corners do not displace its centred ink`() {
        val name = listOf(Rect(20f, 50f, 172f, 64f), Rect(65f, 64f, 127f, 78f))
        assertEquals(0f, readingInkShiftDp(192f, 192f, name, back)!!, .001f)
        assertEquals(0f, readingInkShiftDp(192f, 192f,
            listOf(Rect(65f, 90f, 127f, 103f)), back)!!, .001f)
    }

    @Test fun `a conflicting line takes the nearest translation and retains every glyph`() {
        val line = Rect(35f, 90f, 145f, 103f)
        val shift = readingInkShiftDp(192f, 192f, listOf(line), back)!!
        assertTrue(shift > 0f && shift < 20f)
        val rightOfHit = 192f / 2f * (1f - RadialChromeDesign.slotRadiusFraction) +
            MenuDesign.backTouchTarget.value / 2f + ROUND_SAFE_CONTENT_GAP_DP
        assertEquals(rightOfHit, line.left + shift, .001f)
        assertTrue(line.right + shift <= 192f)
    }

    @Test fun `too wide ink requests the measured wrapping fallback instead of clipping`() {
        assertNull(readingInkShiftDp(192f, 192f, listOf(Rect(10f, 88f, 182f, 104f)), back))
        assertEquals(0f, readingInkShiftDp(192f, 192f,
            listOf(Rect(10f, 130f, 182f, 145f)), back)!!, .001f)
    }
}
