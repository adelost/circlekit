package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Skyvw's SETTINGS, 2026-10-09: "RECORDING" stood under its circle as "RECORDIN / G", on the watch and at
 * 320 dp. A one-word label a little wider than its cell must shrink to fit before it breaks.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w192dp-h192dp-round-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AWordStaysWholeUnderItsCircleTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `a one-word label slightly wider than its cell stays one word`() {
        var cellDp = 0f
        compose.setContent {
            // The cell is 92 % of the word at its design size, which is where it broke in two.
            val measured = rememberTextMeasurer().measure(
                LABEL,
                TextStyle(fontSize = 9.5.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
            )
            cellDp = with(LocalDensity.current) { measured.size.width.toDp().value } * 0.92f
            // The frame every icon ring draws, with its label's own semantics: inside a row action the
            // label hands its words to the parent and has no text node of its own to read.
            Box(Modifier.width(cellDp.dp)) {
                CircleIconRingFrame(
                    icon = RingIcons.Record, label = LABEL, modifier = Modifier,
                    diameter = MenuDesign.launcherDiameter, active = null, accent = ringIconAccent(RingIcons.Record),
                    fontFamily = null, labelSize = 9.5.sp, centerValue = null, contourColor = null,
                    iconRotationDegrees = 0f, choiceState = null, sub = null, enabled = true,
                    gestureModifier = Modifier,
                )
            }
        }
        compose.waitForIdle()

        val layout = layoutOf(LABEL)
        val lines = (0 until layout.lineCount).map { layout.getLineStart(it) until layout.getLineEnd(it) }
            .map { LABEL.substring(it.first, it.last + 1) }
        println("cell $cellDp dp: $lines at ${layout.layoutInput.style.fontSize}")
        assertEquals("the word broke across lines: $lines", 1, layout.lineCount)
        assertTrue("it fits by being smaller, not by spilling over", !layout.hasVisualOverflow)
    }

    private fun layoutOf(text: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(text, useUnmergedTree = true).fetchSemanticsNode().config[SemanticsActions.GetTextLayoutResult].action
            ?.invoke(results)
        return results.single()
    }

    private companion object {
        const val LABEL = "RECORDING"
    }
}
