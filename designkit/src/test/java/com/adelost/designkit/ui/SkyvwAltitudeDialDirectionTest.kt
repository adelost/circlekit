package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyvwAltitudeDialDirectionTest {
    @Test
    fun `clock is the shared default and altimeter remains explicit`() {
        assertEquals("ALTIMETER", SkyvwAltitudeDialDirection.ALTIMETER.optionLabel)
        assertEquals("CLOCK", SkyvwAltitudeDialDirection.CLOCK.optionLabel)
        assertEquals(SkyvwAltitudeDialDirection.CLOCK, SkyvwAltitudeDialDirection.DEFAULT)
        assertEquals(
            SkyvwAltitudeDialDirection.CLOCK,
            SkyvwInstrumentDialSpec(
                altitude = com.adelost.designkit.measurement.MeasurementText("1", "m"),
                motionLabel = "",
                altitudeColor = androidx.compose.ui.graphics.Color.White,
            ).altitudeDialDirection,
        )
    }

    @Test
    fun `same segment data travels counter clockwise in altimeter and clockwise in clock mode`() {
        val altimeter = skyvwAltitudeDialArc(0, 12, 0.5f, false, SkyvwAltitudeDialDirection.ALTIMETER)
        val clock = skyvwAltitudeDialArc(0, 12, 0.5f, false, SkyvwAltitudeDialDirection.CLOCK)

        assertTrue(altimeter.sweepAngleDeg < 0f)
        assertTrue(clock.sweepAngleDeg > 0f)
        assertEquals(kotlin.math.abs(clock.sweepAngleDeg), kotlin.math.abs(altimeter.sweepAngleDeg), 0.0001f)
        assertEquals(-90f, (altimeter.startAngleDeg + clock.startAngleDeg) / 2f, 0.0001f)
    }

    @Test
    fun `fill origin follows the selected direction without changing progress`() {
        for (direction in SkyvwAltitudeDialDirection.entries) {
            val fromStart = skyvwAltitudeDialArc(4, 12, 0.25f, true, direction)
            val fromEnd = skyvwAltitudeDialArc(4, 12, 0.25f, false, direction)
            assertEquals(kotlin.math.abs(fromStart.sweepAngleDeg), kotlin.math.abs(fromEnd.sweepAngleDeg), 0.0001f)
            assertTrue(fromStart.startAngleDeg != fromEnd.startAngleDeg)
        }
    }
}
