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
 * One companion seat in the round top run: the page's own control, drawn in
 * the same layer and at the same diameter as the escape beside it.
 */
data class RoundTopSeat(
    val icon: ImageVector,
    val label: String,
    val onTap: () -> Unit,
)

/**
 * Where the seats of a [seats]-wide run sit on a [faceDp] face, left to right,
 * as centres in dp from the canvas top-left.
 *
 * The run is an arc, not a straight line: every seat keeps the escape's own
 * distance from the face centre, so the three read as one run on a round face
 * and none of them is closer to the glass edge than the escape already is.
 *
 * A run wider than [MenuDesign.roundTopRunMaxSeats] is not a layout this kit
 * can draw, and saying so out loud beats drawing a fourth seat into the rows
 * (see the derivation on [MenuDesign.roundTopRunStepDeg]).
 */
internal fun roundTopRunSeatCenters(faceDp: Float, seats: Int): List<Pair<Float, Float>> {
    require(seats in 1..MenuDesign.roundTopRunMaxSeats) {
        "the round top run seats 1..${MenuDesign.roundTopRunMaxSeats} controls, not $seats"
    }
    val scale = faceDp / CircleUiProfiles.CANON_ROUND_CANVAS_DP
    val centre = faceDp / 2f
    val radius = MenuDesign.roundTopRunRadius.value * scale
    val step = MenuDesign.roundTopRunStepDeg
    val first = -(seats - 1) / 2f
    return (0 until seats).map { index ->
        val angle = Math.toRadians(((first + index) * step).toDouble())
        centre + radius * sin(angle).toFloat() to centre - radius * cos(angle).toFloat()
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
 * [left] and [right] are the run's companion seats (Mattias 2026-09-17:
 * "bak-knapp, settings-knapp och sen kanske rotationsknapp"). A page declares
 * the ones it fills; an unfilled seat draws nothing, reserves nothing and
 * leaves the frame exactly as it was before this run existed.
 *
 * Non-round hosts render [content] unchanged; phone screens carry their own
 * header back.
 */
@Composable
fun RingRoundBackHost(
    onBack: () -> Unit,
    label: String = "Back",
    left: RoundTopSeat? = null,
    right: RoundTopSeat? = null,
    content: @Composable () -> Unit,
) {
    if (LocalCircleSurfaceLayout.current.surfaceClass != CircleSurfaceClass.ROUND) {
        content()
        return
    }
    CompositionLocalProvider(
        LocalRoundBackLayer provides true,
        LocalRoundTopRunCompanions provides (left != null || right != null),
        LocalRoundChromeReservation provides LocalRoundChromeReservation.current + roundBackHostReservation(),
    ) {
        Box(Modifier.fillMaxSize()) {
            content()
            RingRoundBackLayer(label = label, onBack = onBack, left = left, right = right)
        }
    }
}

/** The fixed escape, its companions, and the cap their passing rows fade under. */
@Composable
internal fun RingRoundBackLayer(
    label: String,
    onBack: () -> Unit,
    left: RoundTopSeat? = null,
    right: RoundTopSeat? = null,
) {
    val canvas = circleCanvasColor()
    val companions = left != null || right != null
    val ringBottom = if (companions) {
        MenuDesign.roundTopRunSeatCenterY + MenuDesign.watchActionRingDiameter / 2
    } else {
        MenuDesign.roundBackLayerCenterY + MenuDesign.backDiameter / 2
    }
    // The cap has to cover the lowest ink in the run, or a row would scroll
    // through a companion instead of under it.
    val capBottom = if (companions) MenuDesign.roundTopRunContentTop + 2.dp else MenuDesign.roundBackLayerCapBottom
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
        // The companions keep the escape's radius, one clock hour to each side.
        // Placed from the face's own size so the run scales with the glass,
        // exactly as the escape above them does.
        val diameter = MenuDesign.watchActionRingDiameter
        val seatOffsetX = MenuDesign.roundTopRunRadius *
            sin(Math.toRadians(MenuDesign.roundTopRunStepDeg.toDouble())).toFloat()
        val seatTop = MenuDesign.roundTopRunSeatCenterY - diameter / 2
        left?.let { seat ->
            CircleIconDisc(
                icon = seat.icon, contentDescription = seat.label,
                actionLabel = seat.label, onTap = seat.onTap, diameter = diameter,
                modifier = Modifier.align(Alignment.TopCenter).offset(x = -seatOffsetX, y = seatTop),
            )
        }
        right?.let { seat ->
            CircleIconDisc(
                icon = seat.icon, contentDescription = seat.label,
                actionLabel = seat.label, onTap = seat.onTap, diameter = diameter,
                modifier = Modifier.align(Alignment.TopCenter).offset(x = seatOffsetX, y = seatTop),
            )
        }
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
