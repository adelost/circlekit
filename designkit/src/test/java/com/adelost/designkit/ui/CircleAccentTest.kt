package com.adelost.designkit.ui

import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleAccentTest {
    @Test
    fun `the supporting and inactive tones are quieter than the strong one`() {
        val palette = CircleAccentPalette.Default
        CircleAccent.entries.forEach { accent ->
            val active = palette.color(accent, CircleAccentStrength.ACTIVE).luminance()
            val supporting = palette.color(accent, CircleAccentStrength.SUPPORTING).luminance()
            val inactive = palette.color(accent, CircleAccentStrength.INACTIVE).luminance()

            assertTrue("$accent supporting", supporting < active)
            assertTrue("$accent inactive", inactive < active)
        }
        assertNotEquals(palette.color(CircleAccent.SUN), palette.color(CircleAccent.RAIN))
    }

    @Test
    fun `generic icon catalog defaults to warm-white neutral actions`() {
        RING_ICON_CATALOG.forEach { icon ->
            assertEquals(icon.name, CircleAccent.NEUTRAL, ringIconAccent(icon))
        }
        assertEquals(CircleStyleTokens.Action, CircleAccentPalette.Default.color(CircleAccent.NEUTRAL))
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
