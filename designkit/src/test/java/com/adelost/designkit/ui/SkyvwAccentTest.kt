package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyvwAccentTest {
    @Test
    fun `semantic strength stays ordered without changing identity`() {
        SkyvwAccent.entries.forEach { accent ->
            val active = skyvwAccentColor(accent, SkyvwAccentStrength.ACTIVE)
            val supporting = skyvwAccentColor(accent, SkyvwAccentStrength.SUPPORTING)
            val inactive = skyvwAccentColor(accent, SkyvwAccentStrength.INACTIVE)

            assertTrue("$accent supporting", supporting.alpha <= active.alpha)
            assertTrue("$accent inactive", inactive.alpha <= supporting.alpha)
        }
        assertNotEquals(
            skyvwAccentColor(SkyvwAccent.SUN),
            skyvwAccentColor(SkyvwAccent.RAIN),
        )
    }

    @Test
    fun `ring icon catalog owns recognizable defaults`() {
        assertEquals(SkyvwAccent.SUN, ringIconAccent(RingIcons.Sun))
        assertEquals(SkyvwAccent.SKY, ringIconAccent(RingIcons.Map))
        assertEquals(SkyvwAccent.ACHIEVEMENT, ringIconAccent(RingIcons.Book))
        assertEquals(SkyvwAccent.DANGER, ringIconAccent(RingIcons.Storm))
        assertEquals(SkyvwAccent.DANGER, ringIconAccent(RingIcons.Trash))
        assertEquals(SkyvwAccent.POSITIVE, ringIconAccent(RingIcons.Check))
        assertEquals(SkyvwAccent.CAUTION, ringIconAccent(RingIcons.Warning))
        assertEquals(SkyvwAccent.VIOLET, ringIconAccent(RingIcons.Pencil))
        assertEquals(SkyvwAccent.NEUTRAL, ringIconAccent(null))
    }

    @Test
    fun `jump debrief icons get semantic colour from the shared catalog`() {
        assertEquals(SkyvwAccent.SKY, ringIconAccent(RingIcons.GroundTrack))
        assertEquals(SkyvwAccent.VIOLET, ringIconAccent(RingIcons.SpatialPath))
        assertEquals(SkyvwAccent.RAIN, ringIconAccent(RingIcons.SinkRate))
        assertEquals(SkyvwAccent.POSITIVE, ringIconAccent(RingIcons.GpsPoints))
        assertEquals(SkyvwAccent.CAUTION, ringIconAccent(RingIcons.GpsBreak))
        assertEquals(SkyvwAccent.POSITIVE, ringIconAccent(RingIcons.TouchdownRun))
        assertEquals(SkyvwAccent.RAIN, ringIconAccent(RingIcons.TouchdownSink))
        assertEquals(SkyvwAccent.SKY, ringIconAccent(RingIcons.Yaw))
        assertEquals(SkyvwAccent.ACHIEVEMENT, ringIconAccent(RingIcons.Pitch))
        assertEquals(SkyvwAccent.VIOLET, ringIconAccent(RingIcons.Roll))
        assertEquals(SkyvwAccent.CAUTION, ringIconAccent(RingIcons.RotationRate))
    }

    @Test
    fun `composite weather styles keep semantic colours per layer`() {
        assertEquals(
            listOf(SkyvwAccent.SUN, SkyvwAccent.CLOUD),
            ringIconStyle(RingIcons.CloudSun).layers.map { it.accent },
        )
        assertEquals(
            listOf(SkyvwAccent.CLOUD, SkyvwAccent.RAIN),
            ringIconStyle(RingIcons.Rain).layers.map { it.accent },
        )
        assertEquals(
            listOf(SkyvwAccent.CLOUD, SkyvwAccent.DANGER),
            ringIconStyle(RingIcons.Storm).layers.map { it.accent },
        )
    }

    @Test
    fun `weather symbols resolve through the central icon style catalog`() {
        val expected = mapOf(
            SkyvwWeatherSymbol.UNKNOWN to listOf(SkyvwAccent.NEUTRAL),
            SkyvwWeatherSymbol.CLEAR to listOf(SkyvwAccent.SUN),
            SkyvwWeatherSymbol.PARTLY_CLOUDY to listOf(SkyvwAccent.SUN, SkyvwAccent.CLOUD),
            SkyvwWeatherSymbol.CLOUDY to listOf(SkyvwAccent.CLOUD),
            SkyvwWeatherSymbol.FOG to listOf(SkyvwAccent.CLOUD),
            SkyvwWeatherSymbol.RAIN to listOf(SkyvwAccent.CLOUD, SkyvwAccent.RAIN),
            SkyvwWeatherSymbol.SNOW to listOf(SkyvwAccent.COLD),
            SkyvwWeatherSymbol.STORM to listOf(SkyvwAccent.CLOUD, SkyvwAccent.DANGER),
        )

        expected.forEach { (symbol, accents) ->
            assertEquals(symbol.name, accents, skyvwWeatherIconStyle(symbol).layers.map { it.accent })
        }
    }

    @Test
    fun `explicit accent can intentionally make a composite icon monochrome`() {
        val style = ringIconStyle(RingIcons.CloudSun, accentOverride = SkyvwAccent.POSITIVE)

        assertEquals(1, style.layers.size)
        assertEquals(RingIcons.CloudSun, style.layers.single().icon)
        assertEquals(SkyvwAccent.POSITIVE, style.layers.single().accent)
    }
}
