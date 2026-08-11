package com.adelost.renderkit.gestures

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.geometry.Offset

/**
 * How much of a one-finger drag reaches the camera.
 *
 * A drag carries two independent axes: horizontal turns the camera around the
 * scene (orbit) and vertical raises or lowers the eye (tilt). Riding both at
 * once is fine on a phone-sized surface and fiddly on a watch, where a thumb
 * rarely travels along one axis alone. Naming the axes lets a jumper keep the
 * one they want and stop paying for the one they don't.
 */
enum class DragInterpretation {
    /** Both axes, exactly as the surface behaved before this setting existed. */
    BOTH,

    /** Horizontal only: the camera turns, the eye height stays put. */
    ORBIT,

    /** Vertical only: the eye rises and falls, the heading stays put. */
    TILT,
}

/**
 * How much of a two-finger gesture reaches the camera.
 *
 * Two fingers report scale and centroid movement in the same frame, so pinching
 * to zoom always drags the view a little as well. ZOOM and PAN keep one of the
 * two, for the same reason [DragInterpretation] splits a drag.
 */
enum class PinchInterpretation {
    /** The gesture's dominant movement decides, once per gesture: spreading
     *  fingers zoom, travelling fingers pan. Never both in one gesture. */
    BOTH,

    /** Scale only: the view grows and shrinks around where it already is. */
    ZOOM,

    /** Movement only: two fingers push the view around and never rescale it. */
    PAN,
}

/**
 * The declared reading of a manipulation gesture, applied by the gesture
 * components themselves rather than by each surface that uses one.
 *
 * Mattias 2026-08-05: "Inga specialfall - samma generiska komponent i botten."
 * The policy is therefore read INSIDE
 * [com.adelost.renderkit.gestures.directManipulationSurface] and its map-side
 * sibling, and the unfiltered delta never leaves either of them. A surface
 * cannot obey a different rule than its neighbour, because no surface is ever
 * handed the raw gesture to interpret.
 *
 * Defaults are [DragInterpretation.BOTH] / [PinchInterpretation.BOTH], so a
 * surface nobody has thought about behaves exactly as it does today.
 */
data class GestureInterpretation(
    val drag: DragInterpretation = DragInterpretation.BOTH,
    val pinch: PinchInterpretation = PinchInterpretation.BOTH,
)

/**
 * The single seam the policy travels down.
 *
 * Provided once beside the other settings-derived locals; every gesture
 * component reads it, no consumer passes it.
 */
val LocalGestureInterpretation = staticCompositionLocalOf { GestureInterpretation() }

/** Whether a two-finger frame may still move the view under this policy. */
val PinchInterpretation.allowsPan: Boolean
    get() = this != PinchInterpretation.ZOOM

/** Whether a two-finger frame may still rescale the view under this policy. */
val PinchInterpretation.allowsZoom: Boolean
    get() = this != PinchInterpretation.PAN

/** Drop the drag axis this policy switched off. */
fun DragInterpretation.filterDragAxes(pan: Offset): Offset = when (this) {
    DragInterpretation.BOTH -> pan
    DragInterpretation.ORBIT -> Offset(pan.x, 0f)
    DragInterpretation.TILT -> Offset(0f, pan.y)
}

/**
 * The delta a consumer is allowed to see, or null when the policy leaves
 * nothing to apply and the frame should not be dispatched at all.
 *
 * A half that is switched off comes back neutral rather than absent: a zero pan
 * moves no camera and a zoom factor of 1 falls under every consumer's pinch
 * threshold, so consumers need no knowledge of the policy to honour it.
 */
fun GestureInterpretation.filter(delta: DirectManipulationDelta): DirectManipulationDelta? =
    when (delta) {
        is DirectManipulationDelta.Drag -> DirectManipulationDelta.Drag(
            panPx = drag.filterDragAxes(delta.panPx),
            panFraction = drag.filterDragAxes(delta.panFraction),
        ).takeIf { it.panPx != Offset.Zero }

        is DirectManipulationDelta.Transform -> DirectManipulationDelta.Transform(
            panPx = if (pinch.allowsPan) delta.panPx else Offset.Zero,
            panFraction = if (pinch.allowsPan) delta.panFraction else Offset.Zero,
            zoomFactor = if (pinch.allowsZoom) delta.zoomFactor else 1f,
        ).takeIf { it.panPx != Offset.Zero || it.zoomFactor != 1f }
    }
