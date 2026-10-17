package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleRoleTextFitTest {
    private fun width(text: String, tracking: Float) = text.length * 5f + (text.length - 1) * tracking

    @Test fun `tracking is the largest value that fits without changing size`() {
        val fit = fitCircleRoleText("RECORDING", 1f, 48f, false, ::width)
        assertEquals("RECORDING", fit.text)
        assertTrue(fit.trackingSp in 0.374f..0.375f)
    }

    @Test fun `wrapping restores role tracking and only breaks between words`() {
        val fit = fitCircleRoleText("RESET TO DEFAULT", 1f, 48f, false, ::width)
        assertEquals("RESET TO\nDEFAULT", fit.text)
        assertEquals(1f, fit.trackingSp, 0f)
    }

    @Test fun `an oversized word stays whole for its owner to see`() {
        assertEquals("RECORDING", fitCircleRoleText("RECORDING", 1f, 20f, false, ::width).text)
    }

    @Test fun `a reading never wraps or loses its unit`() {
        assertEquals("1,008.1 hPa", fitCircleRoleText("1,008.1 hPa", 0f, 20f, true, ::width).text)
    }
}
