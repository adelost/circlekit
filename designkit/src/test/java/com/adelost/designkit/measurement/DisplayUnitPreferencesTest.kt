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

    @Test
    fun `the default distance ladder is untouched by the precision parameter`() {
        // EVERY existing caller in every product passes nothing. If this drifts,
        // Agentmux Link and Showcase render differently for a change neither
        // asked for.
        val metric = DisplayUnitPreferences()
        val imperial = DisplayUnitPreferences(distance = DistanceDisplayUnit.IMPERIAL)

        assertEquals("850 m", metric.formatDistance(850f).spaced())
        assertEquals("1.5 km", metric.formatDistance(1_520f).spaced())
        assertEquals("12 km", metric.formatDistance(12_340f).spaced())
        assertEquals("328 ft", imperial.formatDistance(100f).spaced())
        assertEquals("1.0 mi", imperial.formatDistance(1_609.344f).spaced())
    }

    @Test
    fun `a host may state the decimals its long form keeps`() {
        // Mattias 2026-08-06 on the distance readout: "kanske distans skulle
        // visa distans pa nagot smart satt med antingen meter eller kilometer
        // om det blir langt ... och da kanske att den bara kan visa tva
        // decimaltal." The metre/km graduation already existed; the steady
        // precision did not.
        val metric = DisplayUnitPreferences()

        assertEquals("1.52 km", metric.formatDistance(1_520f, longFormDecimals = 2).spaced())
        assertEquals("12.34 km", metric.formatDistance(12_340f, longFormDecimals = 2).spaced())
        assertEquals("2 km", metric.formatDistance(1_520f, longFormDecimals = 0).spaced())
    }

    @Test
    fun `the metre form takes no decimals at any setting`() {
        // A tenth of a metre is below what a horizontal fix resolves, so the
        // parameter must not leak into the short form as "850.00 m".
        val metric = DisplayUnitPreferences()
        val imperial = DisplayUnitPreferences(distance = DistanceDisplayUnit.IMPERIAL)

        assertEquals("850 m", metric.formatDistance(850f, longFormDecimals = 2).spaced())
        assertEquals("328 ft", imperial.formatDistance(100f, longFormDecimals = 2).spaced())
    }
}
