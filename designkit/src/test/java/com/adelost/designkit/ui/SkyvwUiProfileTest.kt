package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class SkyvwUiProfileTest {
    @Test
    fun `canonical Watch profile is independent of host resolution`() {
        val profile = SkyvwUiProfiles.WatchCanonical

        assertEquals(SkyvwSurfaceClass.ROUND, profile.surfaceClass)
        assertEquals(1f, profile.atomScale, 0f)
        assertEquals(192f, profile.canonicalRoundViewportDp)
    }

    @Test
    fun `phone layout changes capacity without deriving atom scale`() {
        val compact = SkyvwUiProfiles.PhoneCompact
        val wide = SkyvwUiProfiles.PhoneWide

        assertEquals(compact.atomScale, wide.atomScale, 0f)
        assertNull(compact.canonicalRoundViewportDp)
        assertNull(wide.canonicalRoundViewportDp)
    }

    @Test
    fun `phone profiles cannot claim the round watch surface`() {
        assertThrows(IllegalArgumentException::class.java) {
            SkyvwUiProfiles.phoneProfileFor(SkyvwSurfaceClass.ROUND)
        }
    }
}
