package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SkyvwComponentViewportTest {
    @Test
    fun `fixed atoms never inherit container growth`() {
        assertEquals(1f, SkyvwContentScale.FixedAtoms.scaleFor(renderedSideDp = 379f), 0f)
    }

    @Test
    fun `canonical fit scales every internal atom with the viewport`() {
        val fit = SkyvwContentScale.CanonicalFit(canonicalSideDp = 192f)

        assertEquals(1f, fit.scaleFor(renderedSideDp = 192f), 0f)
        assertEquals(379f / 192f, fit.scaleFor(renderedSideDp = 379f), 0.0001f)
        assertEquals(420f / 192f, fit.scaleFor(renderedSideDp = 420f), 0.0001f)
    }

    @Test
    fun `invalid component geometry fails closed`() {
        assertThrows(IllegalArgumentException::class.java) {
            SkyvwContentScale.CanonicalFit(canonicalSideDp = 0f)
        }
        assertThrows(IllegalArgumentException::class.java) {
            SkyvwComponentViewportSpec(
                sideDp = Float.NaN,
                contentScale = SkyvwContentScale.FixedAtoms,
            )
        }
    }
}
