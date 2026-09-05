package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
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
        // Empty SEND is unavailable even when its caller supplies a bright tint.
        for (tint in listOf(null, Color.White, Color.Magenta)) {
            assertEquals(RingTokens.Off,
                circleActionDiscChrome(false, true, false, false, iconTint = tint).iconTint)
            assertEquals(tint,
                circleActionDiscChrome(true, false, false, false, iconTint = tint).iconTint)
        }
    }
}
