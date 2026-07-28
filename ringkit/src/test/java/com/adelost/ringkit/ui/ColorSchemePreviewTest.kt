package com.adelost.ringkit.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class ColorSchemePreviewTest {
    @Test
    fun `scrubber clamps and quantizes to useful fifty metre steps`() {
        assertEquals(0f, previewAltitudeAtFraction(-1f, 8_000f))
        assertEquals(4_000f, previewAltitudeAtFraction(0.5f, 8_000f))
        assertEquals(8_000f, previewAltitudeAtFraction(2f, 8_000f))
        assertEquals(1_250f, previewAltitudeAtFraction(0.157f, 8_000f))
    }

    @Test
    fun `preview is brief but scales with selected start altitude`() {
        assertEquals(12_000, colorPreviewDurationMs(8_000f, 8_000f))
        assertEquals(6_000, colorPreviewDurationMs(4_000f, 8_000f))
        assertEquals(3_000, colorPreviewDurationMs(500f, 8_000f))
    }
}
