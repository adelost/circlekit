package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyvwChoiceIndicatorWidthTest {

    @Test
    fun `the mark grows with the count but stops before it starves the title`() {
        assertTrue(
            skyvwChoiceIndicatorWidth(2).value < skyvwChoiceIndicatorWidth(4).value,
        )
        // A five-step setting must not squeeze its own row title (BAR WEIGHT
        // rendered as "BAR" once it declared all five weights).
        assertEquals(
            skyvwChoiceIndicatorWidth(SkyvwChoiceState.MAX_OPTIONS),
            skyvwChoiceIndicatorWidth(5),
        )
    }

    @Test
    fun `every supported count has a usable width`() {
        (SkyvwChoiceState.MIN_OPTIONS..SkyvwChoiceState.MAX_OPTIONS).forEach { count ->
            assertTrue("count $count", skyvwChoiceIndicatorWidth(count).value > 0f)
        }
    }
}
