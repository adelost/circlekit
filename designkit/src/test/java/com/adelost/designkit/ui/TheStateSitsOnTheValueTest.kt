package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.adelost.designkit.glass.CircleGlass
import com.adelost.designkit.glass.CircleGlassPalette
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * A row's state is the scale's colour and sits on its value; its glyph keeps its kind (style C, Mattias 2026-10-17:
 * the same icon has the same colour everywhere). A row's [CircleRingRow] `semanticColor` used to repaint the glyph
 * too, so Skyvw's ALARM HEIGHTS bell wore the altitude band on a disc of the bell's own kind, and an operable row's
 * value stayed grey. The row's title is ink and its glyph is the kind, so a state on the glass is a state on the value.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TheStateSitsOnTheValueTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val glass = CircleGlass(compose)

    @Test
    fun `a row you can press keeps its glyph's kind and wears its state on the value`() {
        mount { CircleRingRow(title = "ALARM", sub = com.adelost.designkit.ui.CircleWords("1 500 M"), icon = RingIcons.Grid, onTap = {}, semanticColor = STATE) }

        assertTrue("the glyph wears its kind", glass.count(CircleGlassPalette.kind.strong) > 0)
        assertTrue("the value wears the state", glass.count(STATE) > 0)
    }

    @Test
    fun `a reading keeps its glyph's kind and wears its state on the value`() {
        mount {
            CircleRingRow(
                title = "WIND", sub = com.adelost.designkit.ui.CircleWords("5 M/S"), icon = RingIcons.Grid, onTap = null, semanticColor = STATE, multiline = true,
            )
        }

        assertTrue("the glyph wears its kind", glass.count(CircleGlassPalette.kind.strong) > 0)
        assertTrue("the value wears the state", glass.count(STATE) > 0)
    }

    private fun mount(content: @Composable () -> Unit) = compose.setContent {
        CompositionLocalProvider(LocalCircleActionHostCost provides CircleActionHostCost.NONE) {
            CircleAccentPaletteProvider(CircleGlassPalette.palette) {
                Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) { content() }
            }
        }
    }

    private companion object {
        /** A state a product hands the row, unlike every tone of the palette in scope. */
        val STATE = Color(0xFFE8E820)
    }
}
