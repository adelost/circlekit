package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleSurfaceSpecTest {
    @Test
    fun `phone dial fills its column while keeping canonical internal geometry`() {
        val compact = resolveCircleSurfaceLayout(393f, round = false)
        val wide = resolveCircleSurfaceLayout(840f, round = false)

        assertEquals(CircleSurfaceClass.PHONE_COMPACT, compact.surfaceClass)
        assertEquals(361f, compact.altitudeDialViewport.sideDp)
        assertEquals(CircleViewportBoundaryEdge.BOTTOM, compact.altitudeDialViewport.boundaryEdge)
        assertEquals(
            CircleContentScale.CanonicalFit(CircleUiProfiles.CANON_ROUND_CANVAS_DP),
            compact.altitudeDialViewport.contentScale,
        )
        assertEquals(CircleSurfaceClass.PHONE_WIDE, wide.surfaceClass)
        assertEquals(CircleViewportBoundaryEdge.END, wide.altitudeDialViewport.boundaryEdge)
        assertEquals(840f, wide.contentMaxWidthDp)
        assertEquals(420f, wide.altitudeDialViewport.sideDp)
        assertTrue(wide.altitudeDialViewport.sideDp > compact.altitudeDialViewport.sideDp)
    }

    @Test
    fun `round surface stays round`() {
        val round = resolveCircleSurfaceLayout(192f, round = true)
        assertEquals(CircleSurfaceClass.ROUND, round.surfaceClass)
        assertEquals(null, round.altitudeDialViewport.boundaryEdge)
        assertEquals(192f, round.altitudeDialViewport.sideDp)
        assertEquals(1f, round.altitudeDialViewport.contentScale.scaleFor(192f), 0f)
    }

    @Test
    fun `phone rotation changes composition but gives the dial the same short-side fit`() {
        val portrait = resolveCircleSurfaceLayout(widthDp = 411f, heightDp = 891f, round = false)
        val landscape = resolveCircleSurfaceLayout(widthDp = 891f, heightDp = 411f, round = false)

        assertEquals(CircleSurfaceClass.PHONE_COMPACT, portrait.surfaceClass)
        assertEquals(CircleSurfaceClass.PHONE_WIDE, landscape.surfaceClass)
        assertEquals(379f, portrait.altitudeDialViewport.sideDp)
        assertEquals(379f, landscape.altitudeDialViewport.sideDp)
    }

    @Test
    fun `instrument chrome keeps its physical type size at larger system font scales`() {
        assertEquals(9.5f, fixedCircleUiSp(9.5f, 1f))
        assertEquals(9.5f / 1.3f, fixedCircleUiSp(9.5f, 1.3f))
        assertEquals(9.5f, fixedCircleUiSp(9.5f, 0.85f))
    }
}
