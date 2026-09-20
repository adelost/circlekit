package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleTapSafetyTest {

    @Test
    fun `a press shorter than the rung is a graze, not an action`() {
        // A touch that was never a decision must do nothing (Mattias
        // 2026-07-21: "inte att man råkar nudda").
        assertFalse(isCircleHoldComplete(pressDurationMs = 0L, timing = THE_ORDINARY_GATE))
        assertFalse(isCircleHoldComplete(pressDurationMs = MenuDesign.wornTouchCostMs - 1L, timing = THE_ORDINARY_GATE))
    }

    @Test
    fun `a press that reaches the rung commits`() {
        assertTrue(isCircleHoldComplete(pressDurationMs = MenuDesign.wornTouchCostMs, timing = THE_ORDINARY_GATE))
        assertTrue(isCircleHoldComplete(pressDurationMs = 5_000L, timing = THE_ORDINARY_GATE))
    }

    @Test
    fun `continuous action starts only after one completed uncancelled gate`() {
        assertFalse(continuousPressMayBegin(releasedBeforeActivation = true, cancelled = false))
        assertFalse(continuousPressMayBegin(releasedBeforeActivation = false, cancelled = true))
        assertTrue(continuousPressMayBegin(releasedBeforeActivation = false, cancelled = false))
    }

    @Test
    fun `the worn host adds the short 200 millisecond cost`() {
        assertEquals(200L, MenuDesign.wornTouchCostMs)
        assertTrue(MenuDesign.wornTouchCostMs < MenuDesign.holdDeliberateMs)
    }

    @Test
    fun `the two declarations stay distinct from the worn host cost`() {
        assertEquals(0L, CircleActionTiming.IMMEDIATE.holdMs)
        assertEquals(MenuDesign.holdDeliberateMs, CircleActionTiming.DELIBERATE.holdMs)
        assertEquals(
            MenuDesign.wornTouchCostMs,
            unlockedTiming(CircleActionTiming.IMMEDIATE, CircleActionHostCost.WORN).holdMs,
        )
    }

    @Test
    fun `a dual-gesture control can still reach its long press`() {
        // Both rungs are holds, so the long one has to outlast the action one
        // by enough for a thumb to aim at; circleSafeTapOrHold refuses any
        // other configuration.
        assertTrue(MenuDesign.holdDestructiveMs > MenuDesign.wornTouchCostMs)
        assertTrue(MenuDesign.holdDestructiveMs - MenuDesign.wornTouchCostMs >= 300L)
    }

    @Test
    fun `the tap rung is the shortest rung on the hold ladder`() {
        // One ladder, ascending: tap, choice, destructive, confirm. A tap gate
        // that crept past a deliberate hold would swallow that hold.
        val ladder = listOf(
            MenuDesign.wornTouchCostMs,
            MenuDesign.holdDeliberateMs,
            MenuDesign.holdDestructiveMs,
            MenuDesign.holdConfirmMs,
        )
        assertEquals(ladder.sorted(), ladder)
    }

    @Test
    fun `continuous content starts on down without inheriting host cost`() {
        assertEquals(0L, resolveCirclePressStart(CirclePressStart.ON_DOWN, null).holdMs)
        val wornGate = unlockedTiming(CircleActionTiming.IMMEDIATE, CircleActionHostCost.WORN)
        assertEquals(wornGate, resolveCirclePressStart(CirclePressStart.AFTER_INTENT_GATE, wornGate))
        assertThrows(IllegalArgumentException::class.java) {
            resolveCirclePressStart(CirclePressStart.ON_DOWN, wornGate)
        }
        assertThrows(IllegalArgumentException::class.java) {
            resolveCirclePressStart(CirclePressStart.AFTER_INTENT_GATE, null)
        }
    }

    private companion object {
        /** What an ordinary navigation control declares. The gate takes no default: see isCircleHoldComplete. */
        val THE_ORDINARY_GATE = unlockedTiming(CircleActionTiming.IMMEDIATE, CircleActionHostCost.WORN)
    }
}
