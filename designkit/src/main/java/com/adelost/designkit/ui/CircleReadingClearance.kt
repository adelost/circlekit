package com.adelost.designkit.ui

import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** The actual round host, including embedded previews; never Android's outer window. */
val LocalCircleReadingViewport = compositionLocalOf<Rect?> { null }

/** A short value centres naturally; only its measured group yields to Back. */
internal fun Modifier.readingValueClearance(): Modifier = composed {
    val viewport = LocalCircleReadingViewport.current
    val slots = LocalRoundChromeReservation.current
    val density = LocalDensity.current.density
    var shiftPx by remember(viewport, slots) { mutableStateOf(0) }
    if (viewport == null) this else {
        val widthDp = viewport.width / density
        val heightDp = viewport.height / density
        val safe = roundSafeRectHorizontalInsetsDp(widthDp, heightDp, heightDp / 2f,
            (heightDp - 2f * (MenuDesign.roundTitleTopPadding + MenuDesign.roundTitleHeight).value)
                .coerceAtLeast(1f), slots, MenuDesign.backTouchTarget.value)
        this.widthIn(max = (widthDp - safe.start - safe.end - 4f).coerceAtLeast(1f).dp)
            .offset { IntOffset(shiftPx, 0) }
            .onGloballyPositioned { coordinates ->
                val p = coordinates.positionInRoot() - viewport.topLeft
                val left = (p.x - shiftPx) / density
                val top = p.y / density
                val shift = readingInkShiftDp(widthDp, heightDp,
                    listOf(Rect(left, top, left + coordinates.size.width / density,
                        top + coordinates.size.height / density)), slots)
                if (shift != null) shiftPx = (shift * density).roundToInt()
            }
    }
}

/** Closest-to-centre translation whose actual ink clears the mounted controls. */
internal fun readingInkShiftDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    ink: List<Rect>,
    reservedSlots: List<CircleChromeSlot>,
): Float? {
    var minimum = Float.NEGATIVE_INFINITY
    var maximum = Float.POSITIVE_INFINITY
    for (line in ink) {
        if (line.bottom <= 0f || line.top >= viewportHeightDp || line.width <= 0f) continue
        val chrome = roundChromeHorizontalInsetsForHalfHeightDp(
            viewportWidthDp, viewportHeightDp, line.center.y, line.height / 2f,
            reservedSlots, MenuDesign.backTouchTarget.value, ROUND_SAFE_CONTENT_GAP_DP,
        )
        // The parent already keeps a stable safe chord for text. Do not change
        // wrapping as the first/last line scrolls through the physical rim.
        minimum = maxOf(minimum, chrome.start - line.left)
        maximum = minOf(maximum, viewportWidthDp - chrome.end - line.right)
    }
    return if (minimum <= maximum) 0f.coerceIn(minimum, maximum) else null
}
