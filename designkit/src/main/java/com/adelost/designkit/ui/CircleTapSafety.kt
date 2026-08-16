package com.adelost.designkit.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
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
 * What makes a press count: it lasted at least [holdMs]. THE rule, so the
 * rung cannot drift between the gates below.
 */
fun isCircleHoldComplete(pressDurationMs: Long, holdMs: Long = MenuDesign.tapHoldMs): Boolean =
    pressDurationMs >= holdMs

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
 * When [label] is declared this atom owns both the spoken name and the action.
 * A visual child must then be semantically silent; relying on arbitrary child
 * semantics to merge can leave a named inert node beside an unnamed action.
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
    holdMs: Long = MenuDesign.tapHoldMs,
    consumeDown: Boolean = false,
    label: String? = null,
    onTap: () -> Unit,
): Modifier = composed {
    if (!enabled) {
        if (label == null) Modifier else Modifier.semantics(mergeDescendants = true) {
            contentDescription = label
        }
    } else {
        val latestTap = rememberUpdatedState(onTap)
        Modifier
            .semantics(mergeDescendants = true) {
                label?.let { contentDescription = it }
                onClick {
                    latestTap.value()
                    true
                }
            }
            .pointerInput(holdMs, consumeDown) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = !consumeDown)
                    if (consumeDown) down.consume()
                    feedback.pressed = true
                    var commits = false
                    try {
                        var cancelled = false
                        val releasedEarly = withTimeoutOrNull(holdMs) {
                            val release = waitForUpOrCancellation()
                            cancelled = release == null
                            release
                        }
                        // Timing out with the finger still down IS completion.
                        commits = releasedEarly == null && !cancelled
                    } finally {
                        // Cancellation, navigation and disabled-state changes
                        // can all dispose pointer input mid-press. Never leave
                        // the shared label state stuck on.
                        feedback.pressed = false
                    }
                    if (commits) latestTap.value()
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
    holdMs: Long = MenuDesign.tapHoldMs,
    onBegin: () -> Boolean,
    onRelease: () -> Unit,
    onCancel: () -> Unit,
): Modifier = composed {
    require(holdMs >= 0L) { "Press lifecycle hold duration cannot be negative" }
    if (!enabled) {
        Modifier
    } else {
        val view = LocalView.current
        val latestBegin = rememberUpdatedState(onBegin)
        val latestRelease = rememberUpdatedState(onRelease)
        val latestCancel = rememberUpdatedState(onCancel)
        Modifier.pointerInput(holdMs) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                down.consume()
                feedback.pressed = true
                var active = false
                try {
                    var cancelled = false
                    val releasedBeforeActivation = withTimeoutOrNull(holdMs) {
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
                    view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
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
 * [holdMs] fires the action, holding past [longPressMs] fires the long one
 * instead.
 *
 * Both rungs are real holds now, so they must be separated by enough time to
 * be told apart by a human thumb; the require below refuses a configuration
 * where the long press is unreachable rather than shipping a control whose
 * second gesture can never win.
 *
 * When [label] is declared the same named node exposes the ordinary action as
 * a click and the longer action as a long click. Pointer timing is unchanged.
 */
fun Modifier.circleSafeTapOrHold(
    feedback: CircleActionFeedbackState,
    enabled: Boolean = true,
    holdMs: Long = MenuDesign.tapHoldMs,
    longPressMs: Long = MenuDesign.holdDestructiveMs,
    consumeDown: Boolean = false,
    label: String? = null,
    onLongPress: () -> Unit,
    onTap: () -> Unit,
): Modifier = composed {
    require(longPressMs > holdMs) {
        "long press ($longPressMs ms) must outlast the action rung ($holdMs ms)"
    }
    if (!enabled) {
        if (label == null) Modifier else Modifier.semantics(mergeDescendants = true) {
            contentDescription = label
        }
    } else {
        val latestTap = rememberUpdatedState(onTap)
        val latestLongPress = rememberUpdatedState(onLongPress)
        val semantics = if (label == null) {
            Modifier
        } else {
            Modifier.semantics(mergeDescendants = true) {
                contentDescription = label
                onClick {
                    latestTap.value()
                    true
                }
                onLongClick {
                    latestLongPress.value()
                    true
                }
            }
        }
        semantics
            .pointerInput(holdMs, longPressMs, consumeDown) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = !consumeDown)
                if (consumeDown) down.consume()
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
                            holdMs,
                        ) -> CircleGestureCompletion.TAP
                        else -> CircleGestureCompletion.NONE
                    }
                } finally {
                    feedback.pressed = false
                }
                when (completion) {
                    CircleGestureCompletion.NONE -> Unit
                    CircleGestureCompletion.TAP -> latestTap.value()
                    CircleGestureCompletion.LONG_PRESS -> latestLongPress.value()
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
}

@Composable
fun rememberCircleActionFeedbackState(): CircleActionFeedbackState =
    remember { CircleActionFeedbackState() }

private enum class CircleGestureCompletion { NONE, TAP, LONG_PRESS }
