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
}
