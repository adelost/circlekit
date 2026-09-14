package com.adelost.designkit.ui

import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Mattias 2026-09-14: smaller row text, sized by calculation, still readable. */
class CircleGlanceLegibilityTest {
    @Test
    fun `row type is the smallest half-sp step that stays legible on the smallest watch`() {
        assertEquals(10.sp, MenuDesign.titleSize)
        assertEquals(11.sp, MenuDesign.titleSizeNoIcon)
        assertEquals(9.sp, MenuDesign.subSize)

        val legibility = CircleGlanceLegibility
        val title = MenuDesign.titleSize.value
        val value = MenuDesign.subSize.value
        val titleFloor = legibility.TITLE_CAP_HEIGHT_ARCMIN * legibility.RENDERING_MARGIN
        val valueFloor = legibility.VALUE_X_HEIGHT_ARCMIN * legibility.RENDERING_MARGIN
        assertTrue(legibility.letterArcmin(title, legibility.CAP_HEIGHT_EM) >= titleFloor)
        assertTrue(legibility.letterArcmin(value, legibility.X_HEIGHT_EM) >= valueFloor)
        // Optimal, not merely safe: one step smaller would miss the floor.
        assertTrue(legibility.letterArcmin(title - legibility.SP_STEP, legibility.CAP_HEIGHT_EM) < titleFloor)
        assertTrue(legibility.letterArcmin(value - legibility.SP_STEP, legibility.X_HEIGHT_EM) < valueFloor)
    }

    @Test
    fun `a larger face only makes the same canvas letters larger`() {
        // 11 sp on the 1.2 in face: 14.1' cap height, as documented.
        assertEquals(14.15f, CircleGlanceLegibility.letterArcmin(11f, CircleGlanceLegibility.CAP_HEIGHT_EM), 0.05f)
    }
}
