package com.adelost.ringkit.ui

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleActionCueEvent
import com.adelost.designkit.ui.CircleActionCueInfoAction
import com.adelost.designkit.ui.CircleIcon
import com.adelost.designkit.ui.LocalCircleActionCuePublisher
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.circleBrandColor
import com.adelost.designkit.ui.circleProgressContour
import com.adelost.designkit.ui.circleRingContour
import kotlinx.coroutines.withTimeoutOrNull

/** Exactly one row on a Rows surface may expose the transient info affordance. */
internal data class RingRowInfoSelection(
    val selectedRowKey: String? = null,
)

/** Touching another row moves the affordance; a row without copy hides it. */
internal fun nextRingRowInfoSelection(
    current: RingRowInfoSelection,
    touchedRowKey: String,
    hasExplanation: Boolean,
): RingRowInfoSelection {
    require(touchedRowKey.isNotBlank()) { "A touched row needs a stable key" }
    val selected = touchedRowKey.takeIf { hasExplanation }
    return if (current.selectedRowKey == selected) current else RingRowInfoSelection(selected)
}

internal enum class RingRowInfoPressCompletion { NONE, OPEN }

/** One pure decision shared by the gesture and its focused regression test. */
internal fun ringRowInfoPressCompletion(
    releasedBeforeHold: Boolean,
    cancelled: Boolean,
): RingRowInfoPressCompletion = if (!releasedBeforeHold && !cancelled) {
    RingRowInfoPressCompletion.OPEN
} else {
    RingRowInfoPressCompletion.NONE
}

/** Observes a down without consuming it, so the row keeps its original action. */
fun Modifier.selectRingInfoOnTouch(onTouch: (() -> Unit)?): Modifier = composed {
    if (onTouch == null) return@composed Modifier
    val latestTouch = rememberUpdatedState(onTouch)
    Modifier.pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown(requireUnconsumed = false)
            latestTouch.value()
            waitForUpOrCancellation()
        }
    }
}

/** A dedicated hold-only gesture. Lifting early is always silent. */
private fun Modifier.openRingRowInfoOnHold(
    pressed: (Boolean) -> Unit,
    onOpen: () -> Unit,
): Modifier = composed {
    val view = LocalView.current
    val latestPressed = rememberUpdatedState(pressed)
    val latestOpen = rememberUpdatedState(onOpen)
    Modifier.pointerInput(Unit) {
        awaitEachGesture {
            val down = awaitFirstDown(requireUnconsumed = false)
            down.consume()
            latestPressed.value(true)
            var cancelled = false
            val released = try {
                withTimeoutOrNull(MenuDesign.rowInfoHoldMs) {
                    waitForUpOrCancellation().also { cancelled = it == null }
                }
            } finally {
                latestPressed.value(false)
            }
            if (ringRowInfoPressCompletion(released != null, cancelled) == RingRowInfoPressCompletion.OPEN) {
                view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                latestOpen.value()
            }
        }
    }
}

/**
 * The only generic route from row hint data to the blocking explanation.
 * It is mounted only for the last-touched row and opens only after this small
 * icon itself completes its hold.
 */
@Composable
fun RingInfoButton(
    contentDescription: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var isPressed by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val progress by animateFloatAsState(
        targetValue = if (isPressed) 1f else 0f,
        animationSpec = tween(
            durationMillis = if (isPressed) MenuDesign.rowInfoHoldMs.toInt() else 0,
            easing = LinearEasing,
        ),
        label = "ring-info-hold",
    )
    Box(
        modifier = modifier
            .size(MenuDesign.rowInfoDiameter)
            .clip(CircleShape)
            .circleRingContour(RingTokens.NeutralRing)
            .circleProgressContour(progress.takeIf { it > 0f }, circleBrandColor())
            .openRingRowInfoOnHold(
                pressed = { isPressed = it },
                onOpen = onOpen,
            ),
        contentAlignment = Alignment.Center,
    ) {
        CircleIcon(
            imageVector = RingIcons.Info,
            contentDescription = contentDescription,
            tint = RingTokens.Dim,
            modifier = Modifier.size(MenuDesign.rowInfoIconSize),
        )
    }
}

@Composable
internal fun RingRowInfoButton(
    rowIcon: androidx.compose.ui.graphics.vector.ImageVector?,
    title: String,
    value: String,
    hint: String,
    infoAction: CircleActionCueInfoAction?,
) {
    require(hint.isNotBlank()) { "An info affordance needs declared explanatory copy" }
    val publish = LocalCircleActionCuePublisher.current
    val owner = remember { Any() }
    val cue = remember(rowIcon, title, value, hint, infoAction) {
        CircleActionCue(
            icon = rowIcon ?: RingIcons.Info,
            label = title,
            progress = 1f,
            confirmed = false,
            value = value.takeIf { it.isNotBlank() },
            hint = hint,
            infoAction = infoAction,
            lingers = true,
        )
    }
    RingInfoButton(
        contentDescription = "ABOUT $title",
        onOpen = { publish(CircleActionCueEvent(owner, cue)) },
    )
}
