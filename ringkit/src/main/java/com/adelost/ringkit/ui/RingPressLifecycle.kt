package com.adelost.ringkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CirclePressStart
import com.adelost.designkit.ui.CirclePressIconRing
import com.adelost.designkit.ui.CircleResolvedTiming
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.resolveCirclePressStart

/** WHAT: Carries one continuous press lifecycle. WHY: Keeps content duration separate from discrete action timing. */
data class RingPressLifecycleSpec(
    val label: String,
    val active: Boolean,
    val enabled: Boolean,
    val centerValue: String? = null,
    val sub: String? = null,
    /** No default: a press verb states whether content begins on DOWN or after an intent gate. */
    val start: CirclePressStart,
    /** Present only for [CirclePressStart.AFTER_INTENT_GATE], already resolved from host and lock. */
    val timing: CircleResolvedTiming? = null,
    val onBegin: () -> Boolean,
    val onRelease: () -> Unit,
    val onCancel: () -> Unit,
) {
    init {
        resolveCirclePressStart(start, timing)
    }
}

/**
 * Push-to-talk, jog and other press/release verbs use the normal icon ring.
 * The interaction changes; the pixels do not.
 * WHAT: Builds one continuous press lifecycle.
 * WHY: Keeps start semantics and ring feedback on one owner.
 */
@Composable
fun RingPressLifecycle(
    spec: RingPressLifecycleSpec,
    modifier: Modifier = Modifier,
    diameter: Dp = 80.dp,
) {
    val timing = resolveCirclePressStart(spec.start, spec.timing)
    CirclePressIconRing(
        icon = RingIcons.Record,
        label = spec.label,
        active = spec.active,
        enabled = spec.enabled,
        centerValue = spec.centerValue,
        sub = spec.sub,
        diameter = diameter,
        timing = timing,
        onBegin = spec.onBegin,
        onRelease = spec.onRelease,
        onCancel = spec.onCancel,
        modifier = modifier,
    )
}
