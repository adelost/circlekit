package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class SkyvwRadialBarDesignTest {
    @Test
    fun `dial and intro resolve the same short-side stroke proportion`() {
        assertEquals(6.75f, SkyvwRadialBarDesign.CanonicalInstrumentStrokeDp, 0f)
        assertEquals(11.25f, SkyvwRadialBarDesign.strokeForShortSide(320f), 0f)
        assertEquals(
            SkyvwRadialBarDesign.StrokeFractionOfShortSide,
            SkyvwRadialBarDesign.CanonicalInstrumentStrokeDp /
                SkyvwUiProfiles.CANON_ROUND_CANVAS_DP,
            0f,
        )
        assertEquals(
            SkyvwRadialBarDesign.StrokeFractionOfShortSide,
            SkyvwRadialBarDesign.strokeForShortSide(320f) / 320f,
            0f,
        )
    }
}
