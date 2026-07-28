package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class CircleActionDiscChromeTest {
    @Test
    fun `label-free action answers on its surface and contour`() {
        val rest = circleActionDiscChrome(
            enabled = true,
            active = false,
            pressed = false,
            scrim = false,
        )
        val pressed = circleActionDiscChrome(
            enabled = true,
            active = false,
            pressed = true,
            scrim = false,
        )

        assertNotEquals(rest.fill, pressed.fill)
        assertNotEquals(rest.contour, pressed.contour)
        assertEquals(1f, rest.scale, 0f)
        assertEquals(MenuDesign.backPressScale, pressed.scale, 0f)
    }

    @Test
    fun `active and disabled states remain semantic at rest`() {
        val active = circleActionDiscChrome(true, true, false, false)
        val disabled = circleActionDiscChrome(false, false, false, false)

        assertEquals(MenuDesign.ringActive, active.contour)
        assertEquals(RingTokens.Off, disabled.contour)
    }
}
