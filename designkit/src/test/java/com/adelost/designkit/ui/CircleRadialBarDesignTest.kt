package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class CircleRadialBarDesignTest {
    @Test
    fun `dial and intro resolve the same short-side stroke proportion`() {
        assertEquals(6.75f, CircleRadialBarDesign.CanonicalInstrumentStrokeDp, 0f)
        assertEquals(11.25f, CircleRadialBarDesign.strokeForShortSide(320f), 0f)
        assertEquals(
            CircleRadialBarDesign.StrokeFractionOfShortSide,
            CircleRadialBarDesign.CanonicalInstrumentStrokeDp /
                CircleUiProfiles.CANON_ROUND_CANVAS_DP,
            0f,
        )
        assertEquals(
            CircleRadialBarDesign.StrokeFractionOfShortSide,
            CircleRadialBarDesign.strokeForShortSide(320f) / 320f,
            0f,
        )
    }
}
