package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CircleLabelProgressTest {
    @Test
    fun `press feedback carries the controls actual hold duration`() {
        assertEquals(
            CircleLabelFeedbackMode.Idle,
            resolveCircleLabelFeedbackMode(null, false, MenuDesign.tapHoldMs),
        )
        assertEquals(
            CircleLabelFeedbackMode.Press(MenuDesign.tapHoldMs),
            resolveCircleLabelFeedbackMode(null, true, MenuDesign.tapHoldMs),
        )
        assertEquals(
            CircleLabelFeedbackMode.Press(MenuDesign.holdDeliberateMs),
            resolveCircleLabelFeedbackMode(null, true, MenuDesign.holdDeliberateMs),
        )
        assertEquals(
            CircleLabelFeedbackMode.Press(MenuDesign.holdDestructiveMs),
            resolveCircleLabelFeedbackMode(null, true, MenuDesign.holdDestructiveMs),
        )
    }

    @Test
    fun `async work replaces press feedback without a second renderer`() {
        assertEquals(
            CircleLabelFeedbackMode.Determinate(0.4f),
            resolveCircleLabelFeedbackMode(
                CircleLabelProgress.Determinate(0.4f),
                true,
                MenuDesign.holdDestructiveMs,
            ),
        )
        assertEquals(
            CircleLabelFeedbackMode.Indeterminate,
            resolveCircleLabelFeedbackMode(
                CircleLabelProgress.Indeterminate,
                true,
                MenuDesign.holdDestructiveMs,
            ),
        )
    }

    @Test
    fun `press feedback refuses a negative gate`() {
        assertThrows(IllegalArgumentException::class.java) {
            resolveCircleLabelFeedbackMode(null, true, -1L)
        }
    }

    @Test
    fun `determinate progress rejects invented or corrupt fractions`() {
        assertThrows(IllegalArgumentException::class.java) {
            CircleLabelProgress.Determinate(-0.1f)
        }
        assertThrows(IllegalArgumentException::class.java) {
            CircleLabelProgress.Determinate(Float.NaN)
        }
        assertThrows(IllegalArgumentException::class.java) {
            CircleLabelProgress.Determinate(1.1f)
        }
    }
}
