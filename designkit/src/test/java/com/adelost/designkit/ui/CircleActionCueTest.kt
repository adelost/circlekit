package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
    fun `an abandoned press answers with the words the hold would have shown`() {
        var reset = false
        val action = CircleActionCueInfoAction("RESET TO DEFAULT") { reset = true }
        val cue = abandonedPressCue(RingIcons.Gauge, "DIAL DIRECTION", "CLOCK", HINT, action)

        assertEquals(HINT, cue?.hint)
        assertEquals("CLOCK", cue?.value)
        assertEquals("DIAL DIRECTION", cue?.label)
        assertEquals("RESET TO DEFAULT", cue?.infoAction?.label)
        cue?.infoAction?.onInvoke?.invoke()
        assertTrue(reset)
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

    /** Cancel still cancels: the whole point of releasing early (2026-07-27). */
    @Test
    fun `an abandoned press never claims the action happened`() {
        val cue = requireNotNull(abandonedPressCue(RingIcons.Gauge, "DIAL DIRECTION", "CLOCK", HINT))

        assertEquals(false, cue.confirmed)
        assertEquals(0f, cue.progress, 0f)
    }

    /**
     * Without this the answer loses a race it cannot win: the lift that creates
     * the cue also restarts the publisher, whose "nothing to show" lands right
     * behind it. The host keeps a lingering cue exactly as it keeps a confirmed
     * one.
     */
    @Test
    fun `an abandoned press outlives the restart it triggers`() {
        val cue = requireNotNull(abandonedPressCue(RingIcons.Gauge, "DIAL DIRECTION", "CLOCK", HINT))

        assertTrue("a cue nobody protects is cleared before it can be read", cue.lingers)
    }

    @Test
    fun `a control with neither state nor sentence stays silent`() {
        assertNull(abandonedPressCue(RingIcons.Gauge, "SOMETHING", null, null))
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
        hint = HINT,
        timing = timing,
        pressed = pressed,
        confirmed = confirmed,
        determinateProgress = null,
    )

    private companion object {
        const val HINT = "Which way the altitude needle sweeps."
    }
}
