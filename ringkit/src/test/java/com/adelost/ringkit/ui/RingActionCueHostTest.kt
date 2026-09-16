package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.CircleActionCueEvent
import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class RingActionCueHostTest {
    @Test
    fun receiptRefreshUpdatesItsValueButCannotEraseOpenedInformation() {
        val button = Any()
        val off = CircleActionCue(RingIcons.Vibrate, "TOUCH VIBRATION", 1f, true, "OFF")
        val on = off.copy(value = "ON")
        val committed = nextRingCueHostState(RingCueHostState(), CircleActionCueEvent(button, off))
        val refreshed = nextRingCueHostState(committed, CircleActionCueEvent(button, on, updateOnly = true))
        assertSame(on, refreshed.cue)
        val explanation = on.copy(confirmed = false, hint = "Vibrate on touch. Flight alerts are separate.", lingers = true)
        val opened = nextRingCueHostState(refreshed, CircleActionCueEvent(Any(), explanation))
        assertSame(opened, nextRingCueHostState(opened, CircleActionCueEvent(button, on, updateOnly = true)))
    }

    @Test
    fun committedReceiptSurvivesItsPublishingControl() {
        val owner = Any()
        val cue = CircleActionCue(RingIcons.Record, "TALK", 1f, confirmed = true)
        val committed = nextRingCueHostState(
            RingCueHostState(),
            CircleActionCueEvent(owner, cue),
        )
        val disposed = nextRingCueHostState(committed, CircleActionCueEvent(owner, null))

        assertSame(cue, disposed.cue)
        assertSame(owner, disposed.settledOwner)
    }

    @Test
    fun cancelledPressClearsOnlyItsOwnCue() {
        val owner = Any()
        val other = Any()
        val cue = CircleActionCue(RingIcons.Record, "TALK", 0.4f, confirmed = false)
        val pressing = nextRingCueHostState(
            RingCueHostState(),
            CircleActionCueEvent(owner, cue),
        )

        assertSame(cue, nextRingCueHostState(pressing, CircleActionCueEvent(other, null)).cue)
        assertNull(nextRingCueHostState(pressing, CircleActionCueEvent(owner, null)).cue)
    }

    @Test
    fun oldReceiptTimerCannotClearASecondPressFromTheSameControl() {
        val owner = Any()
        val receipt = CircleActionCue(RingIcons.Record, "TALK", 1f, confirmed = true)
        val nextPress = CircleActionCue(RingIcons.Record, "TALK", 0.2f, confirmed = false)
        val settled = nextRingCueHostState(
            RingCueHostState(),
            CircleActionCueEvent(owner, receipt),
        )
        val pressingAgain = nextRingCueHostState(
            settled,
            CircleActionCueEvent(owner, nextPress),
        )

        assertTrue(ringCueReceiptStillCurrent(settled, owner, receipt))
        assertFalse(ringCueReceiptStillCurrent(pressingAgain, owner, receipt))
        assertSame(nextPress, pressingAgain.cue)
    }

    @Test
    fun deliberateInfoExplanationSurvivesItsPublishingControl() {
        val owner = Any()
        val cue = CircleActionCue(
            RingIcons.Record,
            "TALK",
            progress = 0f,
            confirmed = false,
            value = "OFF",
            hint = "Enables spoken altitude cues.",
            lingers = true,
        )
        val settled = nextRingCueHostState(
            RingCueHostState(),
            CircleActionCueEvent(owner, cue),
        )

        assertSame(cue, nextRingCueHostState(settled, CircleActionCueEvent(owner, null)).cue)
        assertSame(owner, settled.settledOwner)
        assertTrue(ringCueReceiptStillCurrent(settled, owner, cue))
        // skyvw:0 row 52: the product's three cue shapes are the kit's now.
        // Explicitly opened information keeps the closeable explanation.
        assertTrue(cue.isInformation)
        assertSame(RingActionCueShape.SETTLED_EXPLAIN, ringActionCueShapeFor(cue))
    }

    @Test
    fun ordinaryActionCueCannotEnterTheExplanationRenderer() {
        val cue = CircleActionCue(RingIcons.Record, "TALK", 0.4f, confirmed = false)

        assertFalse(cue.isInformation)
        assertSame(RingActionCueShape.BARE, ringActionCueShapeFor(cue))
    }

    /** A sentence a press has not committed yet is read WHILE deciding: the
     *  covering shape, not a closeable card the reader has to dismiss. */
    @Test
    fun aSentenceUnderAPressInProgressTakesTheDecidingShape() {
        val deciding = CircleActionCue(
            RingIcons.Record, "TALK", 0.4f, confirmed = false,
            hint = "Speaks the altitude every thousand feet.",
        )
        assertFalse(deciding.isInformation)
        assertSame(RingActionCueShape.DECIDING, ringActionCueShapeFor(deciding))

        val settled = CircleActionCue(
            RingIcons.Record, "TALK", 1f, confirmed = true, value = "ON",
            hint = "Speaks the altitude every thousand feet.",
        )
        assertSame(RingActionCueShape.SETTLED_EXPLAIN, ringActionCueShapeFor(settled))
        assertEquals(MenuDesign.hintReadingMs, settled.dwellMs)
    }

    /**
     * Ported with Skyvw's cue (skyvw:0 row 52). The defect that reached a
     * watch: an abandoned press published its explanation, and the very
     * release that caused it restarted the publisher, whose trailing "nothing
     * to show" wiped the answer within a frame. The explanation was correct,
     * and invisible.
     */
    @Test
    fun anAbandonedPressSurvivesItsOwnPublisherRestarting() {
        val row = Any()
        val lingering = CircleActionCue(
            icon = RingIcons.Map, label = "GROUND", progress = 0f, confirmed = false,
            value = "SATELLITE", hint = "What the ground is made of.", lingers = true,
            iconRotationDeg = 117f, semanticColor = androidx.compose.ui.graphics.Color.Magenta,
        )

        val explained = nextRingCueHostState(RingCueHostState(), CircleActionCueEvent(row, lingering))
        assertSame("a lingering answer owns the dwell", row, explained.settledOwner)

        val afterRestart = nextRingCueHostState(explained, CircleActionCueEvent(row, null))

        assertSame("the explanation must survive the restart", lingering, afterRestart.cue)
        assertEquals(117f, afterRestart.cue?.iconRotationDeg)
        assertEquals(false, afterRestart.cue?.confirmed)
    }

    @Test
    fun aNewPressTakesTheCentreFromASettledReceipt() {
        val row = Any()
        val other = Any()
        val receipt = CircleActionCue(RingIcons.Map, "GROUND", 1f, confirmed = true, value = "SATELLITE")
        val settled = nextRingCueHostState(RingCueHostState(), CircleActionCueEvent(row, receipt))

        val taken = nextRingCueHostState(
            settled,
            CircleActionCueEvent(other, CircleActionCue(RingIcons.Map, "GROUND", 0.4f, confirmed = false)),
        )

        assertSame("the live press owns the centre", other, taken.owner)
        assertEquals(0.4f, taken.cue?.progress)
    }
}
