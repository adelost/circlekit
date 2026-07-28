package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SkyvwSurfaceSpecTest {
    @Test
    fun `phone dial fills its column while keeping canonical internal geometry`() {
        val compact = resolveSkyvwSurfaceLayout(393f, round = false)
        val wide = resolveSkyvwSurfaceLayout(840f, round = false)

        assertEquals(SkyvwSurfaceClass.PHONE_COMPACT, compact.surfaceClass)
        assertEquals(361f, compact.altitudeDialViewport.sideDp)
        assertEquals(SkyvwViewportBoundaryEdge.BOTTOM, compact.altitudeDialViewport.boundaryEdge)
        assertEquals(
            SkyvwContentScale.CanonicalFit(SkyvwUiProfiles.CANON_ROUND_CANVAS_DP),
            compact.altitudeDialViewport.contentScale,
        )
        assertEquals(SkyvwSurfaceClass.PHONE_WIDE, wide.surfaceClass)
        assertEquals(SkyvwViewportBoundaryEdge.END, wide.altitudeDialViewport.boundaryEdge)
        assertEquals(840f, wide.contentMaxWidthDp)
        assertEquals(420f, wide.altitudeDialViewport.sideDp)
        assertTrue(wide.altitudeDialViewport.sideDp > compact.altitudeDialViewport.sideDp)
    }

    @Test
    fun `round surface stays round`() {
        val round = resolveSkyvwSurfaceLayout(192f, round = true)
        assertEquals(SkyvwSurfaceClass.ROUND, round.surfaceClass)
        assertEquals(null, round.altitudeDialViewport.boundaryEdge)
        assertEquals(192f, round.altitudeDialViewport.sideDp)
        assertEquals(1f, round.altitudeDialViewport.contentScale.scaleFor(192f), 0f)
    }

    @Test
    fun `phone rotation changes composition but gives the dial the same short-side fit`() {
        val portrait = resolveSkyvwSurfaceLayout(widthDp = 411f, heightDp = 891f, round = false)
        val landscape = resolveSkyvwSurfaceLayout(widthDp = 891f, heightDp = 411f, round = false)

        assertEquals(SkyvwSurfaceClass.PHONE_COMPACT, portrait.surfaceClass)
        assertEquals(SkyvwSurfaceClass.PHONE_WIDE, landscape.surfaceClass)
        assertEquals(379f, portrait.altitudeDialViewport.sideDp)
        assertEquals(379f, landscape.altitudeDialViewport.sideDp)
    }

    @Test
    fun `instrument chrome keeps its physical type size at larger system font scales`() {
        assertEquals(9.5f, fixedSkyvwUiSp(9.5f, 1f))
        assertEquals(9.5f / 1.3f, fixedSkyvwUiSp(9.5f, 1.3f))
        assertEquals(9.5f, fixedSkyvwUiSp(9.5f, 0.85f))
    }
}
