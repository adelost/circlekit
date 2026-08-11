package com.adelost.renderkit.gestures

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.pointerInput
import kotlin.math.abs

/**
 * Source-neutral output from a directly manipulated surface.
 *
 * The touch layer deliberately knows nothing about maps or cameras. Consumers
 * decide whether a one-finger drag means orbit, scrub or something else. A
 * two-finger gesture carries EITHER pan or pinch, never both at once: the
 * shape still exposes both fields, but one of them is always neutral (see
 * [TwoFingerIntent]).
 */
sealed interface DirectManipulationDelta {
    val panPx: Offset
    val panFraction: Offset

    data class Drag(
        override val panPx: Offset,
        override val panFraction: Offset,
    ) : DirectManipulationDelta

    data class Transform(
        override val panPx: Offset,
        override val panFraction: Offset,
        val zoomFactor: Float,
    ) : DirectManipulationDelta
}

/** What actually changed during one pointer-down sequence. */
data class DirectManipulationGestureEnd(
    val dragged: Boolean,
    /** At least one one-finger MOVE changed x, so an orbit consumer moved. */
    val horizontalDrag: Boolean,
    val transformed: Boolean,
)

/**
 * Adds immediate one- and two-finger manipulation to any Compose surface.
 *
 * Every MOVE produces a delta. [onGestureEnd] is a semantic settle signal,
 * not a delayed commit: consumers may snap an orbit after release while
 * leaving pinch/pan gestures untouched. The pointer coroutine is keyed only
 * by this component's lifetime; [rememberUpdatedState] keeps callbacks
 * current without cancelling an active drag when the consumer updates state.
 *
 * The declared [GestureInterpretation] is applied HERE, so an axis a jumper
 * switched off is gone before the delta reaches a consumer. That is the whole
 * point of filtering in the component instead of at each call site: a surface
 * cannot forget the setting, because it never sees the unfiltered gesture.
 */
/**
 * What one two-finger gesture turned out to mean. Decided once, when the
 * fingers' movement first commits past touch slop, and kept until they lift.
 *
 * Scale and centroid change arrive together on every pinch frame, so a
 * gesture that dispatched both channels drifted the view sideways while it
 * zoomed — the map walking upward under a pinch (Mattias 2026-08-10). One
 * gesture now does one thing; a declared non-BOTH [PinchInterpretation]
 * skips the race and forces its channel.
 */
private enum class TwoFingerIntent { UNDECIDED, ZOOM, PAN }

private fun PinchInterpretation.forcedIntent(): TwoFingerIntent? = when (this) {
    PinchInterpretation.ZOOM -> TwoFingerIntent.ZOOM
    PinchInterpretation.PAN -> TwoFingerIntent.PAN
    PinchInterpretation.BOTH -> null
}

/** First movement channel past touch slop wins; a same-frame tie goes to the
 *  larger travel. UNDECIDED frames are the dead zone and dispatch nothing. */
private fun decideTwoFingerIntent(
    spreadTravelPx: Float,
    centroidTravelPx: Float,
    touchSlopPx: Float,
): TwoFingerIntent = when {
    spreadTravelPx > touchSlopPx &&
        (centroidTravelPx <= touchSlopPx || spreadTravelPx >= centroidTravelPx) ->
        TwoFingerIntent.ZOOM
    centroidTravelPx > touchSlopPx -> TwoFingerIntent.PAN
    else -> TwoFingerIntent.UNDECIDED
}

/** How much the distance between the two leading fingers changed this frame. */
private fun spreadChangePx(pressed: List<PointerInputChange>): Float {
    if (pressed.size < 2) return 0f
    val previous = (pressed[0].previousPosition - pressed[1].previousPosition).getDistance()
    val current = (pressed[0].position - pressed[1].position).getDistance()
    return abs(current - previous)
}

