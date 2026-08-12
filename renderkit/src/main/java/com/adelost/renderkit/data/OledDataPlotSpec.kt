package com.adelost.renderkit.data

import androidx.compose.runtime.Immutable
import kotlin.math.sqrt

/**
 * Host geometry for an OLED data plot embedded in a scrolling surface.
 *
 * The plot width is a data axis, so it must not breathe while scrolling. A
 * round host therefore gives it one stable width which fits at both limits of
 * a small centre clamp. Rectangular hosts ignore this geometry and use their
 * ordinary content width.
 *
 * Domain policy does not belong here. The product supplies the value range,
 * time window, series, labels and colours; this spec owns only safe geometry.
 */
@Immutable
data class OledDataPlotSpec(
    val roundHeightDp: Float,
    val roundCenterTravelDp: Float,
    val edgeInsetDp: Float = DEFAULT_EDGE_INSET_DP,
) {
    init {
        require(roundHeightDp > 0f) { "plot height must be positive" }
        require(roundCenterTravelDp >= 0f) { "plot centre travel cannot be negative" }
        require(edgeInsetDp >= 0f) { "plot edge inset cannot be negative" }
    }

    /** Stable plot width whose four corners remain on a circular viewport. */
    fun stableRoundWidthDp(viewportDiameterDp: Float): Float = stableRoundPlotWidthDp(
        viewportDiameterDp = viewportDiameterDp,
        plotHeightDp = roundHeightDp,
        centerTravelDp = roundCenterTravelDp,
        edgeInsetDp = edgeInsetDp,
    )

    companion object {
        const val DEFAULT_EDGE_INSET_DP = 4f
    }
}

/**
 * Largest constant-width rectangle that remains inside the circle while its
 * centre moves through `-centerTravelDp..+centerTravelDp`.
 */
fun stableRoundPlotWidthDp(
    viewportDiameterDp: Float,
    plotHeightDp: Float,
    centerTravelDp: Float,
    edgeInsetDp: Float = OledDataPlotSpec.DEFAULT_EDGE_INSET_DP,
): Float {
    require(viewportDiameterDp > 0f) { "viewport diameter must be positive" }
    require(plotHeightDp > 0f) { "plot height must be positive" }
    require(centerTravelDp >= 0f) { "plot centre travel cannot be negative" }
    require(edgeInsetDp >= 0f) { "plot edge inset cannot be negative" }

    val radius = viewportDiameterDp / 2f
    val worstCornerY = plotHeightDp / 2f + centerTravelDp
    if (worstCornerY >= radius) return 0f
    val chordWidth = 2f * sqrt(radius * radius - worstCornerY * worstCornerY)
    return (chordWidth - edgeInsetDp * 2f).coerceAtLeast(0f)
}

/** Clamp one moving plot centre to the stable round band. */
fun clampRoundPlotCenterDp(
    plotCenterDp: Float,
    viewportCenterDp: Float,
    centerTravelDp: Float,
): Float = plotCenterDp.coerceIn(
    minimumValue = viewportCenterDp - centerTravelDp,
    maximumValue = viewportCenterDp + centerTravelDp,
)
