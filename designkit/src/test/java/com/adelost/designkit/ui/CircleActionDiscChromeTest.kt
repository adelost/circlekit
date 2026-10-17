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
    fun `a disc wears its kind at rest, lights when active and goes grey when unavailable`() {
        val tones = CircleTones(
            strong = Color(0xFF5BE2CD), dim = Color(0xFF29766A), ground = Color(0xFF0F3C36), edge = Color(0xFF2D7D71),
        )
        val rest = circleActionDiscChrome(true, false, false, false, tones = tones)
        val active = circleActionDiscChrome(true, true, false, false, tones = tones)
        val disabled = circleActionDiscChrome(false, false, false, false, tones = tones)
        val overPicture = circleActionDiscChrome(true, false, false, true, tones = tones)

        assertEquals(tones.ground, rest.fill)
        assertEquals(tones.edge, rest.contour)
        assertEquals(tones.strong, active.contour)
        assertEquals(CircleStyleTokens.Off, disabled.contour)
        assertEquals(MenuDesign.ringNeutral, overPicture.contour)
        assertNotEquals(tones.ground, overPicture.fill)
        // Empty SEND is unavailable even when its caller supplies a bright tint.
        for (tint in listOf(null, Color.White, Color.Magenta)) {
            assertEquals(tones.dim, circleActionDiscChrome(false, true, false, false, tones = tones, iconTint = tint).iconTint)
            assertEquals(tint, circleActionDiscChrome(true, false, false, false, tones = tones, iconTint = tint).iconTint)
        }
    }
}
