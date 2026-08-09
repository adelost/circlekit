package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The one answer to "how close to the edge may content sit here?".
 *
 * Before this atom the question had three answers — two per-row helpers in the
 * list host and a per-SCREEN constant in the menus — which is why menu rows
 * were simultaneously too narrow in the middle and clipped at the ends
 * (Mattias 2026-07-27).
 */
class CircleRoundSafeInsetTest {

    private val face = 192f
    private val x9 = listOf(CircleChromeSlot.HOUR_9)

    @Test
    fun `the circle takes nothing at its widest and the same from both ends`() {
        assertEquals(0f, roundChordInsetDp(face, face, contentCenterYDp = face / 2f), 0.001f)
        val upper = roundChordInsetDp(face, face, contentCenterYDp = 24f)
        val lower = roundChordInsetDp(face, face, contentCenterYDp = face - 24f)
        assertEquals(upper, lower, 0.001f)
        assertEquals(32.502f, upper, 0.01f)
    }

    @Test
    fun `a button only claims the band it actually occupies`() {
        // Level with X at 9 o'clock: 96 - 0.78*96 = 21.12, plus button radius
        // and the content gap.
        assertEquals(
            21.12f + 15f + ROUND_SAFE_CONTENT_GAP_DP,
            roundChromeInsetDp(face, face, contentCenterYDp = face / 2f, reservedSlots = x9),
            0.05f,
        )
        // Far above it the chrome asks for nothing — this is exactly what a
        // per-screen constant got wrong.
        assertEquals(
            0f,
            roundChromeInsetDp(face, face, contentCenterYDp = 20f, reservedSlots = x9),
            0.001f,
        )
    }

    @Test
    fun `the safe inset is whichever bite is larger at that height`() {
        // Mid-face the chrome wins; at the top the circle does.
        val middle = roundSafeInsetDp(face, face, face / 2f, x9)
        assertEquals(roundChromeInsetDp(face, face, face / 2f, x9), middle, 0.001f)

        val top = roundSafeInsetDp(face, face, 20f, x9)
        assertEquals(roundChordInsetDp(face, face, 20f), top, 0.001f)
        assertTrue("the circle must still bite at the top", top > 0f)
    }

    @Test
    fun `no reserved chrome means the circle alone decides`() {
        assertEquals(
            roundChordInsetDp(face, face, face / 2f),
            roundSafeInsetDp(face, face, face / 2f, reservedSlots = emptyList()),
            0.001f,
        )
    }

    @Test
    fun `clearance scales with the face - a fixed dp would collide on a large preview`() {
        val canonical = roundChromeInsetDp(192f, 192f, 96f, x9)
        val large = roundChromeInsetDp(360f, 360f, 180f, x9)
        assertTrue("a 360 dp face needs a deeper inset, got $large vs $canonical", large > canonical)
    }

    @Test
    fun `a right-hand slot claims the right edge by the same rule`() {
        val hour3 = listOf(CircleChromeSlot.HOUR_3)
        assertEquals(
            roundChromeInsetDp(face, face, face / 2f, x9),
            roundChromeInsetDp(face, face, face / 2f, hour3),
            0.001f,
        )
    }

    @Test
    fun `one-sided chrome only charges the edge it occupies`() {
        val left = roundSafeHorizontalInsetsDp(face, face, face / 2f, x9)
        val right = roundSafeHorizontalInsetsDp(
            face,
            face,
            face / 2f,
            listOf(CircleChromeSlot.HOUR_3),
        )

        assertTrue(left.start > left.end)
        assertEquals(0f, left.end, 0.001f)
        assertEquals(left.start, right.end, 0.001f)
        assertEquals(0f, right.start, 0.001f)
    }

    @Test
    fun `a degenerate viewport asks for nothing instead of crashing`() {
        assertEquals(0f, roundSafeInsetDp(0f, 0f, 0f, x9), 0.001f)
    }
}
