package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleAccentTest {
    @Test
    fun `semantic strength stays ordered without changing identity`() {
        CircleAccent.entries.forEach { accent ->
            val active = circleAccentColor(accent, CircleAccentStrength.ACTIVE)
            val supporting = circleAccentColor(accent, CircleAccentStrength.SUPPORTING)
            val inactive = circleAccentColor(accent, CircleAccentStrength.INACTIVE)

            assertTrue("$accent supporting", supporting.alpha <= active.alpha)
            assertTrue("$accent inactive", inactive.alpha <= supporting.alpha)
        }
        assertNotEquals(
            circleAccentColor(CircleAccent.SUN),
            circleAccentColor(CircleAccent.RAIN),
        )
    }

    @Test
    fun `ring icon catalog owns recognizable defaults`() {
        assertEquals(CircleAccent.SUN, ringIconAccent(RingIcons.Sun))
        assertEquals(CircleAccent.SKY, ringIconAccent(RingIcons.Map))
        assertEquals(CircleAccent.ACHIEVEMENT, ringIconAccent(RingIcons.Book))
        assertEquals(CircleAccent.DANGER, ringIconAccent(RingIcons.Storm))
        assertEquals(CircleAccent.DANGER, ringIconAccent(RingIcons.Trash))
        assertEquals(CircleAccent.POSITIVE, ringIconAccent(RingIcons.Check))
        assertEquals(CircleAccent.CAUTION, ringIconAccent(RingIcons.Warning))
        assertEquals(CircleAccent.VIOLET, ringIconAccent(RingIcons.Pencil))
        assertEquals(CircleAccent.NEUTRAL, ringIconAccent(null))
    }

    @Test
    fun `jump debrief icons get semantic colour from the shared catalog`() {
        assertEquals(CircleAccent.SKY, ringIconAccent(RingIcons.GroundTrack))
        assertEquals(CircleAccent.VIOLET, ringIconAccent(RingIcons.SpatialPath))
        assertEquals(CircleAccent.RAIN, ringIconAccent(RingIcons.SinkRate))
        assertEquals(CircleAccent.POSITIVE, ringIconAccent(RingIcons.GpsPoints))
        assertEquals(CircleAccent.CAUTION, ringIconAccent(RingIcons.GpsBreak))
        assertEquals(CircleAccent.POSITIVE, ringIconAccent(RingIcons.TouchdownRun))
        assertEquals(CircleAccent.RAIN, ringIconAccent(RingIcons.TouchdownSink))
        assertEquals(CircleAccent.SKY, ringIconAccent(RingIcons.Yaw))
        assertEquals(CircleAccent.ACHIEVEMENT, ringIconAccent(RingIcons.Pitch))
        assertEquals(CircleAccent.VIOLET, ringIconAccent(RingIcons.Roll))
        assertEquals(CircleAccent.CAUTION, ringIconAccent(RingIcons.RotationRate))
    }

    @Test
    fun `composite weather styles keep semantic colours per layer`() {
        assertEquals(
            listOf(CircleAccent.SUN, CircleAccent.CLOUD),
            ringIconStyle(RingIcons.CloudSun).layers.map { it.accent },
        )
        assertEquals(
            listOf(CircleAccent.CLOUD, CircleAccent.RAIN),
            ringIconStyle(RingIcons.Rain).layers.map { it.accent },
        )
        assertEquals(
            listOf(CircleAccent.CLOUD, CircleAccent.DANGER),
            ringIconStyle(RingIcons.Storm).layers.map { it.accent },
        )
    }

    @Test
    fun `weather symbols resolve through the central icon style catalog`() {
        val expected = mapOf(
            CircleWeatherSymbol.UNKNOWN to listOf(CircleAccent.NEUTRAL),
            CircleWeatherSymbol.CLEAR to listOf(CircleAccent.SUN),
            CircleWeatherSymbol.PARTLY_CLOUDY to listOf(CircleAccent.SUN, CircleAccent.CLOUD),
            CircleWeatherSymbol.CLOUDY to listOf(CircleAccent.CLOUD),
            CircleWeatherSymbol.FOG to listOf(CircleAccent.CLOUD),
            CircleWeatherSymbol.RAIN to listOf(CircleAccent.CLOUD, CircleAccent.RAIN),
            CircleWeatherSymbol.SNOW to listOf(CircleAccent.COLD),
            CircleWeatherSymbol.STORM to listOf(CircleAccent.CLOUD, CircleAccent.DANGER),
        )

        expected.forEach { (symbol, accents) ->
            assertEquals(symbol.name, accents, circleWeatherIconStyle(symbol).layers.map { it.accent })
        }
    }

    @Test
    fun `explicit accent can intentionally make a composite icon monochrome`() {
        val style = ringIconStyle(RingIcons.CloudSun, accentOverride = CircleAccent.POSITIVE)

        assertEquals(1, style.layers.size)
        assertEquals(RingIcons.CloudSun, style.layers.single().icon)
        assertEquals(CircleAccent.POSITIVE, style.layers.single().accent)
    }
}
