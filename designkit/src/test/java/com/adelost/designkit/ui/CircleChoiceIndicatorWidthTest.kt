package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleChoiceIndicatorWidthTest {

    @Test
    fun `the mark grows with the count but stops before it starves the title`() {
        assertTrue(
            circleChoiceIndicatorWidth(2).value < circleChoiceIndicatorWidth(4).value,
        )
        // A five-step setting must not squeeze its own row title (BAR WEIGHT
        // rendered as "BAR" once it declared all five weights).
        assertEquals(
            circleChoiceIndicatorWidth(CircleChoiceState.MAX_OPTIONS),
            circleChoiceIndicatorWidth(5),
        )
    }

    @Test
    fun `every supported count has a usable width`() {
        (CircleChoiceState.MIN_OPTIONS..CircleChoiceState.MAX_OPTIONS).forEach { count ->
            assertTrue("count $count", circleChoiceIndicatorWidth(count).value > 0f)
        }
    }
}
