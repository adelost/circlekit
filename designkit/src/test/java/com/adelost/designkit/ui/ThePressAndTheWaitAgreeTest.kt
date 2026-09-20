package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A control may not draw a wait it does not keep. Row 225.
 *
 * Mattias 2026-09-20, on Link: "även om du bara touchar den en millisekund, progress baren kommer
 * upp, men även om progress baren inte fylls så tar den ändå och byter knapp. Detta är ju väldigt
 * allvarligt", and his rule, "det ska inte finnas något mellanting liksom, bara de här två typerna
 * utav knappar".
 *
 * MEASURED BEFORE THIS WAS BUILT, on Link 1.2.23 on a phone: the WAKE PHRASE row drew an arc that
 * filled over about half a second (152 px of its ink at 100 ms of press, 454 at 250, 683 at 450 and
 * 683 again at 700) and committed on a press of ONE millisecond, and on every other duration tried.
 * The declaration said one thing and two readers answered it separately: the gate took a host-wide
 * override and the row's own drawing never saw one.
 *
 * SO THE CASE IS ABOUT THE PAIR, not about either half. For each kind of control it drives a press
 * shorter than the hold and a press that completes it, and reads BOTH what commits and whether a
 * wait was drawn. They have to agree, because the wait is the promise the gate has to keep.
 */
class ThePressAndTheWaitAgreeTest {

    @Test
    fun `an immediate control keeps no press waiting and draws no wait`() {
        val hold = circleResolvedTiming(CircleActionTiming.IMMEDIATE)
        assertEquals("an immediate control cannot hold a press", 0L, hold)
        assertTrue("the shortest press a finger can make did not commit", commits(1L, hold))
        assertFalse(
            "an immediate control drew a wait: a bar that fills while the press has already " +
                "committed is the in-between Mattias refused",
            drawsAWait(hold),
        )
        assertFalse(
            "the row still resolved a press wait to draw, even a zero-length one: a bar that " +
                "appears full in one frame is still a bar where no gesture is being asked for",
            drawsAWaitOnTheGlass(hold),
        )
    }

    @Test
    fun `an immediate control ignores a hold that rides along with it`() {
        // Where the bug lived. A choice row carries DELIBERATE_CHANGE_HOLD_MS whatever its kind, so
        // a control declared immediate used to arrive with a half second in its other hand.
        val hold = circleResolvedTiming(CircleActionTiming.IMMEDIATE, holdMs = MenuDesign.holdDeliberateMs)
        assertEquals("a number riding along outvoted the declaration", 0L, hold)
        assertFalse("and it drew the wait it was not going to keep", drawsAWait(hold))
        assertFalse("and the drawing still produced one", drawsAWaitOnTheGlass(hold))
    }

    @Test
    fun `a deliberate control refuses every press shorter than the wait it drew`() {
        for (declared in listOf(MenuDesign.tapHoldMs, MenuDesign.holdDeliberateMs, 900L)) {
            val hold = circleResolvedTiming(CircleActionTiming.DELIBERATE, holdMs = declared)
            assertEquals("the declared hold was not the resolved one", declared, hold)
            assertTrue("a deliberate control drew no wait, so its hold is invisible", drawsAWait(hold))
            assertTrue("and the drawing produced none", drawsAWaitOnTheGlass(hold))
            assertFalse("a press of one millisecond committed against a $declared ms wait", commits(1L, hold))
            assertFalse("a press one millisecond short of the wait committed", commits(declared - 1L, hold))
            assertTrue("a press that waited the wait out did not commit", commits(declared, hold))
        }
    }

    @Test
    fun `the gate and the drawing read one answer, for every kind`() {
        for (timing in CircleActionTiming.entries) {
            val hold = circleResolvedTiming(timing)
            // THE INVARIANT, in one line: the duration a press must survive IS the duration the
            // control draws. A press at the boundary therefore commits exactly when the drawn wait
            // has been seen through to its end.
            val drawn = drawnWaitMs(hold)
            assertEquals(
                "$timing draws a ${drawn} ms wait and commits after ${hold} ms, so the bar and the " +
                    "press describe different gestures",
                hold,
                drawn,
            )
            assertEquals(
                "$timing commits at a moment its own drawing does not reach",
                commits(drawn, hold),
                drawn >= hold,
            )
        }
    }

