package com.adelost.designkit.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * skyvw:0 row 52: the dashed "suggested" ring is a CircleKit parameter, not a
 * product's own drawing. A dash that silently becomes solid is exactly the
 * failure a colour-only reading cannot show, so the lengths are pinned here.
 */
class CircleSuggestedContourTest {
    @Test
    fun `a suggested contour is dashed with the shared mark and gap`() {
        assertEquals(listOf(MenuDesign.suggestedDashOn, MenuDesign.suggestedDashOff), circleSuggestedDashLengths(true))
        assertTrue("a dash needs a visible mark", MenuDesign.suggestedDashOn > 0.dp)
        assertTrue("a dash needs a visible gap", MenuDesign.suggestedDashOff > 0.dp)
    }

    @Test
    fun `an ordinary contour asks for no dash at all, so it draws solid`() {
        assertEquals(emptyList<Any>(), circleSuggestedDashLengths(false))
    }
}
