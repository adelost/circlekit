package com.adelost.designkit.ui

import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Path
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * How a band, a bar or an arc of a progress or a reading, ends where nothing continues past it.
 *
 * A product declares which one its bands wear; every band it draws takes the shape from here, so the choice is made
 * once and drawn the same everywhere (Skyvw, Mattias 2026-10-10: "Finns det i dsl språket också.. och atomic
 * design.. så vi inte bhöever rätta sakka saker flera gånger?"). Where two colours of one band meet, the join is
 * [SQUARE]: the colour change is the reading.
 *
 * A round end is pulled in by its own radius, so no band grows longer than its value.
 */
enum class CircleBandEnds { ROUND, SQUARE }

/** A bar from [left] to [right], [height] tall, with [ends] on both ends; empty when it has no length. */
fun circleBarPath(left: Float, top: Float, right: Float, height: Float, ends: CircleBandEnds): Path = Path().apply {
    val from = left.coerceAtLeast(0f)
    if (right <= from) return@apply
    val corner = if (ends == CircleBandEnds.ROUND) CornerRadius(height / 2f) else CornerRadius.Zero
    addRoundRect(RoundRect(from, top, right, top + height, corner))
}

/**
 * A band of a ring between [inner] and [outer], from [startDeg] through [sweepDeg] (0 is three o'clock, clockwise),
 * as one filled shape that spans exactly those angles, with each end as given. A band shorter than its two round
 * ends is a dot.
 *
 * One shape rather than a stroke and two circles: a translucent band would show a darker lens wherever a circle
 * overlaps the stroke.
 */
fun circleArcBandPath(
    center: Offset,
    inner: Float,
    outer: Float,
    startDeg: Float,
    sweepDeg: Float,
    startEnd: CircleBandEnds,
    endEnd: CircleBandEnds,
): Path {
    val capDeg = Math.toDegrees(((outer - inner) / 2f / ((inner + outer) / 2f)).toDouble()).toFloat()
    val inset = minOf(capDeg, abs(sweepDeg) / 2f)
    val sign = if (sweepDeg >= 0f) 1f else -1f
    val from = if (startEnd == CircleBandEnds.ROUND) startDeg + sign * inset else startDeg
    val to = if (endEnd == CircleBandEnds.ROUND) startDeg + sweepDeg - sign * inset else startDeg + sweepDeg
    return bandWithCaps(center, inner, outer, from, to - from, startEnd, endEnd)
}

/** The band from [startDeg] through [sweepDeg], each round end a half-disc past its angle. */
private fun bandWithCaps(
    center: Offset,
    inner: Float,
    outer: Float,
    startDeg: Float,
    sweepDeg: Float,
    startEnd: CircleBandEnds,
    endEnd: CircleBandEnds,
): Path = Path().apply {
    val mid = (inner + outer) / 2f
    val cap = (outer - inner) / 2f
    val endDeg = startDeg + sweepDeg
    val turn = if (sweepDeg >= 0f) 180f else -180f
    arcTo(Rect(center, outer), startDeg, sweepDeg, forceMoveTo = true)
    if (endEnd == CircleBandEnds.ROUND) {
        arcTo(Rect(pointAt(center, mid, endDeg), cap), endDeg, turn, forceMoveTo = false)
    } else {
        pointAt(center, inner, endDeg).let { lineTo(it.x, it.y) }
    }
    arcTo(Rect(center, inner), endDeg, -sweepDeg, forceMoveTo = false)
    if (startEnd == CircleBandEnds.ROUND) {
        arcTo(Rect(pointAt(center, mid, startDeg), cap), startDeg + 180f, turn, forceMoveTo = false)
    }
    close()
}

private fun pointAt(center: Offset, radius: Float, deg: Float): Offset {
    val rad = Math.toRadians(deg.toDouble())
    return Offset(center.x + radius * cos(rad).toFloat(), center.y + radius * sin(rad).toFloat())
}
