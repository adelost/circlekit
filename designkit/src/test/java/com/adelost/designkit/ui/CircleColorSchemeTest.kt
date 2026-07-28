package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleColorSchemeTest {
    @Test
    fun `sea glass is the shipped mathematical default`() {
        assertEquals(CircleColorTheme.SEA_GLASS, CircleColorSchemes.default.theme)
        assertEquals(Color(0xFFA2D7D2), CircleColorSchemes.default.highlight)
        assertEquals(Color(0xFF79B8B4), CircleColorSchemes.default.active)
        assertEquals(Color(0xFF689693), CircleColorSchemes.default.supporting)
        assertEquals(Color(0xFF213E3C), CircleColorSchemes.default.container)
        assertEquals(Color(0xFF52706D), CircleColorSchemes.default.subdued)
    }

    @Test
    fun `every persisted theme resolves once with a distinct active pigment`() {
        assertEquals(CircleColorTheme.entries.size, CircleColorSchemes.all.size)
        assertEquals(
            CircleColorTheme.entries.toSet(),
            CircleColorSchemes.all.map { it.theme }.toSet(),
        )
        assertEquals(
            CircleColorSchemes.all.size,
            CircleColorSchemes.all.map { it.active }.distinct().size,
        )
        CircleColorTheme.entries.forEach { theme ->
            assertEquals(theme, CircleColorSchemes.resolve(theme).theme)
        }
    }

    @Test
    fun `persisted themes expose functional profiles instead of raw hue names`() {
        assertEquals("SEA GLASS", CircleColorTheme.SEA_GLASS.optionLabel)
        assertEquals("FLAT CYAN", CircleColorTheme.CYAN.optionLabel)
        assertEquals("MUTED", CircleColorTheme.STEEL.optionLabel)
        assertEquals("HIGH CONTRAST", CircleColorTheme.VIOLET.optionLabel)
        assertEquals(
            listOf("BALANCED", "CLEAN", "QUIET", "SUNLIGHT"),
            CircleColorTheme.entries.map { it.character },
        )
    }

    @Test
    fun `every theme has a brighter highlight and darker supporting roles`() {
        CircleColorSchemes.all.forEach { scheme ->
            val highlight = scheme.highlight.luminance()
            val active = scheme.active.luminance()
            val supporting = scheme.supporting.luminance()
            val container = scheme.container.luminance()
            assertTrue("${scheme.theme} highlight", highlight > active)
            assertTrue("${scheme.theme} supporting", active > supporting)
            assertTrue("${scheme.theme} container", supporting > container)
        }
    }
}
