package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.adelost.designkit.press.CirclePress
import com.adelost.designkit.press.CirclePressProbe
import com.adelost.designkit.press.OneCuePerGatedControl
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * THE COMPONENTS THAT PAINT THEIR OWN CUE, each one pressed and read off the glass. Row 215.
 *
 * Four controls in this kit say [CirclePressCue.OWNED]: they already draw the wait somewhere the
 * gesture's own bounds are not, so the gesture leaves the glass to them. Before this row that
 * permission was also permission to time it themselves, and all four did: a tween started by a
 * LaunchedEffect on `pressed`, which cannot begin until the press has reached composition two frames
 * after the finger. The gate counted from the pointer and the cue counted from a later moment, which
 * is how Link shipped a row that filled half a second and committed in one millisecond.
 *
 * They now read [CircleActionFeedbackState.holdProgress], which the gesture drives from the down
 * event's own uptime. The proof is mounted rather than called: a rule-only case feeds the number in
 * itself and stays green under exactly the mutation that matters.
 *
 * TWO OF THE FOUR ARE HERE; the other two, RingKit's action text and its step circle, are in ringkit's
 * case of the same name, because that is where they live.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class OneCuePerGatedControlTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val probe = CirclePressProbe(compose)

    @Test
    fun `a row says how much of its gate a finger has spent, and nothing for a graze`() {
        mountTheRow()

        OneCuePerGatedControl.aGrazeSaysNothing("a settings row", pressTheRow(CirclePressProbe.A_FLICK_MS))
        OneCuePerGatedControl.aHeldControlDrawsItsGateOut(
            what = "a settings row",
            gateMs = MenuDesign.tapHoldMs,
            press = pressTheRow(MenuDesign.tapHoldMs),
        )
    }

    @Test
    fun `a row's cue is the same size at the end of a short gate and a long one`() {
        // COMPLETES AT holdMs, stated where it can be measured without inventing a reference for
        // "full": two gates of different lengths, each read at the frame it commits on. Both are a
        // complete cue, so both draw the same ink. A cue whose zero is two frames late ends short of
        // full, and ends SHORTER on the shorter gate, because two frames is a bigger share of it.
        mountTheRow()
        val short = pressTheRow(MenuDesign.tapHoldMs)
        val long = pressTheRow(MenuDesign.holdDeliberateMs, declaredHoldMs = MenuDesign.holdDeliberateMs)

        val difference = kotlin.math.abs(short.cueAtTheGate - long.cueAtTheGate)
        assertTrue(
            "a ${MenuDesign.tapHoldMs} ms gate ended with ${short.cueAtTheGate} pixels of cue and a " +
                "${MenuDesign.holdDeliberateMs} ms gate with ${long.cueAtTheGate}. Two complete rings " +
                "are the same ring, so one of them did not complete when its action fired",
            difference <= long.cueAtTheGate / 10,
        )
    }

    @Test
    fun `an icon disc says how much of its gate a finger has spent, and nothing for a graze`() {
        mountTheDisc()

        OneCuePerGatedControl.aGrazeSaysNothing("an icon disc", pressTheDisc(CirclePressProbe.A_FLICK_MS))
        OneCuePerGatedControl.aHeldControlDrawsItsGateOut(
            what = "an icon disc",
            gateMs = CircleActionTiming.DELIBERATE.holdMs,
            press = pressTheDisc(CircleActionTiming.DELIBERATE.holdMs),
        )
    }

    // ---- the two controls ------------------------------------------------------------------------

    // State, not a plain var: the probe mounts once on purpose, so a new declaration only
    // reaches the row if the row is reading it from state.
    private val declaredRowHoldMs = mutableStateOf(MenuDesign.tapHoldMs)

    private fun mountTheRow() = probe.mount {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            CircleRingRow(
                title = "WAKE PHRASE",
                sub = "HEY JARVIS",
                icon = RingIcons.Grid,
                onTap = {},
                actionTiming = CircleActionTiming.DELIBERATE,
                actionHoldMs = declaredRowHoldMs.value,
            )
        }
    }

    private fun pressTheRow(holdFor: Long, declaredHoldMs: Long = MenuDesign.tapHoldMs): CirclePress {
        declaredRowHoldMs.value = declaredHoldMs
        mountTheRow()
        return probe.press(compose.onNodeWithContentDescription(THE_ROW), holdFor)
    }

    private fun mountTheDisc() = probe.mount {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            CircleIconDisc(
                icon = RingIcons.Grid,
                contentDescription = THE_DISC,
                actionLabel = "GRID",
                onTap = {},
                // A neutral glyph, so the only colour inside these bounds is the cue. The disc dips
                // ([MenuDesign.backPressScale]) while it is held, and a tinted glyph moving under that
                // scale would be counted as cue that grew.
                iconTint = RingTokens.Ink,
                timing = CircleActionTiming.DELIBERATE,
            )
        }
    }

    private fun pressTheDisc(holdFor: Long): CirclePress {
        mountTheDisc()
        return probe.press(compose.onNodeWithContentDescription(THE_DISC), holdFor)
    }

    private companion object {
        /** [circleRingRowAccessibilityLabel] of the row's title and its value. */
        const val THE_ROW = "WAKE PHRASE · HEY JARVIS"
        const val THE_DISC = "Show the grid"
    }
}
