package com.adelost.designkit.ui

/**
 * A control's timing on an unlocked surface, for a case with no composition to read a lock from.
 *
 * The production door, [circleResolvedTiming], is composable precisely because it reads
 * [LocalCircleTouchLock] itself: a product cannot pass the lock and so cannot forget it. A rule case
 * states the lock as an argument instead, which is what [resolveCircleTiming] is for; this names the
 * unlocked half so a case about something else does not have to say so.
 */
internal fun unlockedTiming(
    timing: CircleActionTiming,
    holdMs: Long = timing.holdMs,
    effect: CircleActionEffect = CircleActionEffect.ACTS,
): CircleResolvedTiming = resolveCircleTiming(timing, holdMs, effect, locked = false)
