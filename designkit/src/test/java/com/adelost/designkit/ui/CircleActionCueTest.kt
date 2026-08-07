package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleActionCueTest {
    @Test
    fun `the two action categories keep one data-owned timing ladder`() {
        assertEquals(0L, CircleActionTiming.IMMEDIATE.holdMs)
        assertEquals(MenuDesign.tapHoldMs, CircleActionTiming.DELIBERATE.holdMs)
        assertEquals(240L, MenuDesign.actionConfirmationMs)
        assertEquals(MenuDesign.holdDeliberateMs, MenuDesign.backHoldMs)
    }

    @Test
    fun `centre cue refuses invented or invisible progress`() {
        assertThrows(IllegalArgumentException::class.java) {
            CircleActionCue(RingIcons.Gauge, "", progress = 0.5f, confirmed = false)
        }
        assertThrows(IllegalArgumentException::class.java) {
            CircleActionCue(RingIcons.Gauge, "ZOOM", progress = 1.1f, confirmed = false)
        }
    }

    /**
     * The one Mattias asked for (2026-08-06): "en info knapp ... som kanske
     * syns en liten stund efter att man duttar på något". A deliberate row does
     * nothing until the hold completes, so before this a tap was silent — and
     * silence is indistinguishable from broken.
     */
    @Test
    fun `a press that ends before it can act explains the row instead`() {
        val plan = plan(pressed = false, armed = true)

        assertEquals(
            CircleCuePlan.Explain(
                cue = CircleActionCue(
                    RingIcons.Gauge,
                    "DIAL DIRECTION",
                    progress = 0f,
                    confirmed = false,
                    value = "CLOCK",
                    hint = HINT,
                ),
                dwellMs = MenuDesign.hintReadingMs,
            ),
            plan,
        )
    }

    /** Cancel still cancels: the whole point of releasing early (2026-07-27). */
    @Test
    fun `an abandoned press never reports itself as confirmed`() {
        val explain = plan(pressed = false, armed = true) as CircleCuePlan.Explain

        assertEquals(false, explain.cue.confirmed)
        assertEquals(0f, explain.cue.progress, 0f)
    }

    /** The explanation is the payload; a card without it is just a flash. */
    @Test
    fun `the abandoned press carries the sentence and the state`() {
        val explain = plan(pressed = false, armed = true) as CircleCuePlan.Explain

        assertEquals(HINT, explain.cue.hint)
        assertEquals("CLOCK", explain.cue.value)
    }

    @Test
    fun `a control nobody pressed stays quiet`() {
        assertEquals(CircleCuePlan.Clear, plan(pressed = false, armed = false))
    }

    @Test
    fun `a control with nothing to say stays quiet even after a press`() {
        assertEquals(
            CircleCuePlan.Clear,
            plan(pressed = false, armed = true, value = null, hint = null),
        )
    }

    /**
     * IMMEDIATE controls fire on the press itself, so there is no window in
     * which the user asked a question and got no answer.
     */
    @Test
    fun `an immediate control has no abandoned press to explain`() {
        assertEquals(
            CircleCuePlan.Clear,
            plan(pressed = false, armed = true, timing = CircleActionTiming.IMMEDIATE),
        )
    }

    @Test
    fun `holding still sweeps and committing still settles`() {
        assertEquals(CircleCuePlan.Sweep, plan(pressed = true, armed = false))
        assertTrue(plan(pressed = false, armed = true, confirmed = true) is CircleCuePlan.Settle)
    }

    /**
     * The window is DERIVED from the hint budget rather than picked, so
     * widening what a row may say widens the time to read it. Mattias asked for
     * "2-3 s" (2026-08-06); this asserts the derivation lands there.
     */
    @Test
    fun `the reading window is derived from the hint budget`() {
        assertTrue(
            "a full hint must not flash past, was ${MenuDesign.hintReadingMs} ms",
            MenuDesign.hintReadingMs >= 2_000L,
        )
        assertTrue(
            "an explanation must not become a wall, was ${MenuDesign.hintReadingMs} ms",
            MenuDesign.hintReadingMs <= 3_500L,
        )
        assertTrue(
            "reading a sentence must outlast recognising a value",
            MenuDesign.hintReadingMs > MenuDesign.actionExplainMs,
        )
    }

    private fun plan(
        pressed: Boolean,
        armed: Boolean,
        confirmed: Boolean = false,
        value: String? = "CLOCK",
        hint: String? = HINT,
        timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
    ) = circleCuePlan(
        icon = RingIcons.Gauge,
        label = "DIAL DIRECTION",
        value = value,
        hint = hint,
        timing = timing,
        pressed = pressed,
        armed = armed,
        confirmed = confirmed,
        determinateProgress = null,
    )

    private companion object {
        const val HINT = "Which way the altitude needle sweeps."
    }
}
