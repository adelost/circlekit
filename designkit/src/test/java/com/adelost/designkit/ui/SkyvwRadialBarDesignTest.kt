package com.adelost.designkit.ui

import com.adelost.designkit.measurement.MeasurementText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
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

    @Test
    fun `bar weight is one validated instrument input`() {
        val spec = SkyvwInstrumentDialSpec(
            altitude = MeasurementText("1000", "m"),
            motionLabel = "GROUND",
            altitudeColor = androidx.compose.ui.graphics.Color.White,
            barWeightScale = 1.4f,
        )

        assertEquals(1.4f, spec.barWeightScale, 0f)
        assertThrows(IllegalArgumentException::class.java) {
            spec.copy(barWeightScale = 0f)
        }
    }
}
