package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
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

    @Test fun `a canvas label takes the role weight tracking face and size`() {
        var paint: android.graphics.Paint? = null
        compose.setContent { paint = rememberCircleRolePaint(CircleTextRole.LABEL, Color.White) }
        compose.waitForIdle()
        val actual = requireNotNull(paint)
        assertEquals("native Typeface must carry Bold, not just the Compose style", 700, actual.typeface.weight)
        assertEquals(0.13f, actual.letterSpacing, 0.001f)
        assertEquals(15f, actual.textSize, 0.001f)
    }

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
            CircleText(com.adelost.designkit.ui.CircleNumerals("100"), role = CircleTextRole.LABEL, color = Color.White,)
        }
        val style = layoutOf("100").layoutInput.style
        assertEquals(GraphiteType.Numerals, style.fontFamily)
        assertEquals(0f, style.letterSpacing.value)
        assertEquals(7.5f, style.fontSize.value)
    }

    @Test fun `typed row reading has Barlow even at VALUE and words stay Onest`() {
        compose.setContent {
            androidx.compose.foundation.layout.Column {
                CircleContent(CircleMeasurement("1200", "m"), CircleTextRole.VALUE, Color.White)
                CircleText("GPS ERROR", CircleTextRole.NOTE, Color.White)
            }
        }
        assertEquals(GraphiteType.Numerals, layoutOf("1200 m").layoutInput.style.fontFamily)
        assertEquals(GraphiteType.Sans, layoutOf("GPS ERROR").layoutInput.style.fontFamily)
    }

    @Test fun `canvas reports the actual measured reading including the unit span and root bounds`() {
        var receipt: CircleTextLayout? = null
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { receipt = it }) {
                val measured = rememberCircleTextMeasurer().measure(CircleMeasurement("451", "m"), CircleTextRole.NUMBER, Color.White)
                measured.report(androidx.compose.ui.geometry.Rect(10f, 20f, 10f + measured.layout.size.width, 20f + measured.layout.size.height))
            }
        }
        compose.waitForIdle()
        val actual = requireNotNull(receipt)
        assertEquals("451 m", actual.text)
        assertEquals(GraphiteType.Numerals, actual.layout.layoutInput.style.fontFamily)
        assertEquals(7.5f, actual.layout.layoutInput.text.spanStyles.single().item.fontSize.value)
        assertEquals(10f, actual.boundsInRoot.left)
        assertEquals(12f, actual.expectedFontSp)
    }

    @Test fun `bounded canvas words wrap by the same fixed role policy`() {
        var measured: CircleMeasuredText? = null
        compose.setContent {
            measured = rememberCircleTextMeasurer().measure(CircleWords("TOUCH VIBRATION"), CircleTextRole.LABEL,
                Color.White, androidx.compose.ui.unit.Constraints(maxWidth = 96))
        }
        compose.waitForIdle()
        val layout = requireNotNull(measured).layout
        assertEquals(7.5f, layout.layoutInput.style.fontSize.value)
        assertEquals("TOUCH\nVIBRATION", layout.layoutInput.text.text)
        assertEquals(2, layout.lineCount)
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

    @Test fun `a row title measures in the width lent to its empty end slot`() {
        val receipts = mutableMapOf<String, CircleTextLayout>()
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { receipts[it.text] = it }) {
                Box(Modifier.width(70.dp)) {
                    CircleRingRowContent("BRIGHTNESS", CircleMeasurement("50", "%"), null, null,
                        CircleRowAffordance.of({}), leading = null, trailing = null, feedback = null,
                        endSlot = CircleRowEndSlot(28.dp, occupied = false) { Box(Modifier.size(28.dp)) })
                }
            }
        }
        compose.waitForIdle()
        val title = receipts.getValue("BRIGHTNESS")
        assertFalse("empty slot must not clip the title: ${title.layout.layoutInput.constraints}",
            title.layout.didOverflowWidth)
        assertTrue("own text bounds include the lent width: ${title.boundsInRoot}",
            title.boundsInRoot.width >= title.layout.getLineRight(0))
    }

    @Test fun `the text receipt checks the declared role independently of the rendered style`() {
        var receipt: CircleTextLayout? = null
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { receipt = it }) {
                CircleText("ROLE RECEIPT", CircleTextRole.NAME, Color.White)
            }
        }
        compose.waitForIdle()
        val text = requireNotNull(receipt)
        assertEquals(CircleTextRole.NAME.watch.sp, text.expectedFontSp, 0.001f)
        assertEquals("rendered size must equal the independently resolved role", text.expectedFontSp,
            text.layout.layoutInput.style.fontSize.value, 0.001f)
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
