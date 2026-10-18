package com.adelost.designkit.press

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.unit.Dp
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.hypot

/**
 * The declared circleProgressContour geometry, supplied by its component's test, never guessed from its words.
 * MenuDesign.watchActionRingDiameter and MenuDesign.iconRingStroke own the icon disc's two dimensions.
 *
 * skyvw:1's decision of 2026-10-18: measure swept angle, not total antialiased pixels. Each sector spans
 * one stroke-width of circumference. The circle clips half of its centred stroke; half that sector's
 * visible core area, rounded down to whole pixels, is its ink floor. Both scale with the actual node.
 * The existing colour-spread floor8 still distinguishes the cue from grey chrome.
 */
data class CirclePressRing(val diameter: Dp, val stroke: Dp) {
    init { require(diameter.value > stroke.value && stroke.value > 0f) }
}

internal fun circleRingSweep(
    pixels: IntArray,
    width: Int,
    bounds: Rect,
    ring: CirclePressRing,
    colourSpread: Int,
): Float {
    val radius = minOf(bounds.width, bounds.height) / 2f
    val stroke = ring.stroke.value * (2f * radius) / ring.diameter.value
    val circumference = 2f * PI.toFloat() * radius
    val sectors = ceil(circumference / stroke).toInt()
    val sectorArc = circumference / sectors
    val inkFloor = maxOf(1, floor(sectorArc * (stroke / 2f) / 2f).toInt())
    val ink = IntArray(sectors)
    val height = pixels.size / width
    for (y in bounds.top.toInt().coerceAtLeast(0) until ceil(bounds.bottom).toInt().coerceAtMost(height)) {
        for (x in bounds.left.toInt().coerceAtLeast(0) until ceil(bounds.right).toInt().coerceAtMost(width)) {
            val dx = x + 0.5f - bounds.center.x
            val dy = y + 0.5f - bounds.center.y
            val distance = hypot(dx, dy)
            if (distance < radius - stroke || distance > radius) continue
            val pixel = pixels[y * width + x]
            val r = pixel shr 16 and 255
            val g = pixel shr 8 and 255
            val b = pixel and 255
            if (maxOf(r, g, b) - minOf(r, g, b) < colourSpread) continue
            val angle = (atan2(dx, -dy) * 180f / PI.toFloat() + 360f) % 360f
            ink[(angle / 360f * sectors).toInt().coerceAtMost(sectors - 1)]++
        }
    }
    return ink.count { it >= inkFloor } * 360f / sectors
}
