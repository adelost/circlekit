package com.adelost.designkit.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.animation.core.Animatable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.semantics
import kotlinx.coroutines.withTimeoutOrNull

/** Product action timing is semantic data, not a per-screen millisecond.
 * Transport/camera steps are harmless and reversible; navigation/state
 * changes keep the wrist-safe short intent gate. */
enum class CircleActionTiming(val holdMs: Long) {
    DELIBERATE(MenuDesign.tapHoldMs),
    IMMEDIATE(0L),
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
 * TWO KINDS AND NOTHING BETWEEN, which is what this function is for: an IMMEDIATE control has NO
 * hold, whatever millisecond value rides along with it, and a DELIBERATE one holds for the duration
 * it declares. The in-betweens are refused here rather than shipped: a deliberate control with no
 * duration commits at once while claiming to wait, and one that holds for less than
 * [CIRCLE_CUE_BRUSH_MIN_MS] gates a press that row 215's cue deliberately never draws, which is the
 * same silence from the other side.
 */
@Composable
fun circleResolvedTiming(
    timing: CircleActionTiming,
    holdMs: Long = timing.holdMs,
    effect: CircleActionEffect = CircleActionEffect.ACTS,
): CircleResolvedTiming = resolveCircleTiming(timing, holdMs, effect, LocalCircleTouchLock.current)

/**
 * The same rule without a composition, so a case can walk locked and unlocked without mounting one.
 *
 * Internal on purpose: [circleResolvedTiming] is the only door a product has, and it is the door that
 * reads the lock. A caller that could pass `locked` could pass false.
 */
internal fun resolveCircleTiming(
    timing: CircleActionTiming,
    holdMs: Long,
    effect: CircleActionEffect,
    locked: Boolean,
): CircleResolvedTiming {
    require(holdMs >= 0L) { "A control's hold cannot be negative" }
    require(timing == CircleActionTiming.IMMEDIATE || holdMs > CIRCLE_CUE_BRUSH_MIN_MS) {
        "A deliberate control holds for longer than the brush minimum ($CIRCLE_CUE_BRUSH_MIN_MS ms), " +
            "because a hold the cue refuses to draw is a wait nobody is told about; " +
            "${CircleActionTiming.IMMEDIATE} is how a control says it does not wait"
    }
    val declared = if (timing == CircleActionTiming.IMMEDIATE) 0L else holdMs
    // The lock never SHORTENS a hold: a destructive control does not get cheaper because the wearer is
    // under canopy. And it lengthens rather than refuses, because a control that looks pressable and
    // can never be pressed is the third kind of button Mattias threw out; in the air every control is
    // the hold kind, and its ring teaches that the first time it is touched (skyvw:1, row 229).
    val locked = locked && effect == CircleActionEffect.ACTS
    return CircleResolvedTiming(if (locked) maxOf(declared, MenuDesign.holdConfirmMs) else declared)
}

/**
 * WHAT A PRESS CHANGES, which is the only thing that can excuse it from a locked surface.
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

/** The continuous action may start only when the gate completed under touch. */
internal fun continuousPressMayBegin(
    releasedBeforeActivation: Boolean,
    cancelled: Boolean,
): Boolean = !releasedBeforeActivation && !cancelled

/**
 * The press gate every plain control shares: hold for [MenuDesign.tapHoldMs]
 * and the action fires while the finger is still down. Completion IS the
 * commit — the same semantics as the longer confirmation rungs, with a short
 * duration appropriate for ordinary navigation.
 *
 * This shipped as a click for one day (press briefly, then release inside the
 * control). A click is cheap to make by accident on a wrist, and touching a
 * screen you are wearing is not the same act as deciding something: "touchen
 * vi har nu är jobbig ... du behöver hålla inne" (Mattias 2026-07-22). Holding
 * costs 200 ms of intent, which a sleeve, a graze or a passing thumb normally
 * never spends without making ordinary navigation feel held back.
 *
 * A touch a scroll container claims is a cancel, never an action. Releasing
 * early cancels too, by construction: nothing has fired yet.
 *
 * [label] is required-but-nullable so every caller must choose its semantic
 * owner explicitly. A string means this atom owns both the spoken name and the
 * action; visual children carrying the same copy must then be silent. Explicit
 * null means the caller intentionally derives the name from merged child
 * semantics. Omitting the decision is a compile error: relying accidentally on
 * arbitrary child merging left named inert nodes beside unnamed actions.
 *
 * Assistive technology activates the same production action through the
 * standard semantics click. That accommodation is intentionally immediate:
 * a screen-reader action is already an explicit decision and cannot perform
 * the raw pointer hold. Pointer input still follows the unchanged hold gate.
 *
 * [feedback] is the sole press state for the control. The gesture never draws
 * into its own bounds: the component renders that state once, on its label (or
 * as a pressed affordance when it has no label). This prevents a button-wide
 * fill and a label fill from describing the same wait twice.
 */
fun Modifier.circleSafeTap(
    feedback: CircleActionFeedbackState,
    enabled: Boolean = true,
    timing: CircleResolvedTiming,
    consumeDown: Boolean = false,
    label: String?,
    cue: CirclePressCue = CirclePressCue.AUTO,
    onTap: () -> Unit,
): Modifier = composed {
    if (!enabled) {
        Modifier.circleActionSemantics(label, enabled = false) {}
    } else {
        val latestTap = rememberUpdatedState(onTap)
        val haptics = rememberUpdatedState(circleTouchHapticFeedback())
        CircleHoldCueDriver(feedback, timing)
        Modifier
            .circleActionSemantics(label, enabled = true) { latestTap.value() }
            .circlePressCue(feedback, cue)
            .pointerInput(timing, consumeDown) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = !consumeDown)
                    if (consumeDown) down.consume()
                    feedback.pressedAtMs = down.uptimeMillis
                    feedback.pressed = true
                    var commits = false
                    try {
                        if (!timing.drawsAWait) {
                            // A normal click commits on release, so starting a
                            // scroll over a row cannot accidentally select it.
                            val up = waitForUpOrCancellation()
                            commits = up != null
                            up?.consume()
                        } else {
                        var cancelled = false
                        val releasedEarly = withTimeoutOrNull(timing.holdMs) {
                            val release = waitForUpOrCancellation()
                            cancelled = release == null
                            release
                        }
                        // Timing out with the finger still down IS completion.
                        commits = releasedEarly == null && !cancelled
                        }
                    } finally {
                        // Cancellation, navigation and disabled-state changes
                        // can all dispose pointer input mid-press. Never leave
                        // the shared label state stuck on.
                        feedback.pressed = false
                    }
                    if (commits) {
                        haptics.value.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        latestTap.value()
                    }
                }
            }
    }
}

