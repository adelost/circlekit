package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class DesignLanguageContractTest {
    @Test
    fun `watch menus and Jump share the neutral Graphite vocabulary`() {
        assertEquals(GraphiteTokens.Surface, RingTokens.TileFill)
        assertEquals(GraphiteTokens.SurfaceStrong, RingTokens.ButtonFill)
        assertEquals(GraphiteTokens.Ink, RingTokens.Ink)
        assertEquals(GraphiteTokens.Muted, RingTokens.Dim)
        assertEquals(GraphiteTokens.Primary, RingTokens.Accent)
    }

    @Test
    fun `health states remain semantically distinct after palette convergence`() {
        assertNotEquals(RingTokens.Fresh, RingTokens.Aging)
        assertNotEquals(RingTokens.Aging, RingTokens.Broken)
        assertNotEquals(RingTokens.Broken, RingTokens.Off)
    }

    @Test
    fun `data progress separates its dim track from the full ink arc`() {
        assertEquals(Color.Black.copy(alpha = 0.72f), RingTokens.ProgressSurface)
        assertEquals(RingTokens.Outline, RingTokens.ProgressTrack)
        assertEquals(RingTokens.Ink, RingTokens.ProgressArc)
        assertNotEquals(RingTokens.ProgressTrack, RingTokens.ProgressArc)
    }

    @Test
    fun `round menu geometry keeps long labels and stepper units inside the chord`() {
        assertEquals(46.dp, MenuDesign.statRingDiameter)
        assertEquals(12.sp, MenuDesign.statValueSize)
        assertEquals(30.dp, MenuDesign.cornerDiameter)
        assertEquals(1.dp, MenuDesign.contourStroke)
        assertEquals(2.5.dp, RingMetrics.StrokeWidth)
        assertEquals(10.dp, MenuDesign.stepperIconSize)
        assertEquals(3.dp, MenuDesign.stepperIconGap)
        assertEquals(10.sp, MenuDesign.stepperValueSize)
        assertEquals(9.5.sp, MenuDesign.subSize)
    }

    @Test
    fun `the watch has exactly one action-ring diameter`() {
        // The home rim buttons are the standard; every other watch ring
        // aliases it (Mattias 2026-07-23). A second size is a contract break.
        assertEquals(30.dp, MenuDesign.watchActionRingDiameter)
        assertEquals(MenuDesign.watchActionRingDiameter, MenuDesign.iconRingDiameter)
        assertEquals(MenuDesign.watchActionRingDiameter, MenuDesign.launcherDiameter)
        assertEquals(MenuDesign.watchActionRingDiameter, MenuDesign.cornerDiameter)
        assertEquals(MenuDesign.watchActionRingDiameter, EdgeMenuDesign.optionRingDiameter)
    }
}
