package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.LocalCircleActionHostCost
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Skyvw 2026-10-10: in MAP DETAIL's explanation the hold pill read "RESET TO / DEFAULT", left-aligned on two lines,
 * on the watch and at 320 dp. A pill whose words are a little wider than its room shrinks to one centred line.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w192dp-h192dp-round-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AHoldPillKeepsOneCentredLineTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `a pill a little too narrow for its words keeps them on one centred line`() {
        compose.setContent {
            // The room is 88 % of the words at their design size, plus the pill's own 16 dp each side.
            val words = rememberTextMeasurer().measure(
                LABEL,
                TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
            )
            val roomDp = with(LocalDensity.current) { words.size.width.toDp().value } * 0.88f + 32f
            CompositionLocalProvider(LocalCircleActionHostCost provides CircleActionHostCost.WORN) {
                Box(Modifier.width(roomDp.dp)) { HoldPill(text = LABEL, onConfirm = {}) }
            }
        }
        compose.waitForIdle()

        val layout = layoutOf(LABEL)
        println("pill: ${layout.lineCount} line(s) at ${layout.layoutInput.style.fontSize}")
        assertEquals("the pill's words wrapped instead of shrinking", 1, layout.lineCount)
        assertEquals("the pill's words are not centred", TextAlign.Center, layout.layoutInput.style.textAlign)
    }

    private fun layoutOf(text: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(text, useUnmergedTree = true).fetchSemanticsNode()
            .config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        return results.single()
    }

    private companion object {
        const val LABEL = "RESET TO DEFAULT"
    }
}
