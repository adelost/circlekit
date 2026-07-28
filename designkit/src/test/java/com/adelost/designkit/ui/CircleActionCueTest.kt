package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
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
}
