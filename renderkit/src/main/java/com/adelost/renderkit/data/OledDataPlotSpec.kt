package com.adelost.renderkit.data

import androidx.compose.runtime.Immutable
import kotlin.math.sqrt
import kotlin.math.abs

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

enum class OledPlotChildWidthPolicy {
    /** Recomputed from this child's present chord; suitable for copy and legends. */
    CURRENT_CHORD,
    /** Constant across the module's clamp band; required for an axis-bearing plot. */
    STABLE_ACROSS_CLAMP,
}

@Immutable
data class OledDataPlotChildSpec(
    val id: String,
    val heightDp: Float,
    val centerOffsetDp: Float,
    val widthPolicy: OledPlotChildWidthPolicy,
    val edgeInsetDp: Float = OledDataPlotSpec.DEFAULT_EDGE_INSET_DP,
) {
    init {
        require(id.isNotBlank()) { "plot child must be named" }
        require(heightDp > 0f) { "plot child height must be positive" }
        require(centerOffsetDp.isFinite()) { "plot child offset must be finite" }
        require(edgeInsetDp >= 0f) { "plot child edge inset cannot be negative" }
    }
}

/** One scroll/clamp unit whose children each receive their own round geometry. */
@Immutable
data class OledDataPlotModuleSpec(
    val presentation: PlotPresentation,
    val roundCenterTravelDp: Float,
    val children: List<OledDataPlotChildSpec>,
) {
    init {
        require(roundCenterTravelDp >= 0f) { "plot module centre travel cannot be negative" }
        require(children.isNotEmpty()) { "plot module must contain a child" }
        require(children.map { it.id }.distinct().size == children.size) { "plot child ids must be unique" }
    }

    fun roundLayout(
        requestedModuleCenterDp: Float,
        viewportDiameterDp: Float,
    ): OledDataPlotModuleLayout {
        val viewportCenter = viewportDiameterDp / 2f
        val moduleCenter = clampRoundPlotCenterDp(
            plotCenterDp = requestedModuleCenterDp,
            viewportCenterDp = viewportCenter,
            centerTravelDp = roundCenterTravelDp,
        )
        return OledDataPlotModuleLayout(
            moduleCenterDp = moduleCenter,
            children = children.map { child ->
                val childCenter = moduleCenter + child.centerOffsetDp
                val width = when (child.widthPolicy) {
                    OledPlotChildWidthPolicy.CURRENT_CHORD -> roundSafeRectWidthDp(
                        viewportDiameterDp = viewportDiameterDp,
                        rectHeightDp = child.heightDp,
                        centerOffsetDp = abs(childCenter - viewportCenter),
                        edgeInsetDp = child.edgeInsetDp,
                    )
                    OledPlotChildWidthPolicy.STABLE_ACROSS_CLAMP -> stableRoundPlotWidthDp(
                        viewportDiameterDp = viewportDiameterDp,
                        plotHeightDp = child.heightDp,
                        centerTravelDp = roundCenterTravelDp + abs(child.centerOffsetDp),
                        edgeInsetDp = child.edgeInsetDp,
                    )
                }
                OledDataPlotChildLayout(child.id, childCenter, width)
            },
        )
    }
}

@Immutable
data class OledDataPlotModuleLayout(
    val moduleCenterDp: Float,
    val children: List<OledDataPlotChildLayout>,
)

@Immutable
data class OledDataPlotChildLayout(
    val id: String,
    val centerDp: Float,
    val widthDp: Float,
)

/** Largest rectangle at one absolute centre offset whose corners stay on-glass. */
fun roundSafeRectWidthDp(
    viewportDiameterDp: Float,
    rectHeightDp: Float,
    centerOffsetDp: Float,
    edgeInsetDp: Float = OledDataPlotSpec.DEFAULT_EDGE_INSET_DP,
): Float {
    require(viewportDiameterDp > 0f) { "viewport diameter must be positive" }
    require(rectHeightDp > 0f) { "rectangle height must be positive" }
    require(centerOffsetDp >= 0f) { "centre offset cannot be negative" }
    require(edgeInsetDp >= 0f) { "edge inset cannot be negative" }
    val radius = viewportDiameterDp / 2f
    val worstCornerY = rectHeightDp / 2f + centerOffsetDp
    if (worstCornerY >= radius) return 0f
    return (2f * sqrt(radius * radius - worstCornerY * worstCornerY) - edgeInsetDp * 2f)
        .coerceAtLeast(0f)
}
