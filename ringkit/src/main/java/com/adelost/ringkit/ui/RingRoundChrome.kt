package com.adelost.ringkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.*
import kotlin.math.cos
import kotlin.math.sin

/** A role's placement and action; the same slots also reserve space for rows. */
data class RingChromeAction(
    val slot: CircleChromeSlot,
    val icon: ImageVector,
    val label: String,
    val onTap: () -> Unit,
)

@Composable
fun RingRoundChrome(actions: List<RingChromeAction>) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        actions.forEach { action ->
            val diameter = MenuDesign.watchActionRingDiameter
            val radius = minOf(maxWidth.value, maxHeight.value) / 2f * RadialChromeDesign.slotRadiusFraction
            val angle = Math.toRadians(action.slot.angleFromTopDeg.toDouble())
            CircleIconDisc(
                icon = action.icon, contentDescription = action.label,
                actionLabel = action.label, onTap = action.onTap,
                diameter = diameter,
                modifier = Modifier.offset(
                    (maxWidth.value / 2f + radius * sin(angle).toFloat() - diameter.value / 2f).dp,
                    (maxHeight.value / 2f - radius * cos(angle).toFloat() - diameter.value / 2f).dp,
                ),
            )
        }
    }
}

/** Standalone modal hosts opt in; existing product shells keep their own chrome. */
@Composable
fun RingRoundBackHost(onBack: () -> Unit, content: @Composable () -> Unit) {
    if (LocalCircleSurfaceLayout.current.surfaceClass != CircleSurfaceClass.ROUND) {
        content()
        return
    }
    val actions = listOf(RingChromeAction(CircleChromeSlot.HOUR_9, RingIcons.Cross, "Back", onBack))
    CompositionLocalProvider(LocalRoundChromeReservation provides actions.map { it.slot }) {
        Box(Modifier.fillMaxSize()) {
            content()
            RingRoundChrome(actions)
        }
    }
}
