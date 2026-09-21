package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * WHAT A CONTROL ASKS OF A FINGER: the words a product declares it in, and the one value they resolve
 * to. Split out of CircleTapSafety.kt in row 215, which stood at 513 lines.
 *
 * The gestures that consume this live beside it, in that file. Everything here is vocabulary: a kind,
 * what a press changes, whether the surface is locked, and the single answer those three give.
 */

/** Product action timing is semantic data, not a per-screen millisecond.
 * Pure camera and local-view steps are harmless and reversible; navigation/state
 * changes keep the wrist-safe short intent gate.
 * WHAT: Defines the two product action timings.
 * WHY: Keeps semantic timing separate from host cost. */
enum class CircleActionTiming(val holdMs: Long) {
    DELIBERATE(MenuDesign.holdDeliberateMs),
    IMMEDIATE(0L),
}

/** WHAT: Names when a continuous press begins its content. WHY: Keeps recording duration separate from confirmation timing. */
enum class CirclePressStart {
    ON_DOWN,
    AFTER_INTENT_GATE,
}

/** WHAT: Names the cost a host adds to an immediate action. WHY: Keeps the kit from guessing Phone policy. */
enum class CircleActionHostCost(val holdMs: Long) {
    NONE(0L),
    WORN(MenuDesign.wornTouchCostMs),
}

/** WHAT: Maps both renderer profiles to explicit costs. WHY: Keeps device hardware from deciding preview behavior. */
data class CircleActionHostCosts(
    val responsive: CircleActionHostCost,
    val watchExact: CircleActionHostCost,
) {
    fun forMode(mode: CircleHostMode): CircleActionHostCost = when (mode) {
        CircleHostMode.RESPONSIVE -> responsive
        CircleHostMode.WATCH_EXACT -> watchExact
    }
}

/** No default: every mounted host states the immediate-action cost it fulfils. */
val LocalCircleActionHostCost = staticCompositionLocalOf<CircleActionHostCost> {
    error("CircleActionHostCost is absent: CircleHostSurface must receive explicit responsive and WATCH_EXACT costs")
}

/** WHAT: Resolves a continuous press start to one lifecycle timing. WHY: Keeps ON_DOWN independent from host and lock costs. */
fun resolveCirclePressStart(
    start: CirclePressStart,
    gatedTiming: CircleResolvedTiming?,
): CircleResolvedTiming = when (start) {
    CirclePressStart.ON_DOWN -> {
        require(gatedTiming == null) { "ON_DOWN carries no intent timing because its duration is content" }
        CircleResolvedTiming(0L)
    }
    CirclePressStart.AFTER_INTENT_GATE -> requireNotNull(gatedTiming) {
        "AFTER_INTENT_GATE requires one already resolved timing"
    }
}

/**
 * THE ONE ANSWER a control's declared timing gives, in milliseconds, read by the press GATE and by
 * the wait the control DRAWS alike.
 *
 * It exists because those two used to resolve the same declaration separately, and a control could
 * therefore draw a deliberate wait while committing on release. Measured on Link 1.2.23, 2026-09-20:
 * its WAKE PHRASE row drew a half-second arc (152 px of ink at 100 ms, 454 at 250, 683 at 450) and
 * switched on a press of ONE millisecond, because a host-wide override reached the gate and never
 * reached the drawing. Mattias, the same day: "det ska inte finnas något mellanting liksom, bara de
 * här två typerna utav knappar".
 *
 * TWO KINDS AND NOTHING BETWEEN, which is what this function is for: an IMMEDIATE control takes the
 * host's explicitly supplied touch cost, unless it only moves the view, and a DELIBERATE one holds
 * for the duration it declares. The in-betweens are refused here rather than shipped: a deliberate
 * control with no duration commits at once while claiming to wait, and one that holds for less than
 * [CIRCLE_CUE_BRUSH_MIN_MS] gates a press that row 215's cue deliberately never draws, which is the
 * same silence from the other side.
 * WHAT: Resolves one timing for a mounted control.
 * WHY: Keeps gate, cue and commit on one duration.
 */
@Composable
fun circleResolvedTiming(
    timing: CircleActionTiming,
    holdMs: Long = timing.holdMs,
    effect: CircleActionEffect = CircleActionEffect.ACTS,
): CircleResolvedTiming = resolveCircleTiming(
    timing,
    holdMs,
    effect,
    LocalCircleActionHostCost.current,
    LocalCircleTouchLock.current,
)

/**
 * The same rule without a composition, so a case can walk locked and unlocked without mounting one.
 *
 * INTERNAL FOREVER, and counted. [circleResolvedTiming] is the only door a product has and the only
 * reader of the lock; this one takes the lock as an argument, so a caller that reaches it can pass
 * false and ship a control that is never locked anywhere with nothing red. `internal` closes that door
 * for products and not for the kit's own twenty gesture sites, so
 * TheLockHasOneReaderTest counts the callers by name instead: exactly one
 * in production, [circleResolvedTiming] itself, plus the named test helper. Without that count, "the
 * builder is the only reader of the lock" is advice.
 */
