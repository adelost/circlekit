package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class SkyvwInstrumentDialCenterTest {
    @Test
    fun `hero typography fits ordinary five digit altitude without compacting its unit`() {
        assertEquals(SkyvwDialDesign.HeroSp, skyvwAltitudeHeroSizeSp(3))
        assertEquals(SkyvwDialDesign.FourDigitHeroSp, skyvwAltitudeHeroSizeSp(4))
        assertEquals(43.2f, skyvwAltitudeHeroSizeSp(5), 0.001f)
        assertEquals(36f, skyvwAltitudeHeroSizeSp(6), 0.001f)
    }

    @Test
    fun `hero receives its optical correction while annotations orbit it`() {
        val placement = skyvwDialCenterStackPlacement(
            containerHeight = 360,
            motionHeight = 18,
            heroHeight = 110,
            reachHeight = 20,
            motionHeroGap = 4,
            reachOffsetY = -6,
            heroOpticalOffsetY = -3,
        )

        assertEquals(122, placement.heroY)
        assertEquals(177, placement.heroY + 110 / 2)
        assertEquals(100, placement.motionY)
        assertEquals(226, placement.reachY)
    }

    @Test
    fun `empty motion label cannot displace the hero`() {
        val withoutMotion = skyvwDialCenterStackPlacement(
            containerHeight = 192,
            motionHeight = 0,
            heroHeight = 74,
            reachHeight = 0,
            motionHeroGap = 2,
            reachOffsetY = -3,
            heroOpticalOffsetY = -2,
        )
        val reservedMotionLine = skyvwDialCenterStackPlacement(
            containerHeight = 192,
            motionHeight = 9,
            heroHeight = 74,
            reachHeight = 0,
            motionHeroGap = 2,
            reachOffsetY = -3,
            heroOpticalOffsetY = -2,
        )

        assertEquals(57, withoutMotion.heroY)
        assertEquals(withoutMotion.heroY, reservedMotionLine.heroY)
    }

    @Test
    fun `annotations clamp without changing hero centring on constrained faces`() {
        val placement = skyvwDialCenterStackPlacement(
            containerHeight = 40,
            motionHeight = 24,
            heroHeight = 30,
            reachHeight = 18,
            motionHeroGap = 4,
            reachOffsetY = -3,
            heroOpticalOffsetY = -2,
        )

        assertEquals(3, placement.heroY)
        assertEquals(0, placement.motionY)
        assertEquals(22, placement.reachY)
    }
}