/**
 * One continuous press lifecycle: arm through the normal deliberate hold,
 * start while the finger is still down, then finish on release or cancel on
 * gesture loss. Unlike composing a no-op [circleSafeTap] with a second
 * pointer handler, the progress and the callbacks are driven by this single
 * gesture owner.
 */
fun Modifier.circlePressLifecycle(
    feedback: CircleActionFeedbackState,
    enabled: Boolean,
    timing: CircleResolvedTiming,
    cue: CirclePressCue = CirclePressCue.AUTO,
    onBegin: () -> Boolean,
    onRelease: () -> Unit,
    onCancel: () -> Unit,
): Modifier = composed {
        if (!enabled) {
        Modifier.semantics { disabled() }
    } else {
        val haptics = rememberUpdatedState(circleTouchHapticFeedback())
        val latestBegin = rememberUpdatedState(onBegin)
        val latestRelease = rememberUpdatedState(onRelease)
        val latestCancel = rememberUpdatedState(onCancel)
        CircleHoldCueDriver(feedback, timing)
        Modifier.circlePressCue(feedback, cue).pointerInput(timing) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                down.consume()
                feedback.pressedAtMs = down.uptimeMillis
                feedback.pressed = true
                var active = false
                try {
                    var cancelled = false
                    val releasedBeforeActivation = withTimeoutOrNull(timing.holdMs) {
                        val release = waitForUpOrCancellation()
                        cancelled = release == null
                        release
                    }
                    if (!continuousPressMayBegin(releasedBeforeActivation != null, cancelled)) {
                        return@awaitEachGesture
                    }
                    active = latestBegin.value()
                    if (!active) return@awaitEachGesture
                    // The intent gate is complete. Capture state now owns the
                    // visible active phase; leaving this true would restart
                    // the 0→1 arming cue throughout a long recording.
                    feedback.pressed = false
                    haptics.value.performHapticFeedback(HapticFeedbackType.LongPress)
                    val release = waitForUpOrCancellation()
                    // Terminal ownership ends before application code runs.
                    // A throwing callback must never make finally emit a
                    // second, contradictory cancellation.
                    active = false
                    if (release == null) latestCancel.value() else latestRelease.value()
                } finally {
                    feedback.pressed = false
                    if (active) latestCancel.value()
                }
            }
        }
    }
}

