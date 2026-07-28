package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SkyvwLabelProgressTest {
    @Test
    fun `press feedback carries the controls actual hold duration`() {
        assertEquals(
            SkyvwLabelFeedbackMode.Idle,
            resolveSkyvwLabelFeedbackMode(null, false, MenuDesign.tapHoldMs),
        )
        assertEquals(
            SkyvwLabelFeedbackMode.Press(MenuDesign.tapHoldMs),
            resolveSkyvwLabelFeedbackMode(null, true, MenuDesign.tapHoldMs),
        )
        assertEquals(
            SkyvwLabelFeedbackMode.Press(MenuDesign.holdDeliberateMs),
            resolveSkyvwLabelFeedbackMode(null, true, MenuDesign.holdDeliberateMs),
        )
        assertEquals(
            SkyvwLabelFeedbackMode.Press(MenuDesign.holdDestructiveMs),
            resolveSkyvwLabelFeedbackMode(null, true, MenuDesign.holdDestructiveMs),
        )
    }

    @Test
    fun `async work replaces press feedback without a second renderer`() {
        assertEquals(
            SkyvwLabelFeedbackMode.Determinate(0.4f),
            resolveSkyvwLabelFeedbackMode(
                SkyvwLabelProgress.Determinate(0.4f),
                true,
                MenuDesign.holdDestructiveMs,
            ),
        )
        assertEquals(
            SkyvwLabelFeedbackMode.Indeterminate,
            resolveSkyvwLabelFeedbackMode(
                SkyvwLabelProgress.Indeterminate,
                true,
                MenuDesign.holdDestructiveMs,
            ),
        )
    }

    @Test
    fun `press feedback refuses a negative gate`() {
        assertThrows(IllegalArgumentException::class.java) {
            resolveSkyvwLabelFeedbackMode(null, true, -1L)
        }
    }

    @Test
    fun `determinate progress rejects invented or corrupt fractions`() {
        assertThrows(IllegalArgumentException::class.java) {
            SkyvwLabelProgress.Determinate(-0.1f)
        }
        assertThrows(IllegalArgumentException::class.java) {
            SkyvwLabelProgress.Determinate(Float.NaN)
        }
        assertThrows(IllegalArgumentException::class.java) {
            SkyvwLabelProgress.Determinate(1.1f)
        }
    }
}
