package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import com.adelost.designkit.press.CirclePress
import com.adelost.designkit.press.CirclePressProbe
import com.adelost.designkit.press.OneCuePerGatedControl
import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * THE TWO RINGKIT COMPONENTS THAT PAINT THEIR OWN CUE, pressed and read off the glass. Row 215.
 *
 * The other two are in designkit's case of the same name, and its KDoc carries why all four exist.
 * These two are the ones whose wait is a wash under a WORD rather than an arc on a ring: the quiet
 * action text, and the +/- circle of an adjustment screen.
 *
 * [TextAction] was also drawing TWO cues until this row. It paints the wash under its label and never
 * told the gesture so, and the gesture paints on its own bounds by default, which here are the label
 * plus eighteen dp of padding on either side. Saying [com.adelost.designkit.ui.CirclePressCue.OWNED]
 * is how a component keeps one.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OneCuePerGatedControlTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val probe = CirclePressProbe(compose)

    @Test
    fun `an action word says how much of its gate a finger has spent, and nothing for a graze`() {
        OneCuePerGatedControl.aGrazeSaysNothing("an action word", pressTheWord(CirclePressProbe.A_FLICK_MS))
        OneCuePerGatedControl.aHeldControlDrawsItsGateOut(
            what = "an action word",
            gateMs = MenuDesign.tapHoldMs,
            press = pressTheWord(MenuDesign.tapHoldMs),
        )
    }

    @Test
    fun `the word draws its own wash and not the gesture's as well`() {
        // ONE CUE, measured against the control's own renderer at full. A complete work fraction paints
        // exactly the wash under the word; a complete press must paint the same ink. Until this row the
        // gesture also painted on ITS bounds, which here are the word plus eighteen dp of padding on
        // either side, so a press drew both and the pressed frame carried far more ink than one cue is.
        theWord.value = CircleLabelProgress.Determinate(1f)
        mountTheWord()
        val oneCueAtFull = probe.colouredAtRest(compose.onNodeWithContentDescription(THE_WORD))
        theWord.value = null

        val pressed = pressTheWord(MenuDesign.tapHoldMs)
        assertTrue(
            "a complete press drew ${pressed.cueAtTheGate} pixels against the $oneCueAtFull pixels " +
                "this control draws when its own renderer is full. Either the press did not complete " +
                "at its gate, or something is drawing a second cue beside the word's own",
            pressed.cueAtTheGate >= oneCueAtFull * 19 / 20 && pressed.cueAtTheGate <= oneCueAtFull * 21 / 20,
        )
    }

    @Test
    fun `a step circle says how much of its gate a finger has spent, and nothing for a graze`() {
        OneCuePerGatedControl.aGrazeSaysNothing("a step circle", pressTheStep(CirclePressProbe.A_FLICK_MS))
        OneCuePerGatedControl.aHeldControlDrawsItsGateOut(
            what = "a step circle",
            gateMs = MenuDesign.tapHoldMs,
            press = pressTheStep(MenuDesign.tapHoldMs),
        )
    }

    // ---- the two controls ------------------------------------------------------------------------

    private val theWord = mutableStateOf<CircleLabelProgress?>(null)

    private fun mountTheWord() = probe.mount {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            TextAction(text = THE_WORD, onTap = {}, labelProgress = theWord.value)
        }
    }

    private fun pressTheWord(holdFor: Long): CirclePress {
        mountTheWord()
        return probe.press(compose.onNodeWithContentDescription(THE_WORD), holdFor)
    }

    private fun pressTheStep(holdFor: Long): CirclePress {
        probe.mount {
            Box(Modifier.fillMaxSize().background(Color.Black)) {
                // The tap variant: adjustHoldMs left null, which is what an ordinary stepper is. The
                // held variant is a HoldFillBox and draws its own measured fill already.
                val row = RowSpec(
                    key = "opening",
                    title = "OPENING",
                    sub = "800 M",
                    icon = RingIcons.Grid,
                    onDec = {},
                    onInc = {},
                )
                RingAdjustmentScreen(RingScreen.Adjustment("OPENING", row, flowOf(row)))
            }
        }
        return probe.press(compose.onNodeWithText(THE_STEP), holdFor)
    }

    private companion object {
        const val THE_WORD = "REFRESH"

        /** The visible glyph is this control's whole merged name: [StepCircle] states no label. */
        const val THE_STEP = "+"
    }
}
