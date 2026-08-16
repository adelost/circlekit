package com.adelost.renderkit.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OledDataPlotSpecTest {
    @Test
    fun `192 dp plot keeps one stable safe width across its centre band`() {
        val spec = OledDataPlotSpec(
            roundHeightDp = 90f,
            roundCenterTravelDp = 20f,
            edgeInsetDp = 4f,
        )

        assertEquals(133.3f, spec.stableRoundWidthDp(192f), 0.1f)
        val halfWidth = spec.stableRoundWidthDp(192f) / 2f
        val radius = 96f
        val worstY = spec.roundHeightDp / 2f + spec.roundCenterTravelDp
        assertTrue((halfWidth + spec.edgeInsetDp) * (halfWidth + spec.edgeInsetDp) + worstY * worstY <= radius * radius)
    }

    @Test
    fun `plot centre clamps without changing plot width`() {
        assertEquals(76f, clampRoundPlotCenterDp(20f, 96f, 20f), 0f)
        assertEquals(96f, clampRoundPlotCenterDp(96f, 96f, 20f), 0f)
        assertEquals(116f, clampRoundPlotCenterDp(160f, 96f, 20f), 0f)
    }

    @Test
    fun `impossible geometry has no pretend width`() {
        assertEquals(
            0f,
            stableRoundPlotWidthDp(
                viewportDiameterDp = 192f,
                plotHeightDp = 160f,
                centerTravelDp = 20f,
            ),
            0f,
        )
    }

    @Test
    fun `one clamped module gives every child its own chord`() {
        val module = OledDataPlotModuleSpec(
            presentation = PlotPresentation.CompactGlyph("trend", "pressure trend"),
            roundCenterTravelDp = 20f,
            children = listOf(
                OledDataPlotChildSpec("plot", 90f, 0f, OledPlotChildWidthPolicy.STABLE_ACROSS_CLAMP),
                OledDataPlotChildSpec("legend", 12f, 58f, OledPlotChildWidthPolicy.CURRENT_CHORD),
            ),
        )

        val layout = module.roundLayout(requestedModuleCenterDp = 180f, viewportDiameterDp = 192f)

        assertEquals(116f, layout.moduleCenterDp, 0f)
        assertEquals(116f, layout.children.single { it.id == "plot" }.centerDp, 0f)
        assertEquals(174f, layout.children.single { it.id == "legend" }.centerDp, 0f)
        assertTrue(layout.children.single { it.id == "plot" }.widthDp > 0f)
        assertTrue(layout.children.single { it.id == "legend" }.widthDp > 0f)
    }

    @Test
    fun `axis bearing child keeps one width through module travel`() {
        val module = OledDataPlotModuleSpec(
            presentation = PlotPresentation.CartesianTime(
                PlotQuantityRef("time"), PlotWindow(0.0, 1.0), PlotFormatterRef("time"),
                PlotQuantityRef("value"), PlotUnitRef("1"), PlotRange(0.0, 1.0), PlotFormatterRef("value"),
            ),
            roundCenterTravelDp = 20f,
            children = listOf(OledDataPlotChildSpec("plot", 90f, 0f, OledPlotChildWidthPolicy.STABLE_ACROSS_CLAMP)),
        )

        val top = module.roundLayout(0f, 192f).children.single().widthDp
        val middle = module.roundLayout(96f, 192f).children.single().widthDp
        val bottom = module.roundLayout(192f, 192f).children.single().widthDp

        assertEquals(top, middle, 0f)
        assertEquals(middle, bottom, 0f)
    }
}
