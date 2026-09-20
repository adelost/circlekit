package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What a held control shows while it is being held, and what a brush shows: nothing.
 *
 * ROW 212 RECORDED "a refused press changes 0 pixels" and that number was the instrument, not the
 * product: its harness called waitForIdle() after the down event, which runs the test clock past the
 * 200 ms gate, so the frame it read was taken after the press had already committed and the finger was
 * gone. Re-measured with the clock held (2026-09-20, a run seat at 192 dp): the released seat answers a
 * touch at the first frame, 438 pixels, and then STANDS STILL, 350 coloured pixels at 48 ms and 361 at
 * 192 ms. So the hole is not silence. The seat says "touched" and never says how much of the gate has
 * passed, while the kit's haptic sits on the success path only, so a press that will be refused looks
 * exactly like one that will act until the moment it does not.
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
    fun `the cue's zero is the finger's, not the first frame after it`() {
        // Measured on a 192 dp seat under a 200 ms gate (2026-09-20): reading the zero off the effect's
        // first frame put the ring two frames behind, so it started at 0.24 instead of 0.2 and FROZE at
        // 0.88 when the gate fired. A ring that can never complete under a gate it is drawn for is worse
        // than none: it teaches the wearer that a full ring is not what acting looks like.
        val twoFramesLate = 32L
        assertEquals(
            "a cue zeroed two frames after the finger cannot reach the gate",
            1f,
            circleHoldCueFraction(MenuDesign.tapHoldMs, MenuDesign.tapHoldMs),
            0f,
        )
        assertTrue(
            "zeroing on the first frame instead leaves the ring short at the moment the gate commits",
            circleHoldCueFraction(MenuDesign.tapHoldMs - twoFramesLate, MenuDesign.tapHoldMs) < 1f,
        )
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
