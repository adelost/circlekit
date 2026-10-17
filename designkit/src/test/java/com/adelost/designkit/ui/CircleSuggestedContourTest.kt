package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * skyvw:0 row 52: the "suggested" ring is a CircleKit parameter, not a product's own drawing. Style C draws it solid in
 * the dimmed weight of its own colour (plan "Osäkert är dämpat, aldrig streckat"), so the weight is pinned here.
 */
class CircleSuggestedContourTest {
    @Test
    fun `a suggested contour keeps its colour at the dimmed weight`() {
        val colour = Color(0xFF5BE2CD)
        assertEquals(colour.copy(alpha = MenuDesign.suggestedContourShare), circleSuggestedContour(colour, suggested = true))
    }

    @Test
    fun `an ordinary contour is its colour`() {
        val colour = Color(0xFF5BE2CD)
        assertEquals(colour, circleSuggestedContour(colour, suggested = false))
    }
}
