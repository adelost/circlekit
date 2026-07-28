package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test

class CircleCanvasTest {
    @Test
    fun `there is one canvas and it is true black`() {
        // The CARBON menu theme is gone, not defaulted off (Mattias
        // 2026-07-21: "vi kör oled"). Menus and the instrument face share one
        // pigment, so no surface can render grey again.
        assertEquals(Color.Black, circleCanvasColor())
    }
}
