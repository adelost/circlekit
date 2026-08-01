package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleActionCueEvent
import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class RingActionCueHostTest {
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
}
