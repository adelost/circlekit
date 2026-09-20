package com.adelost.ringkit.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.down
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.up
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * THE CONTROL MATTIAS PRESSED, mounted. Row 225.
 *
 * SETTINGS · WAKE PHRASE in Link is a [RingChoiceRow] with role STEPPED, and a choice row carries
 * [DELIBERATE_CHANGE_HOLD_MS] whatever kind it is declared to be. Measured on Link 1.2.23 on a
 * phone: presses of 1, 16, 50, 120 and 300 ms all switched the phrase, while the arc around the
 * row's icon filled over about half a second (152 px of ink at 100 ms, 454 at 250, 683 at 450).
 *
 * So the case drives this exact control, both kinds, and reads what committed and what was drawn.
 * Under lsrc:0's rule the WAKE PHRASE row is a TOUCH: the next press takes the phrase back, so it
 * commits at once AND draws nothing, and the two halves have to say that together.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TheWakePhraseRowObeysItsDeclarationTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `declared a touch, the wake phrase row switches on a flick and draws no wait`() {
        val flicked = press(CircleActionTiming.IMMEDIATE, holdFor = A_FLICK)

        assertTrue("a touch of $A_FLICK ms did not change the phrase", flicked.switched)
        assertEquals(
            "the row drew a wait while switching anyway, which is the bug Mattias reported: " +
                "\"även om progress baren inte fylls så tar den ändå och byter knapp\"",
            0,
            flicked.pixelsChangedWhileDown,
        )
    }

    @Test
    fun `declared a hold, the same row refuses every press shorter than the hold it declared`() {
        assertTrue(
            "a flick changed a phrase the row said it would hold for",
            !press(CircleActionTiming.DELIBERATE, holdFor = A_FLICK).switched,
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

    private class Press(val switched: Boolean, val pixelsChangedWhileDown: Int)

    private var selected = PHRASES.first()
    private val declaredTiming = mutableStateOf(CircleActionTiming.DELIBERATE)
    private var mounted = false

    private fun press(timing: CircleActionTiming, holdFor: Long): Press {
        declaredTiming.value = timing
        if (!mounted) {
            compose.mainClock.autoAdvance = false
            compose.setContent {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    RingChoiceRow(
                        title = "WAKE PHRASE",
                        selected = selected,
                        options = PHRASES,
                        role = CircleChoiceRole.STEPPED,
                        icon = RingIcons.Grid,
                        actionTiming = declaredTiming.value,
                        onSelect = { chosen -> selected = chosen },
                    )
                }
            }
            mounted = true
        }
        val before = selected
        compose.mainClock.advanceTimeBy(SETTLE_MS)
        val atRest = frame()

        val control = compose.onNodeWithContentDescription(SPOKEN_NAME, substring = true)
        control.performTouchInput { down(center) }
        // A finger on the glass keeps row 215's cue asking for frames, so nothing here waits for an
        // idle composition: every frame of the press is advanced and read deliberately.
        compose.mainClock.advanceTimeByFrame()
        var drawnAtItsMost = 0
        var elapsed = 0L
        while (elapsed < holdFor) {
            val step = minOf(A_FRAME, holdFor - elapsed)
            compose.mainClock.advanceTimeBy(step)
            elapsed += step
            drawnAtItsMost = maxOf(drawnAtItsMost, differingPixels(atRest, frame()))
        }
        control.performTouchInput { up() }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(SETTLE_MS)

        return Press(switched = selected != before, pixelsChangedWhileDown = drawnAtItsMost)
    }

    /** The pixels drawn right now: `captureToImage` waits for an idle composition, which a pressed control never is. */
    private fun frame(): IntArray {
        val view = compose.activity.window.decorView
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bitmap))
        val buffer = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(buffer, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        return buffer
    }

    private fun differingPixels(before: IntArray, after: IntArray): Int {
        assertEquals("the two frames are not the same size, so they cannot be compared", before.size, after.size)
        var changed = 0
        for (index in before.indices) if (before[index] != after[index]) changed += 1
        return changed
    }

    private companion object {
        val PHRASES = listOf("HEY JARVIS", "HEY MARVIN", "ALEXA")
        const val SPOKEN_NAME = "WAKE PHRASE"
        /** Mattias's own measurement, rounded up to a whole frame. */
        const val A_FLICK = 16L
            const val A_FRAME = 16L
        const val SETTLE_MS = 2_000L
    }
}
