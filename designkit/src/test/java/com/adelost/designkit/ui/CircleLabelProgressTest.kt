package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CircleLabelProgressTest {

    @Test
    fun `with no work of its own a label draws exactly what the gesture measured`() {
        // Row 215. This used to resolve a PRESS mode carrying its own millisecond duration, which the
        // component then tweened: the second clock. There is no duration on this side any more, so the
        // number a label draws IS the number the gate is counting, and the two cannot be handed
        // different values because there is only one value.
        assertEquals(CircleLabelWorkMode.None, circleLabelWorkMode(null))
        for (measured in listOf(0f, 0.2f, 0.24f, 0.96f, 1f)) {
            assertEquals(
                "the label drew something other than the fraction of the gate the finger has spent",
                measured,
                circleOneCueFraction(work = 0f, holdProgress = measured, hasWork = false),
                0f,
            )
        }
    }

    @Test
    fun `async work replaces press feedback without a second renderer`() {
        assertEquals(
            CircleLabelWorkMode.Determinate(0.4f),
            circleLabelWorkMode(CircleLabelProgress.Determinate(0.4f)),
        )
        assertEquals(
            CircleLabelWorkMode.Indeterminate,
            circleLabelWorkMode(CircleLabelProgress.Indeterminate),
        )
        assertEquals(
            "a finger's fraction outvoted the work the control is actually doing",
            0.4f,
            circleOneCueFraction(work = 0.4f, holdProgress = 0.9f, hasWork = true),
            0f,
        )
    }

    @Test
    fun `a sweep still winding down is not interrupted by a finger`() {
        // Press, then checking, then downloading is one continuous sweep. Work that has just ended is
        // still running its release ramp, and a new press must not make it jump back to a finger's zero.
        assertEquals(
            0.3f,
            circleOneCueFraction(work = 0.3f, holdProgress = 0.05f, hasWork = false),
            0f,
        )
        assertEquals(
            "once the ramp reached zero the label belongs to the finger again",
            0.05f,
            circleOneCueFraction(work = 0f, holdProgress = 0.05f, hasWork = false),
            0f,
        )
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
