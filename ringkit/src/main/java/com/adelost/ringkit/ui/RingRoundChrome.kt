package com.adelost.ringkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
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

/**
 * Mount the shared round escape above [content]: a [BackRing] fixed at
 * 12 o'clock over a canvas-coloured cap (Mattias 2026-09-14: "bakknappen ska
 * väl vara ett eget lager så att de andra meny-itemsen ska inte tryckas
 * undan"). It claims no rim slot, so rows keep one stable straight edge and
 * scroll under the cap instead of stepping aside. Content reads
 * [LocalRoundBackLayer] only to start its title below the control.
 *
 * Non-round hosts render [content] unchanged; phone screens carry their own
 * header back.
 */
@Composable
fun RingRoundBackHost(
    onBack: () -> Unit,
    label: String = "Back",
    content: @Composable () -> Unit,
) {
    if (LocalCircleSurfaceLayout.current.surfaceClass != CircleSurfaceClass.ROUND) {
        content()
        return
    }
    CompositionLocalProvider(
        LocalRoundBackLayer provides true,
        LocalRoundChromeReservation provides LocalRoundChromeReservation.current + roundBackHostReservation(),
    ) {
        Box(Modifier.fillMaxSize()) {
            content()
            RingRoundBackLayer(label = label, onBack = onBack)
        }
    }
}

/** The fixed escape and the cap its passing rows fade under. */
@Composable
internal fun RingRoundBackLayer(label: String, onBack: () -> Unit) {
    val canvas = circleCanvasColor()
    val ringBottom = MenuDesign.roundBackLayerCenterY + MenuDesign.backDiameter / 2
    val capBottom = MenuDesign.roundBackLayerCapBottom
    Box(Modifier.fillMaxSize()) {
        // Opaque behind the whole ring, so a passing row never shows through
        // or crosses its contour; faded below it, ending where a resting
        // title's letters begin.
        Box(
            Modifier
                .fillMaxWidth()
                .height(capBottom)
                .background(
                    Brush.verticalGradient(
                        0f to canvas,
                        ringBottom / capBottom to canvas,
                        1f to canvas.copy(alpha = 0f),
                    ),
                ),
        )
        BackRing(
            label = label,
            onBack = onBack,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = MenuDesign.roundBackLayerCenterY - MenuDesign.backDiameter / 2),
        )
    }
}

/**
 * The rim slots the shared round escape claims from the content below it:
 * none. It lives in the top cap, where the circle already narrows every row,
 * so no row pays width for it at any scroll position.
 */
internal fun roundBackHostReservation(): List<CircleChromeSlot> = emptyList()

/**
 * Whether the round renderer itself paints the escape for [screen].
 *
 * It offers back exactly when the phone renderer's header would, unless a
 * host above already owns the escape: [RingRoundBackHost] ([backLayerMounted])
 * or a product shell that mounts its own rim chrome and therefore publishes
 * [reservedSlots]. A second, competing back is never painted.
 */
internal fun roundRendererPaintsBack(
    screen: RingScreen,
    backLayerMounted: Boolean,
    reservedSlots: List<CircleChromeSlot>,
): Boolean = !backLayerMounted && reservedSlots.isEmpty() && ringScreenOffersBack(screen)

/** One back law for both hosts: setup rows opt out, every other screen offers back. */
internal fun ringScreenOffersBack(screen: RingScreen): Boolean = (screen as? RingScreen.Rows)?.showBack ?: true
