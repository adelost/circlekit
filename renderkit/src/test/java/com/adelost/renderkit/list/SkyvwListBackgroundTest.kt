package com.adelost.renderkit.list

import androidx.compose.ui.graphics.Color
import com.adelost.designkit.ui.GraphiteTokens
import org.junit.Assert.assertEquals
import org.junit.Test

class SkyvwListBackgroundTest {
    @Test
    fun `shared lists default to an OLED black canvas`() {
        val policy = SkyvwListPolicy()

        assertEquals(SkyvwListBackground.OLED, policy.background)
        assertEquals(Color.Black, policy.background.color())
    }

    @Test
    fun `graphite canvas remains an explicit selectable style`() {
        val policy = SkyvwListPolicy(background = SkyvwListBackground.GRAPHITE)

        assertEquals(GraphiteTokens.Canvas, policy.background.color())
    }
}
