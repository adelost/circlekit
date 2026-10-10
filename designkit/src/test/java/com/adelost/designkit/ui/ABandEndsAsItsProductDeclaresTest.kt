package com.adelost.designkit.ui

import android.graphics.Region
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Skyvw 2026-10-10: every free end of a bar or an arc is round, the join between two colours is square, and a round
 * end is pulled in so nothing grows longer than its value. One shape for every band, read here as which points fall
 * inside it.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ABandEndsAsItsProductDeclaresTest {
    @Test
    fun `a round bar has no corners and keeps its length`() {
        val round = circleBarPath(0f, 0f, 1000f, 100f, CircleBandEnds.ROUND)
        val square = circleBarPath(0f, 0f, 1000f, 100f, CircleBandEnds.SQUARE)
        assertFalse("a round bar kept its corner", round.has(5f, 5f))
        assertTrue("a square bar lost its corner", square.has(5f, 5f))
        assertTrue("the round end reaches the bar's value at its middle", round.has(995f, 50f))
        assertFalse("the round bar grew past its value", round.has(1005f, 50f))
    }

    @Test
    fun `a round arc ends at its angle, and its outer corner is gone`() {
        val c = Offset(2000f, 2000f)
        val band = circleArcBandPath(c, 900f, 1100f, -90f, 90f, CircleBandEnds.ROUND, CircleBandEnds.ROUND)
        assertTrue("the band's middle is not drawn", band.has(c, 1000f, -45f))
        assertTrue("the round end does not reach its angle at the middle of the band", band.has(c, 1000f, -0.5f))
        assertFalse("the round end grew past its angle", band.has(c, 1000f, 0.6f))
        assertFalse("the round end kept its outer corner", band.has(c, 1095f, -0.5f))
    }

    @Test
    fun `a square join keeps its angle and its corner beside a round free end`() {
        val c = Offset(2000f, 2000f)
        val band = circleArcBandPath(c, 900f, 1100f, -90f, 90f, CircleBandEnds.SQUARE, CircleBandEnds.ROUND)
        assertTrue("the square join lost its outer corner", band.has(c, 1095f, -89.8f))
        assertFalse("the square join reached before its angle", band.has(c, 1000f, -90.6f))
        assertTrue("the round end does not reach its angle", band.has(c, 1000f, -0.5f))
        assertFalse("the round end grew past its angle", band.has(c, 1000f, 0.6f))
    }

    @Test
    fun `a band shorter than its two round ends is a dot where the band was`() {
        val c = Offset(2000f, 2000f)
        val dot = circleArcBandPath(c, 900f, 1100f, -2f, 4f, CircleBandEnds.ROUND, CircleBandEnds.ROUND)
        assertTrue("the dot is not where the band was", dot.has(c, 1000f, 0f))
        assertTrue("the dot is not round", dot.has(c, 1000f, 5f) && dot.has(c, 1000f, -5f))
        assertFalse("the dot grew past its own radius", dot.has(c, 1000f, 6.5f) || dot.has(c, 1000f, -6.5f))
    }

    private fun Path.has(x: Float, y: Float): Boolean {
        val region = Region()
        region.setPath(asAndroidPath(), Region(-5000, -5000, 5000, 5000))
        return region.contains(x.roundToInt(), y.roundToInt())
    }

    private fun Path.has(center: Offset, radius: Float, deg: Float): Boolean {
        val rad = Math.toRadians(deg.toDouble())
        return has(center.x + radius * cos(rad).toFloat(), center.y + radius * sin(rad).toFloat())
    }
}
