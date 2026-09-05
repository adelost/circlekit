package com.adelost.ringkit.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.input.pointer.pointerInput
import com.adelost.designkit.ui.*

/** Only the touched row exposes transient help in dense instrument menus. */
internal data class RingRowInfoSelection(val selectedRowKey: String? = null)

internal fun nextRingRowInfoSelection(
    current: RingRowInfoSelection,
    touchedRowKey: String,
    hasExplanation: Boolean,
): RingRowInfoSelection {
    require(touchedRowKey.isNotBlank())
    val selected = touchedRowKey.takeIf { hasExplanation }
    return if (current.selectedRowKey == selected) current else RingRowInfoSelection(selected)
}

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

/** Info is an ordinary icon action: same geometry, hit target and timing law. */
@Composable
fun RingInfoButton(contentDescription: String, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val design = phoneSurfaceDesignFor(LocalCircleSurfaceLayout.current.surfaceClass)
    CircleIconDisc(
        icon = RingIcons.Info, contentDescription = contentDescription,
        actionLabel = "INFO", onTap = onOpen, modifier = modifier,
        diameter = design?.rowIconDiameter ?: MenuDesign.watchActionRingDiameter,
        iconSize = design?.rowIconSize ?: MenuDesign.iconSize,
    )
}

@Composable
internal fun RingRowInfoButton(
    rowIcon: androidx.compose.ui.graphics.vector.ImageVector?,
    title: String,
    value: String,
    hint: String,
    infoAction: CircleActionCueInfoAction?,
) {
    require(hint.isNotBlank())
    val publish = LocalCircleActionCuePublisher.current
    val owner = remember { Any() }
    val cue = remember(rowIcon, title, value, hint, infoAction) {
        CircleActionCue(
            icon = rowIcon ?: RingIcons.Info,
            label = title, progress = 1f, confirmed = false,
            value = value.takeIf(String::isNotBlank), hint = hint,
            infoAction = infoAction, lingers = true,
        )
    }
    RingInfoButton("ABOUT $title", onOpen = { publish(CircleActionCueEvent(owner, cue)) })
}
