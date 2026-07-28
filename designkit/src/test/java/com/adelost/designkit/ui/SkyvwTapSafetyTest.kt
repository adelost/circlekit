package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyvwTapSafetyTest {

    @Test
    fun `a press shorter than the rung is a graze, not an action`() {
        // A touch that was never a decision must do nothing (Mattias
        // 2026-07-21: "inte att man råkar nudda").
        assertFalse(isSkyvwHoldComplete(pressDurationMs = 0L))
        assertFalse(isSkyvwHoldComplete(pressDurationMs = MenuDesign.tapHoldMs - 1L))
    }

    @Test
    fun `a press that reaches the rung commits`() {
        assertTrue(isSkyvwHoldComplete(pressDurationMs = MenuDesign.tapHoldMs))
        assertTrue(isSkyvwHoldComplete(pressDurationMs = 5_000L))
    }

    @Test
    fun `a plain action uses the short 200 millisecond rung`() {
        assertEquals(200L, MenuDesign.tapHoldMs)
        assertTrue(MenuDesign.tapHoldMs < MenuDesign.holdDeliberateMs)
    }

    @Test
    fun `camera and transport actions are explicitly immediate while app actions stay deliberate`() {
        assertEquals(0L, SkyvwActionTiming.IMMEDIATE.holdMs)
        assertEquals(MenuDesign.tapHoldMs, SkyvwActionTiming.DELIBERATE.holdMs)
    }

    @Test
    fun `a dual-gesture control can still reach its long press`() {
        // Both rungs are holds, so the long one has to outlast the action one
        // by enough for a thumb to aim at; skyvwSafeTapOrHold refuses any
        // other configuration.
        assertTrue(MenuDesign.holdDestructiveMs > MenuDesign.tapHoldMs)
        assertTrue(MenuDesign.holdDestructiveMs - MenuDesign.tapHoldMs >= 300L)
    }

    @Test
    fun `the tap rung is the shortest rung on the hold ladder`() {
        // One ladder, ascending: tap, choice, destructive, confirm. A tap gate
        // that crept past a deliberate hold would swallow that hold.
        val ladder = listOf(
            MenuDesign.tapHoldMs,
            MenuDesign.holdDeliberateMs,
            MenuDesign.holdDestructiveMs,
            MenuDesign.holdConfirmMs,
        )
        assertEquals(ladder.sorted(), ladder)
    }
}
