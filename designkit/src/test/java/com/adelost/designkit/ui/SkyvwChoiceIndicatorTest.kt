package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SkyvwChoiceIndicatorTest {

    @Test
    fun `ordered choice catalog resolves selected position`() {
        assertEquals(SkyvwChoiceState(2, 0), skyvwChoiceState(listOf("METRES", "FEET"), "METRES"))
        assertEquals(SkyvwChoiceState(3, 1), skyvwChoiceState(listOf("OFF", "LINES", "PHOTO"), "LINES"))
        assertEquals(SkyvwChoiceState(5, 4), skyvwChoiceState((1..5).toList(), 5))
    }

    @Test
    fun `invalid finite choice data fails closed`() {
        assertThrows(IllegalArgumentException::class.java) { SkyvwChoiceState(1, 0) }
        assertThrows(IllegalArgumentException::class.java) { SkyvwChoiceState(3, 3) }
        assertThrows(IllegalArgumentException::class.java) {
            skyvwChoiceState(listOf("A", "A"), "A")
        }
        assertThrows(IllegalArgumentException::class.java) {
            skyvwChoiceState(listOf("A", "B"), "C")
        }
    }
}
