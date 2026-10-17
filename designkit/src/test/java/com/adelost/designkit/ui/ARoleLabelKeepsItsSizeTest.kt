package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w192dp-h192dp-round-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ARoleLabelKeepsItsSizeTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun `a long label loses tracking not size before wrapping`() {
        mount(48)
        val layout = layoutOf()
        assertEquals("the role size never shrinks", 7.5f, layout.layoutInput.style.fontSize.value)
        assertEquals("tracking can keep this word on one line", 1, layout.lineCount)
        assertTrue("tracking is reduced", layout.layoutInput.style.letterSpacing.value < 0.975f)
        assertFalse("the whole word fits", layout.hasVisualOverflow)
    }

    @Test fun `a single word never splits even below its zero tracking width`() {
        mount(25)
        val layout = layoutOf()
        assertEquals("product copy is reported too wide, not split", 1, layout.lineCount)
        assertEquals("even an oversized word keeps the role size", 7.5f, layout.layoutInput.style.fontSize.value)
    }

    @Test fun `a numeric label keeps Barlow and has no tracking`() {
        compose.setContent {
            CircleText("100", role = CircleTextRole.LABEL, color = Color.White, numerals = true)
        }
        val style = layoutOf("100").layoutInput.style
        assertEquals(GraphiteType.Numerals, style.fontFamily)
        assertEquals(0f, style.letterSpacing.value)
        assertEquals(7.5f, style.fontSize.value)
    }

    @Test fun `product copy grows past a caller's old one-line cap`() {
        compose.setContent {
            Box(Modifier.width(48.dp)) {
                CircleText("TOUCH VIBRATION", CircleTextRole.LABEL, Color.White, maxLines = 1)
            }
        }
        assertEquals("product words may not be cut by an old line cap", 2, layoutOf("TOUCH\nVIBRATION").lineCount)
    }

    @Test fun `a parent may ask for intrinsic width before laying out its label`() {
        compose.setContent {
            Box(Modifier.width(IntrinsicSize.Max)) {
                CircleText("RECORDING", role = CircleTextRole.LABEL, color = Color.White)
            }
        }
        assertEquals(7.5f, layoutOf().layoutInput.style.fontSize.value)
    }

    private fun mount(width: Int) = compose.setContent {
        Box(Modifier.width(width.dp)) {
            CircleText(text = "RECORDING", role = CircleTextRole.LABEL, color = Color.White)
        }
    }

    private fun layoutOf(text: String = "RECORDING"): TextLayoutResult {
        compose.waitForIdle()
        val layouts = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(text).fetchSemanticsNode()
            .config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        return layouts.single()
    }
}
