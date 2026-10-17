package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The ring is the one mark that says "you can do something with this", so
 * these tests are about a promise rather than about pixels: a row that
 * cannot be pressed must not be able to obtain one.
 */
class CircleRowAffordanceTest {
    private val tones = CircleTones(
        strong = Color(0xFFCBA8EF), dim = Color(0xFF6D5883), ground = Color(0xFF3B2D48), edge = Color(0xFF745D8A),
    )

    @Test
    fun `an action makes a row operable and its absence makes it a reading`() {
        assertTrue(CircleRowAffordance.of({}).operable)
        assertFalse(CircleRowAffordance.of(null).operable)
    }

    @Test
    fun `a reading has no disc at all, lit or off`() {
        val reading = CircleRowAffordance.of(null)

        listOf(null, true, false).forEach { active ->
            // Not even a state claim can bring the ring back: a row nobody can press has no state to change.
            val look = circleRowDiscLook(reading, active, tones)
            assertNull("contour, active=$active", look.contour)
            assertEquals("ground, active=$active", Color.Transparent, look.ground)
            assertEquals("icon, active=$active", tones.strong, look.icon)
        }
    }

    @Test
    fun `an operable disc wears its ground and edge, lights on, and goes grey off`() {
        val operable = CircleRowAffordance.of({})

        assertEquals(CircleDiscLook(tones.ground, tones.edge, tones.strong), circleRowDiscLook(operable, null, tones))
        assertEquals(CircleDiscLook(tones.ground, tones.strong, tones.strong), circleRowDiscLook(operable, true, tones))
        assertEquals(CircleDiscLook(Color.Transparent, CircleStyleTokens.Off, tones.dim), circleRowDiscLook(operable, false, tones))
    }
}