fun Modifier.directManipulationSurface(
    onGestureEnd: (DirectManipulationGestureEnd) -> Unit = {},
    onDelta: (DirectManipulationDelta) -> Unit,
): Modifier = composed {
    val currentOnDelta by rememberUpdatedState(onDelta)
    val currentOnGestureEnd by rememberUpdatedState(onGestureEnd)
    val interpretation by rememberUpdatedState(LocalGestureInterpretation.current)
    pointerInput(Unit) {
        awaitEachGesture {
            awaitFirstDown(
                requireUnconsumed = false,
                pass = PointerEventPass.Main,
            )
            var dragged = false
            var horizontalDrag = false
            var transformed = false
            var sawTwoFingers = false
            var intent = TwoFingerIntent.UNDECIDED
            var spreadTravelPx = 0f
            var centroidTravelPx = 0f
            while (true) {
                val event = awaitPointerEvent(pass = PointerEventPass.Main)
                val pressed = event.changes.filter(PointerInputChange::pressed)
                if (pressed.isEmpty()) break

                if (pressed.size == 1 && sawTwoFingers) {
                    // The finger that survives a pinch is release residue, not
                    // a new drag. Without this gate every zoom ended with an
                    // orbit/tilt kick from the trailing finger — the map
                    // collapsing to an edge-on sliver after pinching.
                    event.changes.forEach(PointerInputChange::consume)
                    continue
                }
                val panPx = if (pressed.size == 1) {
                    pressed.single().positionChange()
                } else {
                    event.calculatePan()
                }
                val panFraction = Offset(
                    x = if (size.width > 0) panPx.x / size.width.toFloat() else 0f,
                    y = if (size.height > 0) panPx.y / size.height.toFloat() else 0f,
                )
                val raw = if (pressed.size == 1) {
                    DirectManipulationDelta.Drag(panPx, panFraction)
                } else {
                    sawTwoFingers = true
                    spreadTravelPx += spreadChangePx(pressed)
                    centroidTravelPx += panPx.getDistance()
                    if (intent == TwoFingerIntent.UNDECIDED) {
                        intent = interpretation.pinch.forcedIntent()
                            ?: decideTwoFingerIntent(
                                spreadTravelPx = spreadTravelPx,
                                centroidTravelPx = centroidTravelPx,
                                touchSlopPx = viewConfiguration.touchSlop,
                            )
                    }
                    when (intent) {
                        TwoFingerIntent.UNDECIDED -> null
                        TwoFingerIntent.ZOOM -> DirectManipulationDelta.Transform(
                            panPx = Offset.Zero,
                            panFraction = Offset.Zero,
                            zoomFactor = event.calculateZoom(),
                        )
                        TwoFingerIntent.PAN -> DirectManipulationDelta.Transform(
                            panPx = panPx,
                            panFraction = panFraction,
                            zoomFactor = 1f,
                        )
                    }
                }
                if (raw == null) {
                    // Dead zone: the two-finger race has no winner yet, but the
                    // fingers are still on THIS surface.
                    event.changes.forEach(PointerInputChange::consume)
                    continue
                }
                if (raw.panPx != Offset.Zero ||
                    raw is DirectManipulationDelta.Transform && raw.zoomFactor != 1f
                ) {
                    // The settle flags read the FILTERED delta, so a consumer
                    // that snaps an orbit after release cannot snap an axis the
                    // jumper turned off.
                    val delta = interpretation.filter(raw)
                    when (delta) {
                        is DirectManipulationDelta.Drag -> {
                            dragged = true
                            if (delta.panPx.x != 0f) horizontalDrag = true
                        }
                        is DirectManipulationDelta.Transform -> transformed = true
                        null -> Unit
                    }
                    if (delta != null) currentOnDelta(delta)
                    // Consumed either way: the finger is on THIS surface, and a
                    // switched-off axis means "this view does not move like
                    // that", never "let whatever sits underneath have it".
                    event.changes.forEach(PointerInputChange::consume)
                }
            }
            if (dragged || transformed) {
                currentOnGestureEnd(
                    DirectManipulationGestureEnd(dragged, horizontalDrag, transformed),
                )
            }
        }
    }
}
