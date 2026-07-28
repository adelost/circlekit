package com.adelost.designkit.ui

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
import kotlinx.coroutines.withTimeoutOrNull

/** Product action timing is semantic data, not a per-screen millisecond.
 * Transport/camera steps are harmless and reversible; navigation/state
 * changes keep the wrist-safe short intent gate. */
enum class SkyvwActionTiming(val holdMs: Long) {
    DELIBERATE(MenuDesign.tapHoldMs),
    IMMEDIATE(0L),
}

/**
 * What makes a press count: it lasted at least [holdMs]. THE rule, so the
 * rung cannot drift between the gates below.
 */
fun isSkyvwHoldComplete(pressDurationMs: Long, holdMs: Long = MenuDesign.tapHoldMs): Boolean =
    pressDurationMs >= holdMs

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
 * [feedback] is the sole press state for the control. The gesture never draws
 * into its own bounds: the component renders that state once, on its label (or
 * as a pressed affordance when it has no label). This prevents a button-wide
 * fill and a label fill from describing the same wait twice.
 */
fun Modifier.skyvwSafeTap(
    feedback: SkyvwActionFeedbackState,
    enabled: Boolean = true,
    holdMs: Long = MenuDesign.tapHoldMs,
    consumeDown: Boolean = false,
    onTap: () -> Unit,
): Modifier = composed {
    if (!enabled) {
        Modifier
    } else {
        val latestTap = rememberUpdatedState(onTap)
        Modifier
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
 * The same gate for a control that ALSO carries a longer press: holding to
 * [holdMs] fires the action, holding past [longPressMs] fires the long one
 * instead.
 *
 * Both rungs are real holds now, so they must be separated by enough time to
 * be told apart by a human thumb; the require below refuses a configuration
 * where the long press is unreachable rather than shipping a control whose
 * second gesture can never win.
 */
fun Modifier.skyvwSafeTapOrHold(
    feedback: SkyvwActionFeedbackState,
    enabled: Boolean = true,
    holdMs: Long = MenuDesign.tapHoldMs,
    longPressMs: Long = MenuDesign.holdDestructiveMs,
    consumeDown: Boolean = false,
    onLongPress: () -> Unit,
    onTap: () -> Unit,
): Modifier = composed {
    require(longPressMs > holdMs) {
        "long press ($longPressMs ms) must outlast the action rung ($holdMs ms)"
    }
    if (!enabled) {
        Modifier
    } else {
        val latestTap = rememberUpdatedState(onTap)
        val latestLongPress = rememberUpdatedState(onLongPress)
        Modifier
            .pointerInput(holdMs, longPressMs, consumeDown) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = !consumeDown)
                if (consumeDown) down.consume()
                feedback.pressed = true
                var completion = SkyvwGestureCompletion.NONE
                try {
                    var cancelled = false
                    val releasedEarly = withTimeoutOrNull(longPressMs) {
                        val release = waitForUpOrCancellation()
                        cancelled = release == null
                        release
                    }
                    completion = when {
                        cancelled -> SkyvwGestureCompletion.NONE
                        releasedEarly == null -> SkyvwGestureCompletion.LONG_PRESS
                        isSkyvwHoldComplete(
                            releasedEarly.uptimeMillis - down.uptimeMillis,
                            holdMs,
                        ) -> SkyvwGestureCompletion.TAP
                        else -> SkyvwGestureCompletion.NONE
                    }
                } finally {
                    feedback.pressed = false
                }
                when (completion) {
                    SkyvwGestureCompletion.NONE -> Unit
                    SkyvwGestureCompletion.TAP -> latestTap.value()
                    SkyvwGestureCompletion.LONG_PRESS -> latestLongPress.value()
                }
            }
        }
    }
}

/** One state object joins gesture and label without screen-owned booleans. */
@Stable
class SkyvwActionFeedbackState internal constructor() {
    var pressed by mutableStateOf(false)
        internal set
}

@Composable
fun rememberSkyvwActionFeedbackState(): SkyvwActionFeedbackState =
    remember { SkyvwActionFeedbackState() }

private enum class SkyvwGestureCompletion { NONE, TAP, LONG_PRESS }