internal fun resolveCircleTiming(
    timing: CircleActionTiming,
    holdMs: Long,
    effect: CircleActionEffect,
    hostCost: CircleActionHostCost,
    locked: Boolean,
): CircleResolvedTiming {
    require(holdMs >= 0L) { "A control's hold cannot be negative" }
    require(timing == CircleActionTiming.IMMEDIATE || holdMs > CIRCLE_CUE_BRUSH_MIN_MS) {
        "A deliberate control holds for longer than the brush minimum ($CIRCLE_CUE_BRUSH_MIN_MS ms), " +
            "because a hold the cue refuses to draw is a wait nobody is told about; " +
            "${CircleActionTiming.IMMEDIATE} is how a control says it does not wait"
    }
    val declared = when {
        timing == CircleActionTiming.DELIBERATE -> holdMs
        effect != CircleActionEffect.ACTS -> 0L
        else -> hostCost.holdMs
    }
    // The lock never SHORTENS a hold: a destructive control does not get cheaper because the wearer is
    // under canopy. And it lengthens rather than refuses, because a control that looks pressable and
    // can never be pressed is the third kind of button Mattias threw out; in the air every control is
    // the hold kind, and its ring teaches that the first time it is touched (skyvw:1, row 229).
    val lockApplies = locked && effect == CircleActionEffect.ACTS
    return CircleResolvedTiming(if (lockApplies) maxOf(declared, MenuDesign.holdConfirmMs) else declared)
}

/**
 * WHAT A PRESS CHANGES, which is the only thing that can excuse it from a locked surface.
 *
 * INGREDIENTS OR ANSWER, NEVER BOTH. A renderer takes either the ingredients, a kind and this, or the
 * ANSWER, a [CircleResolvedTiming]. Never both: a row carrying the resolved value AND an effect would
 * carry the same fact twice and the two could disagree, which is row 225 exactly, a gate reading one
 * number while the drawing read another and nothing red anywhere. The asymmetry in the parameter lists
 * is deliberate and is not to be tidied away (skyvw:1, 2026-09-20). For a renderer that takes the
 * answer, the control IS the call site that builds it: the exception is declared one line above the
 * row instead of inside its parameter list, still typed by name and still impossible to leave unwired.
 *
 * THE DEFAULT FAILS TOWARDS THE LOCK, and that is the whole reason it is allowed to have one: a
 * control whose author never thought about this is [ACTS], so it becomes a hold in the air. Had the
 * default been the other way, forgetting it would leave a control live under canopy with nothing red
 * anywhere. The exception is what has to be typed, by name, with its reason in the declaration.
 */
enum class CircleActionEffect {
    /** It navigates, steps data, toggles a layer or writes. Everything, unless stated otherwise. */
    ACTS,

    /**
     * A pure view operation on the surface being flown, and nothing else.
     *
     * A jumper steering to a landing area must not need a one-second hold in gloves to get the map
     * back on themselves, and a brushed recentre or zoom costs nothing the next press does not give
     * back (lsrc:0, 2026-09-20, correcting his own earlier ruling). Today that is the glass zoom pair
     * and the aim. Anything that leaves something changed behind it is not in this class.
     */
    MOVES_THE_VIEW,

    /**
     * Moves a transient cursor inside the already open view and writes nothing.
     * Time stepping, previous/next frames and returning to NOW are this class.
     */
    BROWSES_LOCAL_VIEW,
}

/**
 * WHETHER THE SURFACE UNDER THE FINGER IS LOCKED, read by [circleResolvedTiming] and by nothing else.
 *
 * One reader, at the moment the number is resolved, so the gate, the cue and the drawing are already
 * locked because they take that number. A parameter instead would be 27 call sites that can forget it,
 * and one that forgets is a control keeping its tap in freefall with nothing red anywhere.
 *
 * Unlocked by default because a kit with no phase model has no lock. What has no default is the
 * control: nothing opts out, and the lock is never a flag on a button.
 */
val LocalCircleTouchLock = staticCompositionLocalOf { false }

/**
 * A CONTROL'S RESOLVED TIMING, which is the only timing anything downstream is allowed to see.
 *
 * [circleResolvedTiming] is the only way to make one, because its constructor is internal to this kit.
 * So a raw millisecond cannot reach a gate, a cue or a drawing without passing the two-kinds rule
 * first, and a component cannot hand one reader a different number than another: there is one value
 * and every reader takes THE value rather than its own parameter beside it.
 *
 * What it replaces is four parallel names for the same declaration, `timing` and `holdMs` and
 * `actionHoldMs` and `pressHoldMs`, any two of which could disagree. They did: Link 1.2.23's WAKE
 * PHRASE row drew a half-second arc and switched on a press of ONE millisecond, because a host-wide
 * override reached the gate and never reached the drawing. That defect is now unwritable rather than
 * tested for.
 */
@JvmInline
value class CircleResolvedTiming internal constructor(val holdMs: Long) {

    /** A control draws a wait exactly while it has one to wait out. The gate and the drawing read this. */
    val drawsAWait: Boolean get() = holdMs > 0L

    override fun toString(): String = if (drawsAWait) "a $holdMs ms hold" else "no hold"
}

/**
 * What makes a press count: it lasted at least as long as the control's resolved hold. THE rule, so
 * the rung cannot drift between the gates below.
 *
 * No default: a gate whose duration is assumed is a gate nobody declared.
 */
fun isCircleHoldComplete(pressDurationMs: Long, timing: CircleResolvedTiming): Boolean =
    pressDurationMs >= timing.holdMs
