package com.adelost.ringkit.ui

import com.adelost.designkit.ui.RingTokens
import com.adelost.ringkit.data.Health
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * skyvw:0 row 52: one source for the health colours, with the single branch the
 * products disagree on stated at the call instead of copied into each product.
 */
class HealthRingColorTest {
    @Test
    fun `fresh, aging and off come from the shared palette for every product`() {
        assertEquals(RingTokens.Fresh, Health.FRESH.ringColor())
        assertEquals(RingTokens.Aging, Health.AGING.ringColor())
        assertEquals(RingTokens.Off, Health.OFF.ringColor())
    }

    @Test
    fun `a product states what a value nobody is updating looks like on its own face`() {
        assertEquals(RingTokens.Broken, Health.BROKEN.ringColor())
        assertEquals(RingTokens.Off, Health.BROKEN.ringColor(broken = RingTokens.Off))
    }
}
