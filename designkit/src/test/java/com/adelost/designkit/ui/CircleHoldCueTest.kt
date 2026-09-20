package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What a held control shows while it is being held, and what a brush shows: nothing.
 *
 * Row 212 measured the hole: a finger resting on a run seat changed 0 pixels, against a calibration the
 * same frame read CAN see (438 for the seat's own active ring), and the kit's haptic sits on the success
 * path only. A press released before the gate was a dead seat rather than a seat that says hold.
 */
class CircleHoldCueTest {

    @Test
    fun `a brush shorter than the declared minimum draws nothing`() {
        assertEquals(0f, circleHoldCueFraction(0L, MenuDesign.tapHoldMs), 0f)
        assertEquals(0f, circleHoldCueFraction(1L, MenuDesign.tapHoldMs), 0f)
        assertEquals(
            "a finger that was on the glass for one millisecond less than the minimum still answered",
            0f,
            circleHoldCueFraction(CIRCLE_CUE_BRUSH_MIN_MS - 1L, MenuDesign.tapHoldMs),
            0f,
        )
    }

    @Test
    fun `the cue appears at the time it has actually spent, not at zero`() {
        // A ring means how much of the gate is gone. Fading in from zero at 40 ms would say something
        // false about the finger that is already there, which is the same class of mistake as a
        // placeholder value standing in for a reading nobody has taken.
        assertEquals(
            CIRCLE_CUE_BRUSH_MIN_MS.toFloat() / MenuDesign.tapHoldMs,
            circleHoldCueFraction(CIRCLE_CUE_BRUSH_MIN_MS, MenuDesign.tapHoldMs),
            0.0001f,
        )
        assertEquals(0.5f, circleHoldCueFraction(MenuDesign.tapHoldMs / 2, MenuDesign.tapHoldMs), 0.0001f)
    }

    @Test
    fun `it completes at the gate and never overshoots it`() {
        assertEquals(1f, circleHoldCueFraction(MenuDesign.tapHoldMs, MenuDesign.tapHoldMs), 0f)
        assertEquals(1f, circleHoldCueFraction(5_000L, MenuDesign.tapHoldMs), 0f)
    }

    @Test
    fun `the cue completes exactly when the gate commits`() {
        // ONE rule, asked twice. The cue is not allowed to promise an action at a different moment than
        // the gate performs it: a ring that fills early teaches the wearer to let go too soon, and one
        // that fills late makes a press that worked look refused.
        val gates = listOf(MenuDesign.tapHoldMs, MenuDesign.holdDeliberateMs, MenuDesign.holdDestructiveMs)
        for (holdMs in gates) {
            for (elapsedMs in listOf(0L, CIRCLE_CUE_BRUSH_MIN_MS, holdMs - 1L, holdMs, holdMs + 50L)) {
                assertEquals(
                    "at $elapsedMs ms of a $holdMs ms gate the cue and the gate disagree",
                    isCircleHoldComplete(elapsedMs, holdMs),
                    circleHoldCueFraction(elapsedMs, holdMs) >= 1f,
                )
            }
        }
    }

    @Test
    fun `a control with no gate says nothing at any length`() {
        // IMMEDIATE commits on release, so there is no wait to report and a ring that completes in the
        // same frame is noise. The full-screen scrim that dismisses an explanation is one of these.
        for (elapsedMs in listOf(0L, CIRCLE_CUE_BRUSH_MIN_MS, 1_000L)) {
            assertEquals(0f, circleHoldCueFraction(elapsedMs, CircleActionTiming.IMMEDIATE.holdMs), 0f)
            assertEquals(0f, circleHoldCueFraction(elapsedMs, CIRCLE_CUE_BRUSH_MIN_MS), 0f)
        }
    }

    @Test
    fun `the shape is measured from the control's own bounds`() {
        // A seat and a disc are square, so the cue is the ring this kit already draws for work on the
        // same circle; a row is wide, so it is the wash this kit already draws under a row's label.
        assertTrue("a 30 dp seat did not take the ring", circleHoldCueIsRing(30f, 30f))
        assertTrue("a disc with its touch padding did not take the ring", circleHoldCueIsRing(44f, 40f))
        assertFalse("a menu row took the ring", circleHoldCueIsRing(160f, 40f))
        assertFalse("a filter chip took the ring", circleHoldCueIsRing(96f, 32f))
    }

    @Test
    fun `the declared minimum is the one a wrist can afford`() {
        // Short enough that a press meant as a press is never silent, long enough that the flicks a
        // sleeve makes all day are. It is a fifth of the tap gate, so four fifths of every real press
        // is spent with the cue on the glass.
        assertEquals(40L, CIRCLE_CUE_BRUSH_MIN_MS)
        assertTrue(CIRCLE_CUE_BRUSH_MIN_MS < MenuDesign.tapHoldMs / 2)
    }
}
