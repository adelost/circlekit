package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CircleChoiceIndicatorTest {

    @Test
    fun `ordered choice catalog resolves selected position`() {
        assertEquals(CircleChoiceState(2, 0), circleChoiceState(listOf("METRES", "FEET"), "METRES"))
        assertEquals(CircleChoiceState(3, 1), circleChoiceState(listOf("OFF", "LINES", "PHOTO"), "LINES"))
        assertEquals(CircleChoiceState(5, 4), circleChoiceState((1..5).toList(), 5))
    }

    @Test
    fun `invalid finite choice data fails closed`() {
        assertThrows(IllegalArgumentException::class.java) { CircleChoiceState(1, 0) }
        assertThrows(IllegalArgumentException::class.java) { CircleChoiceState(3, 3) }
        assertThrows(IllegalArgumentException::class.java) {
            circleChoiceState(listOf("A", "A"), "A")
        }
        assertThrows(IllegalArgumentException::class.java) {
            circleChoiceState(listOf("A", "B"), "C")
        }
    }

    @Test
    fun `a choice drawn with icons names every answer with its own glyph`() {
        val state = CircleChoiceState(3, 1, listOf(RingIcons.Map, RingIcons.Cube, RingIcons.Cloud))
        assertEquals(RingIcons.Cube, state.icons!![state.selectedIndex])

        assertThrows(IllegalArgumentException::class.java) {
            CircleChoiceState(3, 1, listOf(RingIcons.Map, RingIcons.Cube))
        }
        assertThrows(IllegalArgumentException::class.java) {
            CircleChoiceState(3, 1, listOf(RingIcons.Map, RingIcons.Cube, RingIcons.Map))
        }
    }
}
