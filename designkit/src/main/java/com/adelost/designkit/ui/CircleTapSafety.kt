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
 *
 * A PRESS IN PROGRESS WHEN THE TIMING CHANGES IS CANCELLED, and that is declared rather than incidental.
 * The pointer block is keyed on [timing], so when a surface locks under a finger already down, the
 * block restarts and that gesture commits nothing. It is the outcome to want: the press was made
 * against a gate the wearer is no longer being asked for, and the next one is measured against the one
 * they are. Nobody has to notice; it is written here so the next reader does not file it as a defect.
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