/**
 * The same gate for a control that ALSO carries a longer press: holding to
 * The resolved hold fires the action, holding past [longPressMs] fires the long one
 * instead.
 *
 * Both rungs are real holds now, so they must be separated by enough time to
 * be told apart by a human thumb; the require below refuses a configuration
 * where the long press is unreachable rather than shipping a control whose
 * second gesture can never win.
 *
 * [label] has the same required semantic-owner contract as [circleSafeTap]. A
 * string makes this node own both actions; explicit null deliberately derives
 * the name from merged children. Pointer timing is unchanged.
 */
fun Modifier.circleSafeTapOrHold(
    feedback: CircleActionFeedbackState,
    enabled: Boolean = true,
    timing: CircleResolvedTiming,
    longPressMs: Long = MenuDesign.holdDestructiveMs,
    consumeDown: Boolean = false,
    label: String?,
    cue: CirclePressCue = CirclePressCue.AUTO,
    onLongPress: () -> Unit,
    onTap: () -> Unit,
): Modifier = composed {
    require(longPressMs > timing.holdMs) {
        "long press ($longPressMs ms) must outlast the action rung (${timing.holdMs} ms)"
    }
    if (!enabled) {
        Modifier.circleActionSemantics(label, enabled = false) {}
    } else {
        val latestTap = rememberUpdatedState(onTap)
        val latestLongPress = rememberUpdatedState(onLongPress)
        val haptics = rememberUpdatedState(circleTouchHapticFeedback())
        CircleHoldCueDriver(feedback, timing)
        Modifier
            .circleActionSemantics(
                label,
                enabled = true,
                onLongPress = { latestLongPress.value() },
            ) { latestTap.value() }
            .circlePressCue(feedback, cue)
            .pointerInput(timing, longPressMs, consumeDown) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = !consumeDown)
                if (consumeDown) down.consume()
                feedback.pressedAtMs = down.uptimeMillis
                feedback.pressed = true
                var completion = CircleGestureCompletion.NONE
                try {
                    var cancelled = false
                    val releasedEarly = withTimeoutOrNull(longPressMs) {
                        val release = waitForUpOrCancellation()
                        cancelled = release == null
                        release
                    }
                    completion = when {
                        cancelled -> CircleGestureCompletion.NONE
                        releasedEarly == null -> CircleGestureCompletion.LONG_PRESS
                        isCircleHoldComplete(
                            releasedEarly.uptimeMillis - down.uptimeMillis,
                            timing,
                        ) -> CircleGestureCompletion.TAP
                        else -> CircleGestureCompletion.NONE
                    }
                } finally {
                    feedback.pressed = false
                }
                when (completion) {
                    CircleGestureCompletion.NONE -> Unit
                    CircleGestureCompletion.TAP -> {
                        haptics.value.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        latestTap.value()
                    }
                    CircleGestureCompletion.LONG_PRESS -> {
                        haptics.value.performHapticFeedback(HapticFeedbackType.LongPress)
                        latestLongPress.value()
                    }
                }
            }
        }
    }
}

