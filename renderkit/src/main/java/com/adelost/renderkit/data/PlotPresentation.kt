package com.adelost.renderkit.data

@JvmInline
value class PlotQuantityRef(val value: String) {
    init { require(value.isNotBlank()) { "plot quantity must be named" } }
}

@JvmInline
value class PlotFormatterRef(val value: String) {
    init { require(value.isNotBlank()) { "plot formatter must be named" } }
}

@JvmInline
value class PlotUnitRef(val value: String) {
    init { require(value.isNotBlank()) { "plot unit must be named; use '1' for dimensionless data" } }
}

data class PlotWindow(
    val start: Double,
    val end: Double,
) {
    init {
        require(start.isFinite() && end.isFinite() && end > start) { "plot window must be finite and ordered" }
    }
}

data class PlotRange(
    val minimum: Double,
    val maximum: Double,
) {
    init {
        require(minimum.isFinite() && maximum.isFinite() && maximum > minimum) { "plot range must be finite and ordered" }
    }
}

enum class SpatialScaleSemantics { ABSOLUTE, RELATIVE, LOGARITHMIC }
enum class SpatialOrientationSemantics { NORTH_UP, HEADING_UP, SCREEN_FIXED }
enum class SpatialProjectionSemantics { CARTESIAN, POLAR, PERSPECTIVE }

/** Closed, non-null meaning for every renderable plot shape. */
sealed interface PlotPresentation {
    data class CartesianTime(
        val xQuantity: PlotQuantityRef,
        val xWindow: PlotWindow,
        val xFormatter: PlotFormatterRef,
        val yQuantity: PlotQuantityRef,
        val yUnit: PlotUnitRef,
        val yRange: PlotRange,
        val yFormatter: PlotFormatterRef,
    ) : PlotPresentation

    data class SpatialScene(
        val scale: SpatialScaleSemantics,
        val orientation: SpatialOrientationSemantics,
        val projection: SpatialProjectionSemantics,
    ) : PlotPresentation

    data class CompactGlyph(
        val legend: String,
        val accessibilitySummary: String,
    ) : PlotPresentation {
        init {
            require(legend.isNotBlank()) { "compact plot glyph requires a legend" }
            require(accessibilitySummary.isNotBlank()) { "compact plot glyph requires an accessibility summary" }
        }
    }
}