    @Test
    fun `a deliberate control without a duration is refused rather than drawn as a third kind`() {
        val refusal = runCatching { circleResolvedTiming(CircleActionTiming.DELIBERATE, holdMs = 0L) }
        assertTrue(
            "a deliberate control with no hold was accepted: it draws nothing and commits at once, " +
                "which is a third kind of button",
            refusal.isFailure,
        )
    }

    @Test
    fun `a hold the cue refuses to draw is refused too`() {
        // The in-between from the other side, and it arrived with row 215 (#249). The gesture's cue
        // draws nothing at or below the brush minimum, so a control declaring a hold in that band
        // would gate a press while showing the wearer nothing at all: silent, and the silence row
        // 212 measured is the one nobody can see.
        for (tooShort in listOf(1L, CIRCLE_CUE_BRUSH_MIN_MS - 1L, CIRCLE_CUE_BRUSH_MIN_MS)) {
            assertEquals(
                "the cue drew nothing for a control declaring a $tooShort ms hold",
                0f,
                circleHoldCueFraction(tooShort, tooShort),
                0f,
            )
            assertTrue(
                "a $tooShort ms deliberate hold was accepted: the press waits and the glass " +
                    "never says so",
                runCatching { circleResolvedTiming(CircleActionTiming.DELIBERATE, holdMs = tooShort) }.isFailure,
            )
        }
    }

    @Test
    fun `the arc a deliberate control fills completes exactly when its gate commits`() {
        // One rule, read at the same millisecond from both sides: row 215's cue fraction and this
        // kit's press gate. They cannot drift because they are given the same resolved number.
        val hold = circleResolvedTiming(CircleActionTiming.DELIBERATE, holdMs = MenuDesign.holdDeliberateMs)
        assertEquals("the arc was not full at the moment the press committed", 1f, circleHoldCueFraction(hold, hold), 0f)
        assertTrue("the press did not commit at the moment its arc filled", commits(hold, hold))
        val justBefore = hold - 1L
        assertTrue("the arc was already full before the press committed", circleHoldCueFraction(justBefore, hold) < 1f)
        assertFalse("the press committed before its arc was full", commits(justBefore, hold))
    }

    /** What the press gate does with a resolved hold, through the kit's own rule. */
    private fun commits(pressDurationMs: Long, resolvedHoldMs: Long): Boolean =
        isCircleHoldComplete(pressDurationMs, resolvedHoldMs)

    /** Whether the control draws a wait, through the kit's own rule. */
    private fun drawsAWait(resolvedHoldMs: Long): Boolean = circleDrawsAWait(resolvedHoldMs)

    /**
     * Whether anything is drawn across the whole of this hold, read off the CUE's own law.
     *
     * This used to ask the row's own feedback resolver, which carried a second millisecond value and
     * was the reader that could be handed a different number. Row 215 deleted that value: the drawing
     * takes the fraction the gesture measured and no duration at all. What is left to ask is whether
     * the one cue draws anything for a control declaring this hold, which is the brush minimum's
     * answer. The hand-over itself is now proven on a mounted control in
     * [ThePressAndTheWaitAgreeOnAControlTest], where it can be seen rather than computed.
     */
    private fun drawsAWaitOnTheGlass(resolvedHoldMs: Long): Boolean =
        circleHoldCueFraction(resolvedHoldMs, resolvedHoldMs) > 0f

    /**
     * How long the wait the control draws lasts, read off the cue by finding the last millisecond at
     * which it is still short of full. A cue that completes early or late would answer differently
     * here from the gate below.
     */
    private fun drawnWaitMs(resolvedHoldMs: Long): Long {
        if (!drawsAWaitOnTheGlass(resolvedHoldMs)) return 0L
        var elapsed = 0L
        while (elapsed <= resolvedHoldMs && circleHoldCueFraction(elapsed, resolvedHoldMs) < 1f) elapsed += 1L
        return elapsed
    }
}
