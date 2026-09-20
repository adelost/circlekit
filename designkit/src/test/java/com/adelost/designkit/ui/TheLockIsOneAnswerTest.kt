package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A LOCKED SURFACE LENGTHENS A PRESS; IT DOES NOT REFUSE ONE. Row 229 PR 1's rule, resolved here.
 *
 * The lock is ambient: it belongs to the SURFACE, not to a control, and it is folded in at the one
 * moment a control's timing is resolved. That is what makes the gate, the cue and the drawing agree
 * about it without any of them being told: they take the value, and the value already carries it.
 *
 * WHY IT LENGTHENS. A control that looks pressable and can never be pressed is a third kind of button,
 * and there are two: "det ska inte finnas något mellanting liksom, bara de här två typerna utav
 * knappar" (Mattias, 2026-09-20). Under canopy a jumper still recentres the map and still steps a
 * frame, so a press that can never count is a dead instrument for the minutes it is actually being
 * flown. On the ground a control is what it declares; in the air everything is the hold kind, and its
 * ring teaches that the first time it is touched.
 *
 * [resolveCircleTiming] is the rule without a composition. The production door is
 * [circleResolvedTiming], which reads [LocalCircleTouchLock] and is the only reader of it.
 */
class TheLockIsOneAnswerTest {

    @Test
    fun `unlocked, a control is exactly what it declared`() {
        for (effect in CircleActionEffect.entries) {
            assertEquals(
                0L,
                resolve(CircleActionTiming.IMMEDIATE, CircleActionHostCost.NONE, effect = effect).holdMs,
            )
            assertEquals(
                if (effect == CircleActionEffect.MOVES_THE_VIEW) 0L else MenuDesign.wornTouchCostMs,
                resolve(CircleActionTiming.IMMEDIATE, CircleActionHostCost.WORN, effect = effect).holdMs,
            )
            assertEquals(
                MenuDesign.holdDeliberateMs,
                resolve(CircleActionTiming.DELIBERATE, CircleActionHostCost.NONE, effect = effect).holdMs,
            )
        }
    }

    @Test
    fun `locked, an ordinary control becomes a hold and its ring says so`() {
        val touch = resolve(CircleActionTiming.IMMEDIATE, CircleActionHostCost.WORN, locked = true)
        assertEquals(
            "a touch stayed a touch on a locked surface, so a sleeve in freefall still fires it",
            MenuDesign.holdConfirmMs,
            touch.holdMs,
        )
        assertTrue(
            "a locked control draws no wait, so the wearer is given no way to learn that the surface " +
                "has changed what a press costs",
            touch.drawsAWait,
        )
        assertEquals(
            "a deliberate control's short gate survived the lock",
            MenuDesign.holdConfirmMs,
            resolve(CircleActionTiming.DELIBERATE, CircleActionHostCost.WORN, locked = true).holdMs,
        )
    }

    @Test
    fun `the lock never shortens a hold`() {
        // A destructive control does not get cheaper because the wearer is under canopy.
        val destructive = resolve(
            CircleActionTiming.DELIBERATE,
            CircleActionHostCost.WORN,
            holdMs = MenuDesign.holdDestructiveMs,
            locked = true,
        )
        assertTrue(
            "the declared hold was ${MenuDesign.holdDestructiveMs} ms and the lock resolved it to " +
                "${destructive.holdMs}",
            destructive.holdMs >= MenuDesign.holdDestructiveMs,
        )
    }

    @Test
    fun `a press that only moves the view keeps its own timing in the air`() {
        // lsrc:0, 2026-09-20, correcting his own ruling: a jumper steering to a landing area must not
        // need a one-second hold in gloves to get the map back on themselves, and a brushed recentre
        // costs nothing the next press does not give back.
        assertEquals(
            0L,
            resolve(
                CircleActionTiming.IMMEDIATE,
                CircleActionHostCost.WORN,
                effect = CircleActionEffect.MOVES_THE_VIEW,
                locked = true,
            ).holdMs,
        )
        assertEquals(
            MenuDesign.holdDeliberateMs,
            resolve(
                CircleActionTiming.DELIBERATE,
                CircleActionHostCost.WORN,
                effect = CircleActionEffect.MOVES_THE_VIEW,
                locked = true,
            ).holdMs,
        )
    }

    @Test
    fun `the exemption is the only thing a control has to type`() {
        // THE DIRECTION THE DEFAULT FAILS IN, which is the whole reason it is allowed to have one.
        // The composable door defaults effect to ACTS, so a control whose author never thought about
        // the lock becomes a hold in the air. The opposite default would leave that control live under
        // canopy with nothing red anywhere.
        // The DIRECTION itself is measured in ADefaultFailsTowardsTheGateTest, on a control that omits
        // the argument. Pinning the enum's order here instead was a proxy that was false both ways:
        // reordering the entries for readability turned it red while changing nothing about safety,
        // and turning the parameter's default to the unsafe answer left it green (skyvw:1).
        assertTrue(
            "the locking answer and the exempt answer resolved the same, so the marker decides nothing",
            resolve(CircleActionTiming.IMMEDIATE, CircleActionHostCost.WORN, locked = true).holdMs >
                resolve(
                    CircleActionTiming.IMMEDIATE,
                    CircleActionHostCost.WORN,
                    effect = CircleActionEffect.MOVES_THE_VIEW,
                    locked = true,
                ).holdMs,
        )
    }

    private fun resolve(
        timing: CircleActionTiming,
        hostCost: CircleActionHostCost,
        holdMs: Long = timing.holdMs,
        effect: CircleActionEffect = CircleActionEffect.ACTS,
        locked: Boolean = false,
    ) = resolveCircleTiming(timing, holdMs, effect, hostCost, locked)
}
