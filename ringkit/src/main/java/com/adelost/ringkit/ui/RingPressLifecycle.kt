package com.adelost.ringkit.ui

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.RingIcons

/** State and lifecycle for actions whose meaning lasts exactly while pressed. */
data class RingPressLifecycleSpec(
    val label: String,
    val active: Boolean,
    val enabled: Boolean,
    val centerValue: String? = null,
    val sub: String? = null,
    val onBegin: () -> Boolean,
    val onRelease: () -> Unit,
    val onCancel: () -> Unit,
)

/**
 * Push-to-talk, jog and other press/release verbs use the normal icon ring.
 * The interaction changes; the pixels do not.
 */
@Composable
fun RingPressLifecycle(
    spec: RingPressLifecycleSpec,
    modifier: Modifier = Modifier,
    diameter: Dp = 80.dp,
) {
    val view = LocalView.current
    IconRing(
        icon = RingIcons.Record,
        label = spec.label,
        onTap = {},
        active = spec.active,
        centerValue = spec.centerValue,
        sub = spec.sub,
        diameter = diameter,
        modifier = modifier.pointerInput(spec.enabled, spec.onBegin, spec.onRelease, spec.onCancel) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                down.consume()
                if (!spec.enabled || !spec.onBegin()) return@awaitEachGesture
                view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                val up = waitForUpOrCancellation()
                if (up == null) spec.onCancel() else spec.onRelease()
            }
        },
    )
}
