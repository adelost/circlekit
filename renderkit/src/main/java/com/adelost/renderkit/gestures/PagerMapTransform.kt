package com.adelost.renderkit.gestures

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.input.pointer.pointerInput
import kotlin.math.abs

/**
 * Isometric model gesture surface that coexists with a pager:
 *
 * - one finger orbits after horizontal touch slop;
 * - two fingers own smooth pinch zoom and centroid strafe;
 * - an unclaimed single-pointer gesture remains a tap.
 *
 * The parent pager is expected to be disabled while this surface is visible.
 * Page changes stay on explicit chrome instead of competing with model input.
 */
fun Modifier.pagerMapTransform(
    key: Any?,
    orbitEnabled: () -> Boolean,
    onTransform: (centroid: Offset, pan: Offset, zoomFactor: Float) -> Unit,
    onOrbit: (dxFraction: Float) -> Unit,
    onOrbitEnd: () -> Unit,
    onTap: PointerInputScope.(Offset) -> Unit,
): Modifier = pointerInput(key) {
    val pointerScope = this
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false, pass = PointerEventPass.Main)
        val touchSlop = viewConfiguration.touchSlop
        var claimed = false
        var orbitClaimed = false
        var tapEligible = true
        var oneFingerTravel = Offset.Zero

        do {
            val event = awaitPointerEvent(pass = PointerEventPass.Main)
            val pressed = event.changes.filter(PointerInputChange::pressed)
            val zoom = zoomFactor(event.changes)
            val pan = centroidPan(event.changes)
            val centroid = centroid(event.changes)
            val intent = pagerMapMotionIntent(
                pointerCount = pressed.size,
                orbitEnabled = orbitEnabled(),
                horizontalTravelPx = oneFingerTravel.x,
                touchSlopPx = touchSlop,
            )

            if (intent == PagerMapMotionIntent.PAN_ZOOM) {
                tapEligible = false
                if (abs(zoom - 1f) > MIN_ZOOM_DELTA || pan.getDistance() > 0f) {
                    claimed = true
                    onTransform(centroid, pan, zoom)
                    event.changes.forEach(PointerInputChange::consume)
                }
            } else if (pressed.size == 1 && orbitEnabled()) {
                oneFingerTravel += pressed.single().positionChange()
                if (oneFingerTravel.getDistance() > touchSlop) {
                    tapEligible = false
                }
                if (orbitClaimed || pagerMapMotionIntent(
                        pointerCount = 1,
                        orbitEnabled = true,
                        horizontalTravelPx = oneFingerTravel.x,
                        touchSlopPx = touchSlop,
                    ) == PagerMapMotionIntent.ORBIT
                ) {
                    claimed = true
                    orbitClaimed = true
                    tapEligible = false
                    if (size.width > 0) {
                        onOrbit(pan.x / size.width.toFloat())
                    }
                    event.changes.forEach(PointerInputChange::consume)
                }
            }

            if (pressed.isEmpty()) {
                if (orbitClaimed) onOrbitEnd()
                if (!claimed && tapEligible) onTap(pointerScope, down.position)
                break
            }
        } while (true)
    }
}

internal enum class PagerMapMotionIntent { NONE, ORBIT, PAN_ZOOM }

internal fun pagerMapMotionIntent(
    pointerCount: Int,
    orbitEnabled: Boolean,
    horizontalTravelPx: Float,
    touchSlopPx: Float,
): PagerMapMotionIntent = when {
    pointerCount >= 2 -> PagerMapMotionIntent.PAN_ZOOM
    pointerCount == 1 && orbitEnabled && abs(horizontalTravelPx) > touchSlopPx ->
        PagerMapMotionIntent.ORBIT
    else -> PagerMapMotionIntent.NONE
}

private fun zoomFactor(changes: List<PointerInputChange>): Float {
    val pressed = changes.filter(PointerInputChange::pressed)
    if (pressed.size < 2) return 1f
    val first = pressed[0]
    val second = pressed[1]
    val previous = (first.previousPosition - second.previousPosition).getDistance()
    val current = (first.position - second.position).getDistance()
    return if (previous > 0f) current / previous else 1f
}

private fun centroidPan(changes: List<PointerInputChange>): Offset {
    val pressed = changes.filter(PointerInputChange::pressed)
    if (pressed.isEmpty()) return Offset.Zero
    return pressed
        .map(PointerInputChange::positionChange)
        .reduce(Offset::plus) / pressed.size.toFloat()
}

private fun centroid(changes: List<PointerInputChange>): Offset {
    val pressed = changes.filter(PointerInputChange::pressed)
    if (pressed.isEmpty()) return Offset.Zero
    return pressed.map(PointerInputChange::position).reduce(Offset::plus) / pressed.size.toFloat()
}

private const val MIN_ZOOM_DELTA = 0.003f