/** One state object joins gesture and label without screen-owned booleans. */
@Stable
class CircleActionFeedbackState internal constructor() {
    var pressed by mutableStateOf(false)
        internal set

    internal val hold = Animatable(0f)

    /** The down event's own uptime: the cue's zero, so it is not two frames behind the gate. */
    internal var pressedAtMs: Long = 0L

    /**
     * How much of the gate this press has spent, 0 to 1, and 0 until the brush minimum has passed.
     *
     * The gesture drives it for every gated control, so a component that paints the wait itself
     * ([CirclePressCue.OWNED]) reads THIS rather than timing a second animation beside the one that
     * decides whether the press counts. Two clocks for one wait is how a cue and a gate drift apart.
     */
    val holdProgress: Float get() = hold.value
}

/**
 * WHO OWNS THIS CONTROL'S SPOKEN NAME, ITS ACTIONS AND ITS DISABLED STATE: one node, stated once.
 *
 * Split out in row 215 on the churn ledger's evidence, which named the price rather than the smell.
 * This block was written out three times in this file, and FIVE of the eight fixes these gates have
 * taken in 60 days changed it: who may merge with children (a31790232), that a disabled control must
 * still say it is disabled (8914bdebd), that the name's owner is a decision the caller cannot omit
 * (51212dea7), and two more. Every one of them had to be applied two to four times in one commit, and
 * the one it reached last was the one that had been wrong longest. The fixes came from this branch's
 * own state, not from a constant or an upstream value, so the ledger's answer is SPLIT.
 *
 * [label] keeps its contract exactly: a string means this node owns both the spoken name and the
 * action, so visual children must be silent; explicit null means the caller derives the name from
 * merged children. Assistive technology activates the production action immediately, because a
 * screen-reader action is already an explicit decision and cannot perform the raw pointer hold.
 *
 * circlePressLifecycle deliberately does NOT come here: its disabled node carries no label and does
 * not merge, which is a different contract, and folding it in would change a shipped one silently.
 */
private fun Modifier.circleActionSemantics(
    label: String?,
    enabled: Boolean,
    onLongPress: (() -> Unit)? = null,
    onTap: () -> Unit,
): Modifier = semantics(mergeDescendants = label == null) {
    label?.let { contentDescription = it }
    if (!enabled) {
        disabled()
        return@semantics
    }
    onClick {
        onTap()
        true
    }
    onLongPress?.let { long ->
        onLongClick {
            long()
            true
        }
    }
}

/**
 * The one clock behind every gated control's cue, wherever that cue is painted.
 *
 * It is mounted by the GESTURE rather than by the component, which is the whole of row 215: a control
 * that takes a hold gets the cue by taking the hold, and a hand-rolled one cannot be built without it.
 * The law it runs, including the brush minimum and the shape, is [runCircleHoldCue].
 */
@Composable
private fun CircleHoldCueDriver(feedback: CircleActionFeedbackState, timing: CircleResolvedTiming) {
    val pressed = feedback.pressed
    LaunchedEffect(feedback, pressed, timing) {
        runCircleHoldCue(feedback.hold, pressed, timing, feedback.pressedAtMs)
    }
}

/**
 * [CirclePressCue.AUTO] paints on the gesture's own bounds; OWNED leaves the glass to the component.
 *
 * The colour is the product's own accent, the same one this kit's other two progress renderers take,
 * so a held seat answers in the colour the wearer already reads as "this is happening".
 */
@Composable
private fun Modifier.circlePressCue(
    feedback: CircleActionFeedbackState,
    cue: CirclePressCue,
): Modifier = when (cue) {
    CirclePressCue.OWNED -> this
    CirclePressCue.AUTO -> this.circleHoldCue({ feedback.holdProgress }, circleBrandColor())
}

@Composable
fun rememberCircleActionFeedbackState(): CircleActionFeedbackState =
    remember { CircleActionFeedbackState() }

private enum class CircleGestureCompletion { NONE, TAP, LONG_PRESS }
