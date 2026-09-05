package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleActionCueTest {
    @Test
    fun `immediate playback and navigation do not flash a hold receipt`() {
        assertEquals(CircleCuePlan.Clear, circleCuePlan(RingIcons.Play, "PLAY", null,
            CircleActionTiming.IMMEDIATE, pressed = false, confirmed = true, determinateProgress = null))
    }
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

    @Test
    fun `an info action cannot float without an explanation`() {
        assertThrows(IllegalArgumentException::class.java) {
            CircleActionCue(
                RingIcons.Gauge,
                "DIAL DIRECTION",
                progress = 0f,
                confirmed = false,
                infoAction = CircleActionCueInfoAction("RESET TO DEFAULT") {},
            )
        }
    }

    /** Cancel is silent: explanations now require the row's dedicated info control. */
    @Test
    fun `an abandoned row press publishes no explanation`() {
        assertEquals(CircleCuePlan.Clear, plan(pressed = false))
    }

    @Test
    fun `ordinary action receipts cannot carry explanatory copy`() {
        val settled = plan(pressed = false, confirmed = true) as CircleCuePlan.Settle

        assertEquals(null, settled.cue.hint)
        assertEquals(null, settled.cue.infoAction)
        assertEquals(false, settled.cue.lingers)
    }

    /** A cue published while the finger is down is refreshed; it needs no guard. */
    @Test
    fun `a cue published during the press does not linger`() {
        val plan = plan(pressed = true) as CircleCuePlan.Sweep
        assertEquals(CircleCuePlan.Sweep, plan)

        val settled = plan(pressed = false, confirmed = true) as CircleCuePlan.Settle
        assertEquals(false, settled.cue.lingers)
        assertEquals(true, settled.cue.confirmed)
    }

    @Test
    fun `a control nobody is touching shows nothing`() {
        assertEquals(CircleCuePlan.Clear, plan(pressed = false))
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
        confirmed: Boolean = false,
        timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
    ) = circleCuePlan(
        icon = RingIcons.Gauge,
        label = "DIAL DIRECTION",
        value = "CLOCK",
        timing = timing,
        pressed = pressed,
        confirmed = confirmed,
        determinateProgress = null,
    )
}
