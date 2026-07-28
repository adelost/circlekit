package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable

/**
 * User-facing travel direction for the altitude ring.
 *
 * ALTIMETER follows the familiar analogue skydiving-altimeter motion: falling
 * altitude travels counter-clockwise. CLOCK keeps the conventional Compose /
 * clock-face direction for people who read progress that way.
 */
enum class SkyvwAltitudeDialDirection(val optionLabel: String, internal val sweepSign: Float) {
    ALTIMETER("ALTIMETER", -1f),
    CLOCK("CLOCK", 1f);

    companion object {
        val DEFAULT: SkyvwAltitudeDialDirection = CLOCK
    }
}

/** Pure arc geometry shared by every host that renders the instrument. */
@Immutable
data class SkyvwAltitudeDialArc(
    val startAngleDeg: Float,
    val sweepAngleDeg: Float,
)

fun skyvwAltitudeDialArc(
    index: Int,
    segmentCount: Int,
    fillFraction: Float,
    fillFromStart: Boolean,
    direction: SkyvwAltitudeDialDirection,
): SkyvwAltitudeDialArc {
    require(segmentCount > 0)
    require(index in 0 until segmentCount)
    require(fillFraction in 0f..1f)

    val gap = SkyvwDialDesign.SegmentGapDeg
    val span = (360f - segmentCount * gap) / segmentCount
    val signedSpan = span * direction.sweepSign
    val slotStart = -90f + direction.sweepSign * (gap / 2f + index * (span + gap))
    val arcStart = if (fillFromStart) {
        slotStart
    } else {
        slotStart + signedSpan * (1f - fillFraction)
    }
    return SkyvwAltitudeDialArc(
        startAngleDeg = arcStart,
        sweepAngleDeg = signedSpan * fillFraction,
    )
}
