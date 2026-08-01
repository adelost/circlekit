package com.adelost.ringkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CirclePressIconRing
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons

/** State and lifecycle for actions whose meaning lasts exactly while pressed. */
data class RingPressLifecycleSpec(
    val label: String,
    val active: Boolean,
    val enabled: Boolean,
    val centerValue: String? = null,
    val sub: String? = null,
    val holdMs: Long = MenuDesign.tapHoldMs,
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
    CirclePressIconRing(
        icon = RingIcons.Record,
        label = spec.label,
        active = spec.active,
        enabled = spec.enabled,
        centerValue = spec.centerValue,
        sub = spec.sub,
        diameter = diameter,
        holdMs = spec.holdMs,
        onBegin = spec.onBegin,
        onRelease = spec.onRelease,
        onCancel = spec.onCancel,
        modifier = modifier,
    )
}
