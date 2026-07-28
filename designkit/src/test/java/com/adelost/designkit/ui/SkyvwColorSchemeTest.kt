package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyvwColorSchemeTest {
    @Test
    fun `sea glass is the shipped mathematical default`() {
        assertEquals(SkyvwColorTheme.SEA_GLASS, SkyvwColorSchemes.default.theme)
        assertEquals(Color(0xFFA2D7D2), SkyvwColorSchemes.default.highlight)
        assertEquals(Color(0xFF79B8B4), SkyvwColorSchemes.default.active)
        assertEquals(Color(0xFF689693), SkyvwColorSchemes.default.supporting)
        assertEquals(Color(0xFF213E3C), SkyvwColorSchemes.default.container)
        assertEquals(Color(0xFF52706D), SkyvwColorSchemes.default.subdued)
    }

    @Test
    fun `every persisted theme resolves once with a distinct active pigment`() {
        assertEquals(SkyvwColorTheme.entries.size, SkyvwColorSchemes.all.size)
        assertEquals(
            SkyvwColorTheme.entries.toSet(),
            SkyvwColorSchemes.all.map { it.theme }.toSet(),
        )
        assertEquals(
            SkyvwColorSchemes.all.size,
            SkyvwColorSchemes.all.map { it.active }.distinct().size,
        )
        SkyvwColorTheme.entries.forEach { theme ->
            assertEquals(theme, SkyvwColorSchemes.resolve(theme).theme)
        }
    }

    @Test
    fun `persisted themes expose functional profiles instead of raw hue names`() {
        assertEquals("SEA GLASS", SkyvwColorTheme.SEA_GLASS.optionLabel)
        assertEquals("FLAT CYAN", SkyvwColorTheme.CYAN.optionLabel)
        assertEquals("MUTED", SkyvwColorTheme.STEEL.optionLabel)
        assertEquals("HIGH CONTRAST", SkyvwColorTheme.VIOLET.optionLabel)
        assertEquals(
            listOf("BALANCED", "CLEAN", "QUIET", "SUNLIGHT"),
            SkyvwColorTheme.entries.map { it.character },
        )
    }

    @Test
    fun `every theme has a brighter highlight and darker supporting roles`() {
        SkyvwColorSchemes.all.forEach { scheme ->
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
