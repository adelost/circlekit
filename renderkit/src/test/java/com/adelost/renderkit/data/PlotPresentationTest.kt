package com.adelost.renderkit.data

import org.junit.Assert.assertThrows
import org.junit.Test

class PlotPresentationTest {
    @Test
    fun `cartesian time carries both complete axes`() {
        PlotPresentation.CartesianTime(
            xQuantity = PlotQuantityRef("time"),
            xWindow = PlotWindow(0.0, 60.0),
            xFormatter = PlotFormatterRef("clock-time"),
            yQuantity = PlotQuantityRef("pressure"),
            yUnit = PlotUnitRef("hPa"),
            yRange = PlotRange(990.0, 1030.0),
            yFormatter = PlotFormatterRef("one-decimal"),
        )
    }

    @Test
    fun `compact glyph cannot omit its readable meaning`() {
        assertThrows(IllegalArgumentException::class.java) {
            PlotPresentation.CompactGlyph(legend = "", accessibilitySummary = "trend rising")
        }
        assertThrows(IllegalArgumentException::class.java) {
            PlotPresentation.CompactGlyph(legend = "pressure trend", accessibilitySummary = "")
        }
    }
}
