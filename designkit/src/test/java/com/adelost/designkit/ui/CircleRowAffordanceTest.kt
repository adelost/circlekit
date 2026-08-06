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
    private val brand = Color(0xFFE2AF32)

    @Test
    fun `an action makes a row operable and its absence makes it a reading`() {
        assertTrue(CircleRowAffordance.of({}).operable)
        assertFalse(CircleRowAffordance.of(null).operable)
    }

    @Test
    fun `a reading has no contour at all, lit or neutral`() {
        val reading = CircleRowAffordance.of(null)

        assertNull(circleRowRingContour(reading, active = null, activeColor = brand))
        // Not even a state claim can bring the ring back: a row nobody can
        // press has no state to change, so `active` is not a second opinion
        // about whether it is operable.
        assertNull(circleRowRingContour(reading, active = true, activeColor = brand))
        assertNull(circleRowRingContour(reading, active = false, activeColor = brand))
    }

    @Test
    fun `an operable row keeps the neutral ring, and a toggle lights it`() {
        val operable = CircleRowAffordance.of({})

        assertEquals(MenuDesign.ringNeutral, circleRowRingContour(operable, null, brand))
        assertEquals(MenuDesign.ringNeutral, circleRowRingContour(operable, false, brand))
        assertEquals(brand, circleRowRingContour(operable, true, brand))
    }
}
