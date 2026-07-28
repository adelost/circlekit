package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class SkyvwActionDiscChromeTest {
    @Test
    fun `label-free action answers on its surface and contour`() {
        val rest = skyvwActionDiscChrome(
            enabled = true,
            active = false,
            pressed = false,
            scrim = false,
        )
        val pressed = skyvwActionDiscChrome(
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
        val active = skyvwActionDiscChrome(true, true, false, false)
        val disabled = skyvwActionDiscChrome(false, false, false, false)

        assertEquals(MenuDesign.ringActive, active.contour)
        assertEquals(RingTokens.Off, disabled.contour)
    }
}
