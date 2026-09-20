package com.adelost.designkit.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.down
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.up
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * A MOUNTED control, pressed, read off the glass. Row 225.
 *
 * [ThePressAndTheWaitAgreeTest] states the rule and proves the resolver. It cannot see the thing the
 * bug actually was: that the row HANDS the drawing a different number than it hands its gate. Every
 * case there feeds the value in itself, so putting `pressHoldMs = actionHoldMs` back, which IS the
 * defect Mattias pressed, leaves it green (lsrc:0, 2026-09-20). So this one presses the control and
 * reads two things off the result: what committed, and whether anything was drawn while the finger
 * was down.
 *
 * WHAT COUNTS AS "A WAIT WAS DRAWN": the pressed frame differs from the resting frame of the SAME
 * control. The row's only consumer of `pressed` is the wait it draws, so a difference is that wait
 * and nothing else. The reference is the control without the press rather than a second control,
 * because a frame compared with itself cannot say what changed it.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ThePressAndTheWaitAgreeOnAControlTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `an immediate control commits the shortest press and draws no wait at all`() {
        val pressed = press(CircleActionTiming.IMMEDIATE, holdFor = A_FLICK)

        assertTrue("the shortest press a finger can make did not commit", pressed.committed)
        assertEquals(
            "an immediate control drew something while the finger was down: a wait that is already " +
                "over is the in-between Mattias refused",
            0,
            pressed.pixelsChangedWhileDown,
        )
    }

    @Test
    fun `a deliberate control refuses a short press and draws the wait it does keep`() {
        val flicked = press(CircleActionTiming.DELIBERATE, holdFor = A_FLICK)
        assertTrue(
            "a press of $A_FLICK ms committed against a ${MenuDesign.tapHoldMs} ms wait, which is the " +
                "row 225 defect on a deliberate control",
            !flicked.committed,
        )

        val held = press(CircleActionTiming.DELIBERATE, holdFor = MID_HOLD_MS)
        assertTrue(
            "a deliberate control drew nothing $MID_HOLD_MS ms into its own hold, so the wait it is " +
                "keeping is invisible to the finger keeping it",
            held.pixelsChangedWhileDown > 0,
        )
        assertTrue("the gate committed before its wait was out", !held.committed)

        val waitedOut = press(CircleActionTiming.DELIBERATE, holdFor = MenuDesign.tapHoldMs)
        assertTrue("a press that waited the whole wait out did not commit", waitedOut.committed)
    }

    @Test
    fun `the same press on the two kinds, one drawing a wait and the other unable to`() {
        // The pair, which is the whole rule in one case: the identical gesture, held the identical
        // time, on the two kinds of control. What separates them is what each one PROMISED, so the
        // deliberate one must be drawing its wait at the same moment the immediate one draws nothing.
        val deliberate = press(CircleActionTiming.DELIBERATE, holdFor = MID_HOLD_MS)
        val immediate = press(CircleActionTiming.IMMEDIATE, holdFor = MID_HOLD_MS)

        assertTrue(
            "a $MID_HOLD_MS ms press drew nothing on the control that was making it wait",
            deliberate.pixelsChangedWhileDown > 0,
        )
        assertEquals(
            "the same $MID_HOLD_MS ms press drew a wait on a control that was not making it wait: " +
                "${immediate.pixelsChangedWhileDown} pixels of a gesture nobody is being asked for",
            0,
            immediate.pixelsChangedWhileDown,
        )
    }

    @Test
    fun `the row hands its gate and its drawing the same declaration`() {
        // The hand-over itself, which is what a rule-only case cannot see. A row carrying a hold that
        // its declared kind does not keep must not draw that hold either: the number reaching the
        // glass is the number the gate is keeping, or the row is lying about the gesture it wants.
        val immediateCarryingAHold = press(
            CircleActionTiming.IMMEDIATE,
            holdFor = MID_HOLD_MS,
            holdMs = MenuDesign.holdDeliberateMs,
        )

        assertTrue(
            "a control declared immediate did not commit, so the hold riding along reached its gate",
            immediateCarryingAHold.committed,
        )
        assertEquals(
            "the hold riding along reached the drawing: the row drew a wait its own gate was not " +
                "keeping, which is exactly what the WAKE PHRASE row did on the phone",
            0,
            immediateCarryingAHold.pixelsChangedWhileDown,
        )
    }

    @Test
    fun `the cue reads the same declaration as the gate and the drawing`() {
        // THE THIRD READER. The centre cue is the one an overlay host draws, so it is read here off
        // the events the control publishes rather than off pixels. An immediate control has no wait
        // to report and must ask for none, whatever hold rides along with it.
        val immediateCarryingAHold = press(
            CircleActionTiming.IMMEDIATE,
            holdFor = MID_HOLD_MS,
            holdMs = MenuDesign.holdDeliberateMs,
        )
        assertEquals(
            "an immediate control asked the centre overlay to sweep, so a third surface was promising " +
                "a gesture its own gate does not want",
            0f,
            immediateCarryingAHold.cueSweptTo,
            0f,
        )

        val deliberate = press(CircleActionTiming.DELIBERATE, holdFor = MenuDesign.tapHoldMs)
        assertTrue(
            "a deliberate control's cue never swept, so the overlay says nothing while the row waits",
            deliberate.cueSweptTo > 0f,
        )
    }

    private class Press(
        val committed: Boolean,
        val pixelsChangedWhileDown: Int,
        /** The furthest the centre cue was ever asked to sweep during this press. */
        val cueSweptTo: Float,
    )

    /**
     * Mounts one row, presses it for [holdFor] on a clock this test advances, and reports both
     * answers. [holdMs] is the duration the row carries, which a caller may set independently of the
     * kind precisely so that disagreeing with it can be caught.
     */
    private var taps = 0
    private val cues = mutableListOf<CircleActionCueEvent>()
    private val declaredTiming = mutableStateOf(CircleActionTiming.DELIBERATE)
    private val declaredHoldMs = mutableStateOf(CircleActionTiming.DELIBERATE.holdMs)
    private var mounted = false

    private fun press(
        timing: CircleActionTiming,
        holdFor: Long,
        holdMs: Long = timing.holdMs,
    ): Press {
        // One composition per test, re-declared between presses: the row reads its kind from state,
        // so the same mounted control answers for both kinds and nothing is proven by a fresh mount.
        declaredTiming.value = timing
        declaredHoldMs.value = holdMs
        if (!mounted) {
            compose.mainClock.autoAdvance = false
            compose.setContent {
                CompositionLocalProvider(
                    LocalCircleActionCuePublisher provides { event -> cues += event },
                ) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    CircleRingRow(
                        title = "WAKE PHRASE",
                        sub = "HEY JARVIS",
                        icon = RingIcons.Grid,
                        onTap = { taps += 1 },
                        actionTiming = declaredTiming.value,
                        actionHoldMs = declaredHoldMs.value,
                    )
                }
                }
            }
            mounted = true
        }
        taps = 0
        cues.clear()
        compose.mainClock.advanceTimeBy(SETTLE_MS)
        val atRest = frame()

        val control = compose.onNodeWithContentDescription(SPOKEN_NAME)
        control.performTouchInput { down(center) }
        // A finger on the glass keeps row 215's cue asking for frames, so this composition is never
        // idle while it is down. The clock is therefore advanced deliberately rather than waited on:
        // one frame delivers the event, then exactly the press being measured.
        compose.mainClock.advanceTimeByFrame()

        // READ EVERY FRAME OF THE PRESS, not one instant of it. A wait that is drawn is drawn while
        // the finger is down, and a single reading can land before a growing arc has covered its
        // first pixel: this same case reported 0 at 120 ms for a row that was at 77 pixels, because
        // the frames between were never drawn. The most any frame differs from the resting one is
        // therefore the answer to "was a wait drawn", and 0 means no frame of the press drew one.
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

        return Press(
            committed = taps > 0,
            pixelsChangedWhileDown = drawnAtItsMost,
            cueSweptTo = cues.mapNotNull { it.cue?.progress }.maxOrNull() ?: 0f,
        )
    }

    /**
     * The pixels the view hierarchy actually draws right now.
     *
     * Not `captureToImage`: that waits for an idle composition, and a composition with a finger on it
     * is never idle, because row 215's cue asks for a frame for as long as the press lasts. Drawing
     * the decor view is the same pixels without the wait, which is the only way to photograph a
     * control mid-press.
     */
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
        /** What the row calls itself: [circleRingRowAccessibilityLabel] of its title and its value. */
        const val SPOKEN_NAME = "WAKE PHRASE · HEY JARVIS"

        /** Mattias's own measurement: a touch of about a millisecond, rounded up to a whole frame. */
        const val A_FLICK = 16L

        /**
         * Well past row 215's 40 ms brush minimum and well short of the 200 ms gate, so a control
         * that is keeping a wait is visibly in the middle of it. Below the brush minimum BOTH kinds
         * draw nothing, by design: a sleeve and a passing thumb are not gestures.
         */
        const val MID_HOLD_MS = 120L

        /** One frame at 60 Hz, which is the finest the drawing can be read at. */
        const val A_FRAME = 16L
        const val SETTLE_MS = 2_000L
    }
}
