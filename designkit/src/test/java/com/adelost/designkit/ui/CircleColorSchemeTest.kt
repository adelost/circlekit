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

    /**
     * The default band table is the pigment a product consumes across the repo
     * boundary, and a product pins an immutable version: moving a cell here
     * moves that product's dial on its next bump. Spelled out so that a change
     * is a decision about the pixels rather than an edit nobody reads.
     */
    @Test
    fun `the default band table is the pigment products consume`() {
        val expected = mapOf(
            //                            REST                  ACTIVE
            CircleAltitudeBand.BLUE to (Color(0xFF2F6F92) to Color(0xFF38BDF8)),
            CircleAltitudeBand.GREEN to (Color(0xFF34C36B) to Color(0xFF34C36B)),
            CircleAltitudeBand.AMBER to (Color(0xFF836829) to Color(0xFFF4C542)),
            CircleAltitudeBand.RED to (Color(0xFF7F3336) to Color(0xFFEF5350)),
            CircleAltitudeBand.PURPLE to (Color(0xFF473A6A) to Color(0xFFC084FC)),
            CircleAltitudeBand.APPROACH to (Color.White to Color.White),
        )
        assertEquals(CircleAltitudeBand.entries.toSet(), expected.keys)
        val altitude = CircleColorSchemes.default.altitude
        expected.forEach { (band, pigment) ->
            val (rest, active) = pigment
            assertEquals("$band REST", rest, altitude.color(band, CircleAltitudeWeight.REST))
            assertEquals("$band ACTIVE", active, altitude.color(band, CircleAltitudeWeight.ACTIVE))
        }
    }

    @Test
    fun `the band lookup reads the same fields the scheme declares`() {
        CircleColorSchemes.all.forEach { scheme ->
            val a = scheme.altitude
            val named = listOf(
                CircleAltitudeBand.BLUE to (a.blue to a.blueActive),
                CircleAltitudeBand.GREEN to (a.green to a.greenActive),
                CircleAltitudeBand.AMBER to (a.amber to a.amberActive),
                CircleAltitudeBand.RED to (a.red to a.redActive),
                CircleAltitudeBand.PURPLE to (a.purple to a.purpleActive),
                CircleAltitudeBand.APPROACH to (a.approach to a.approach),
            )
            assertEquals(CircleAltitudeBand.entries, named.map { it.first })
            named.forEach { (band, pigment) ->
                assertEquals(
                    "${scheme.theme} $band REST",
                    pigment.first,
                    a.color(band, CircleAltitudeWeight.REST),
                )
                assertEquals(
                    "${scheme.theme} $band ACTIVE",
                    pigment.second,
                    a.color(band, CircleAltitudeWeight.ACTIVE),
                )
            }
        }
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
