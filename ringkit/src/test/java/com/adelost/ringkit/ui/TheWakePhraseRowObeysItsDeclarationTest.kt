package com.adelost.ringkit.ui

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
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.circleResolvedTiming
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * THE CONTROL MATTIAS PRESSED, mounted. Row 225, on [CirclePressProbe] since row 215.
 *
 * SETTINGS · WAKE PHRASE in Link is a [RingChoiceRow] with role STEPPED, and a choice row carries
 * [DELIBERATE_CHANGE_HOLD_MS] whatever kind it is declared to be. Measured on Link 1.2.23 on a
 * phone: presses of 1, 16, 50, 120 and 300 ms all switched the phrase, while the arc around the
 * row's icon filled over about half a second (152 px of ink at 100 ms, 454 at 250, 683 at 450).
 *
 * So the case drives this exact control, both kinds, and reads what committed and what was drawn.
 * Under lsrc:0's rule the WAKE PHRASE row is a TOUCH: the next press takes the phrase back, so it
 * commits at once AND draws nothing, and the two halves have to say that together.
 *
 * ITS PIXEL READINGS WERE NOT REAL UNTIL ROW 215. Drawing the DECOR view photographed 112 px of
 * ComponentActivity's own ActionBar laid over a control mounted at the top of an edge-to-edge window,
 * and every frame of every press read 0 changed pixels: this row and a plain CircleRingRow and a
 * 40 dp white square all read 0, in the same module, while designkit read 19 to 400 for the same row.
 * [CirclePressProbe] photographs the content view instead and refuses a control that drew no ink of
 * its own, so a reading of nothing fails loudly rather than passing as a zero.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TheWakePhraseRowObeysItsDeclarationTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `declared a touch, the wake phrase row switches on a flick and draws no wait`() {
        val flicked = press(CircleActionTiming.IMMEDIATE, holdFor = CirclePressProbe.A_FLICK_MS)

        assertTrue("a touch of ${CirclePressProbe.A_FLICK_MS} ms did not change the phrase", flicked.switched)
        assertEquals(
            "the row drew a wait while switching anyway, which is the bug Mattias reported: " +
                "\"även om progress baren inte fylls så tar den ändå och byter knapp\"",
            0,
            flicked.press.changedAtItsMost,
        )
    }

    @Test
    fun `declared a hold, the same row refuses every press shorter than the hold it declared`() {
        assertTrue(
            "a flick changed a phrase the row said it would hold for",
            !press(CircleActionTiming.DELIBERATE, holdFor = CirclePressProbe.A_FLICK_MS).switched,
        )
        assertTrue(
            "a press of half the declared hold changed the phrase",
            !press(CircleActionTiming.DELIBERATE, holdFor = DELIBERATE_CHANGE_HOLD_MS / 2).switched,
        )
        assertTrue(
            "a press that waited out the whole declared hold did not change the phrase",
            press(CircleActionTiming.DELIBERATE, holdFor = DELIBERATE_CHANGE_HOLD_MS).switched,
        )
    }

    @Test
    fun `declared a hold, the row draws the half second it is keeping`() {
        // The half ettan's original could not see, and the measurement lsrc:0 sent me to explain: a
        // DELIBERATE choice row through RingRow was recorded drawing 0 pixels across a whole 460 ms
        // press while designkit's CircleRingRow drew 111. That 0 was the ActionBar, not the row.
        val held = press(CircleActionTiming.DELIBERATE, holdFor = DELIBERATE_CHANGE_HOLD_MS)

        assertTrue(
            "the row drew nothing across its own ${DELIBERATE_CHANGE_HOLD_MS} ms hold, so the wearer " +
                "is told nothing while the phrase is being changed",
            held.press.changedAtItsMost > 0,
        )
        val cue = held.press.cueByFrame
        assertTrue(
            "the cue never grew: it read ${cue.joinToString()} across the hold, so whatever is being " +
                "drawn is not a wait running out",
            cue.last() > cue[cue.size / 2] && cue[cue.size / 2] > cue.first(),
        )
    }

    private class Press(val switched: Boolean, val press: CirclePress)

    private val probe = CirclePressProbe(compose)
    private var selected = PHRASES.first()
    private val declaredTiming = mutableStateOf(CircleActionTiming.DELIBERATE)

    private fun press(timing: CircleActionTiming, holdFor: Long): Press {
        declaredTiming.value = timing
        probe.mount {
            Box(Modifier.fillMaxSize().background(Color.Black)) {
                RingChoiceRow(
                    title = "WAKE PHRASE",
                    selected = selected,
                    options = PHRASES,
                    role = CircleChoiceRole.STEPPED,
                    icon = RingIcons.Grid,
                    timing = circleResolvedTiming(
                        declaredTiming.value,
                        DELIBERATE_CHANGE_HOLD_MS,
                    ),
                    onSelect = { chosen -> selected = chosen },
                )
            }
        }
        val before = selected
        val reading = probe.press(
            compose.onNodeWithContentDescription(SPOKEN_NAME, substring = true),
            holdFor,
        )
        return Press(switched = selected != before, press = reading)
    }

    private companion object {
        val PHRASES = listOf("HEY JARVIS", "HEY MARVIN", "ALEXA")
        const val SPOKEN_NAME = "WAKE PHRASE"
    }
}
