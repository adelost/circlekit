package com.adelost.designkit.measurement

import org.junit.Assert.assertEquals
import org.junit.Test

class DisplayUnitPreferencesTest {
    @Test
    fun `metric is the backward-compatible default`() {
        val units = DisplayUnitPreferences()

        assertEquals(AltitudeDisplayUnit.METRES, units.altitude)
        assertEquals(DistanceDisplayUnit.METRIC, units.distance)
        assertEquals("1.7 km", units.formatAltitudeCompact(1_700f).spaced())
        assertEquals("1.6 km", units.formatDistance(1_609.344f).spaced())
        assertEquals("49.8 m/s", units.formatVerticalSpeed(49.8f).spaced())
        assertEquals("10.0 m/s", units.formatHorizontalSpeed(10f).spaced())
    }

    @Test
    fun `altitude and horizontal distance systems are independent`() {
        val norwegianStyle = DisplayUnitPreferences(
            altitude = AltitudeDisplayUnit.FEET,
            distance = DistanceDisplayUnit.METRIC,
        )

        assertEquals("5.6 kft", norwegianStyle.formatAltitudeCompact(1_700f).spaced())
        assertEquals("4921 ft", norwegianStyle.formatAltitude(1_500f).spaced())
        assertEquals("1.6 km", norwegianStyle.formatDistance(1_609.344f).spaced())
        assertEquals("49.8 m/s", norwegianStyle.formatVerticalSpeed(49.8f).spaced())
        assertEquals("10.0 m/s", norwegianStyle.formatHorizontalSpeed(10f).spaced())
    }

    @Test
    fun `imperial distance uses feet and miles without changing SI speed`() {
        val mixed = DisplayUnitPreferences(
            altitude = AltitudeDisplayUnit.METRES,
            distance = DistanceDisplayUnit.IMPERIAL,
        )

        assertEquals("1700 m", mixed.formatAltitude(1_700f).spaced())
        assertEquals("1.0 mi", mixed.formatDistance(1_609.344f).spaced())
        assertEquals("328 ft", mixed.formatDistance(100f).spaced())
        assertEquals("10.0 m/s", mixed.formatHorizontalSpeed(10f).spaced())
        assertEquals("49.8 m/s", mixed.formatVerticalSpeed(49.8f).spaced())
    }

    @Test
    fun `dial keeps exact ordinary altitude units across the freefall range`() {
        val metric = DisplayUnitPreferences()
        val feet = DisplayUnitPreferences(altitude = AltitudeDisplayUnit.FEET)

        assertEquals(MeasurementText("3549", "m"), metric.formatDialAltitude(3_549f))
        assertEquals(MeasurementText("12345", "m"), metric.formatDialAltitude(12_345f))
        assertEquals(MeasurementText("13123", "ft"), feet.formatDialAltitude(4_000f))
        assertEquals(MeasurementText("4921", "ft"), feet.formatDialAltitude(1_500f))
    }

    @Test
    fun `metric dial decimal returns below a three digit display magnitude without phase state`() {
        val metric = DisplayUnitPreferences()

        assertEquals(MeasurementText("1500", "m"), metric.formatDialAltitude(1_500f))
        assertEquals(MeasurementText("1000", "m"), metric.formatDialAltitude(1_000f))
        assertEquals(MeasurementText("999.4", "m"), metric.formatDialAltitude(999.4f))
        assertEquals(MeasurementText("99.4", "m"), metric.formatDialAltitude(99.4f))
        assertEquals(MeasurementText("0.0", "m"), metric.formatDialAltitude(0f))
    }

    @Test
    fun `feet dial never claims fractional-foot precision`() {
        val feet = DisplayUnitPreferences(altitude = AltitudeDisplayUnit.FEET)

        assertEquals(MeasurementText("1001", "ft"), feet.formatDialAltitude(305f))
        assertEquals(MeasurementText("999", "ft"), feet.formatDialAltitude(304.5f))
        assertEquals(MeasurementText("1", "ft"), feet.formatDialAltitude(0.3048f))
        assertEquals(MeasurementText("0", "ft"), feet.formatDialAltitude(0f))
    }

    @Test
    fun `unknown persisted values fail closed to metric defaults`() {
        assertEquals(
            DisplayUnitPreferences(),
            DisplayUnitPreferences.fromStoredNames("YARDS", "NAUTICAL"),
        )
        assertEquals(
            DisplayUnitPreferences(altitude = AltitudeDisplayUnit.FEET),
            DisplayUnitPreferences.fromStoredNames("FEET", null),
        )
    }
}
