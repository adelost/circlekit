package com.adelost.designkit.press

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.down
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.up
import kotlin.math.roundToInt

/**
 * A MOUNTED CONTROL, PRESSED, READ OFF THE GLASS, frame by frame.
 *
 * Written by ettan for row 225 inside two cases; lifted here in row 215 by its second caller, with the
 * two faults a second caller found. It exists because a rule-only case cannot see what a control HANDS
 * its drawing: every such case feeds the number in itself, so the defect that reaches the glass stays
 * green. This one presses the real control and photographs what it draws.
 *
 * TWO THINGS IT PHOTOGRAPHS. [CirclePressReading.changed] is pixels that differ from the same control at
 * rest, which is ettan's reading and the right one for a control whose only consumer of `pressed` is the
 * wait it draws. [CirclePressReading.coloured] is pixels carrying colour rather than grey: a disc, a seat
 * and a step circle all change their CHROME under a finger (fill, contour, tint, scale), and that chrome
 * is greyscale while the cue is the product's accent. Counting changed pixels on those cannot tell a cue
 * from a press highlight; counting coloured ones can.
 */
class CirclePressProbe(
    private val compose: AndroidComposeTestRule<*, ComponentActivity>,
) {

    private var mounted = false

    /**
     * Mounts [content] once. Call it from every press: a control that reads its declaration from state
     * answers for both kinds from ONE composition, and a fresh mount between presses proves nothing.
     */
    fun mount(content: @Composable () -> Unit) {
        if (mounted) return
        compose.mainClock.autoAdvance = false
        compose.setContent(content)
        mounted = true
    }

    /**
     * What [control] draws inside its own bounds with no finger on it, in accent pixels.
     *
     * A reference the product renders itself: a control handed a complete work fraction paints ONE cue
     * at full, which is the same ink a complete press must paint. Comparing a pressed frame with it
     * needs no invented number for "full" and catches a control drawing a second cue beside its own.
     */
    fun colouredAtRest(control: SemanticsNodeInteraction): Int {
        val box = boundsOf(control)
        return settleToRest().colouredInside(box)
    }

    /**
     * Presses [control] for [holdFor] on a clock this probe advances, and reads EVERY frame of it.
     *
     * A single reading can land before a growing arc has covered its first pixel, and a cue that is two
     * frames behind its gate still grows; only the whole sequence says which. The finger is lifted even
     * when a case fails mid-press, or the next press in the same test would measure the last one.
     */
    fun press(control: SemanticsNodeInteraction, holdFor: Long): CirclePress {
        val box = boundsOf(control)
        val atRest = settleToRest()
        val restingInk = atRest.inkInside(box)
        check(restingInk > 0) {
            "the control at rest drew nothing inside its own bounds (${box.joinToString()}), so every " +
                "reading this press takes is a photograph of something else. An ActionBar over a " +
                "control mounted at the top of the window does exactly this and reads 0 for every frame"
        }

        control.performTouchInput { down(center) }
        // A finger on the glass keeps row 215's cue asking for frames, so this composition is never idle
        // while it is down. The clock is advanced deliberately rather than waited on; waitForIdle() here
        // would run it past the gate and photograph a control nobody is touching.
        //
        // ELAPSED IS THE FINGER'S, counted from the down event and including the frame that delivers it.
        // Advancing a frame first and then starting the count from zero put every reading one frame
        // behind the finger, so a cue drawing correctly at 48 ms looked silent there and the frame the
        // gate commits on was read 16 ms after it had already fired.
        val readings = mutableListOf<CirclePressReading>()
        try {
            var elapsed = 0L
            while (elapsed < holdFor) {
                val step = minOf(A_FRAME_MS, holdFor - elapsed)
                compose.mainClock.advanceTimeBy(step)
                elapsed += step
                val now = frame()
                readings += CirclePressReading(
                    elapsedMs = elapsed,
                    changed = now.differingFrom(atRest),
                    coloured = now.colouredInside(box),
                )
            }
        } finally {
            control.performTouchInput { up() }
            compose.mainClock.advanceTimeByFrame()
            settleToRest()
        }
        return CirclePress(
            restingInk = restingInk,
            restingColoured = atRest.colouredInside(box),
            frames = readings,
        )
    }

    private fun boundsOf(control: SemanticsNodeInteraction): IntArray {
        val bounds = control.fetchSemanticsNode().boundsInRoot
        return intArrayOf(
            bounds.left.roundToInt(),
            bounds.top.roundToInt(),
            bounds.right.roundToInt(),
            bounds.bottom.roundToInt(),
        )
    }

    /**
     * Advances frames until the control draws the same thing twice, and returns that frame.
     *
     * Not a fixed settle: a press still animating when the next one starts makes the next reading a
     * reading of the last press. Coming to rest is proven, not assumed.
     */
    private fun settleToRest(): Frame {
        // One frame first, and then THREE identical ones, not two. A declaration written from the test
        // between presses has not reached composition yet when this is called: the frame before it and
        // the frame after it are identical, and two of those are enough to call a control at rest that
        // is about to start animating. Measured 2026-09-20: a wash handed a complete work fraction and
        // then taken away read "at rest" at full, and the press that followed was photographed against
        // it, reading 1603 coloured pixels falling to 179 while the old sweep drained.
        compose.mainClock.advanceTimeByFrame()
        var previous = frame()
        var identical = 1
        repeat(FRAMES_TO_REST) {
            compose.mainClock.advanceTimeByFrame()
            val next = frame()
            identical = if (next.sameAs(previous)) identical + 1 else 1
            if (identical >= FRAMES_AT_REST) return next
            previous = next
        }
        throw AssertionError(
            "the control was still changing after $FRAMES_TO_REST frames, so nothing measured after " +
                "this point is a reading of the press being made",
        )
    }

    /**
     * The pixels the CONTENT VIEW draws right now.
     *
     * Not `captureToImage`: that waits for an idle composition, and a composition with a finger on it is
     * never idle while row 215's cue is asking for frames.
     *
     * And not the DECOR view, which is the fault this lift fixes. A module whose manifest asks for
     * Android 15's edge-to-edge window lays the content out at y=0, under ComponentActivity's own
     * ActionBar, and drawing the decor then photographs 112 px of action bar over the top of the
     * control. Measured 2026-09-20: the identical CircleRingRow read 0 changed pixels for a whole 460 ms
     * press in ringkit and 19 to 400 in designkit, from the window and not from the row. The content
     * view is the same pixels in both, with no action bar in them at all.
     */
    private fun frame(): Frame {
        val view = compose.activity.findViewById<View>(android.R.id.content)
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bitmap))
        val buffer = IntArray(bitmap.width * bitmap.height)
        bitmap.getPixels(buffer, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
        return Frame(buffer, bitmap.width)
    }

    private class Frame(val pixels: IntArray, val width: Int) {

        fun sameAs(other: Frame): Boolean = pixels.contentEquals(other.pixels)

        fun differingFrom(other: Frame): Int {
            require(pixels.size == other.pixels.size) {
                "the two frames are not the same size, so they cannot be compared"
            }
            var changed = 0
            for (index in pixels.indices) if (pixels[index] != other.pixels[index]) changed += 1
            return changed
        }

        fun inkInside(box: IntArray): Int = countInside(box) { it and 0xFFFFFF != 0 }

        fun colouredInside(box: IntArray): Int = countInside(box) { pixel ->
            val red = (pixel shr 16) and 0xFF
            val green = (pixel shr 8) and 0xFF
            val blue = pixel and 0xFF
            maxOf(red, green, blue) - minOf(red, green, blue) >= COLOUR_SPREAD
        }

        private inline fun countInside(box: IntArray, matches: (Int) -> Boolean): Int {
            val height = pixels.size / width
            var count = 0
            for (y in box[1].coerceAtLeast(0) until box[3].coerceAtMost(height)) {
                val row = y * width
                for (x in box[0].coerceAtLeast(0) until box[2].coerceAtMost(width)) {
                    if (matches(pixels[row + x])) count += 1
                }
            }
            return count
        }
    }

    companion object {
        /** One frame at 60 Hz, which is the finest the drawing can be read at. */
        const val A_FRAME_MS = 16L

        /** Mattias's own measurement of a touch, about a millisecond, rounded up to a whole frame. */
        const val A_FLICK_MS = 16L

        /**
         * Well past row 215's 40 ms brush minimum and well short of the 200 ms gate, so a control that
         * is keeping a wait is visibly in the middle of it. Below the brush minimum BOTH kinds draw
         * nothing, by design: a sleeve and a passing thumb are not gestures.
         */
        const val MID_HOLD_MS = 120L

        /** Two seconds of frames: longer than any release this kit animates. */
        private const val FRAMES_TO_REST = 125

        /** How many identical frames in a row count as still. See [settleToRest]. */
        private const val FRAMES_AT_REST = 3

        /**
         * How far apart a pixel's channels must be to be the accent rather than chrome.
         *
         * The kit's press chrome is greyscale (ink, dim, outline, scrim); the cue is the product's own
         * accent. Eight separates them with room to spare and still counts an antialiased edge.
         */
        private const val COLOUR_SPREAD = 8
    }
}

/** One frame of one press. */
class CirclePressReading(val elapsedMs: Long, val changed: Int, val coloured: Int) {
    override fun toString(): String = "$elapsedMs ms: $changed changed, $coloured coloured"
}

/** Every frame of one press, plus what the control looked like without it. */
class CirclePress(
    /** Pixels the control drew inside its own bounds at rest: the floor that proves it was photographed. */
    val restingInk: Int,
    val restingColoured: Int,
    val frames: List<CirclePressReading>,
) {
    /** The most any frame of the press differed from the resting one. 0 means no frame drew a thing. */
    val changedAtItsMost: Int get() = frames.maxOfOrNull { it.changed } ?: 0

    /** The cue's own ink at each frame, with the control's resting colour taken off. */
    val cueByFrame: List<Int> get() = frames.map { (it.coloured - restingColoured).coerceAtLeast(0) }

    val cueAtItsMost: Int get() = cueByFrame.maxOrNull() ?: 0

    /** What the cue was drawing at the frame the gate commits on. */
    val cueAtTheGate: Int get() = cueByFrame.lastOrNull() ?: 0

    override fun toString(): String = "resting ink $restingInk, ${frames.joinToString(" | ")}"
}

/**
 * THE LAW OF ROW 215, stated once and asserted by every gated control that claims to keep it.
 *
 * A control that paints its own cue ([com.adelost.designkit.ui.CirclePressCue.OWNED]) may paint it
 * anywhere it likes, on the ring it already owns or as a wash under its own words. What it may not do
 * is time it: the fraction comes from the gesture, because the gesture is what decides whether the press
 * counts. These two functions are how a control proves it.
 */
object OneCuePerGatedControl {

    /**
     * A sleeve, a graze and a passing thumb put a finger on the glass for a few milliseconds. Nothing
     * is drawn for them, or a wrist flickers all day.
     */
    fun aGrazeSaysNothing(what: String, press: CirclePress) {
        val cue = press.cueByFrame
        val touched = cue.first()
        val grew = cue.maxOrNull() ?: 0
        if (grew > touched) {
            throw AssertionError(
                "$what grew from $touched to $grew pixels during a graze shorter than the " +
                    "${brushMinimumMs()} ms brush minimum. A wrist brushes its own screen all day. " +
                    "Readings: ${cue.joinToString()}",
            )
        }
    }

    /**
     * A held control says how much of its gate has passed, FROM THE FINGER'S OWN ZERO.
     *
     * The frame at [CirclePressProbe.A_FRAME_MS] past the brush minimum is where a cue that measures
     * from its own first frame instead of from the pointer is still silent: two frames pass between the
     * finger landing and the effect's first frame, so its elapsed there is under the brush minimum and
     * it draws nothing. That is the whole of the defect, and it is what this frame catches.
     */
    fun aHeldControlDrawsItsGateOut(what: String, gateMs: Long, press: CirclePress) {
        // WHAT A TOUCH COSTS BEFORE ANY WAIT IS DRAWN. A control may change its chrome the instant a
        // finger lands, and several do: the back ring dips and brightens its contour, and that contour
        // is the product's action colour, so it cannot be told from the cue by colour alone. It is
        // constant from the first frame, though, and a WAIT is not: subtracting the first frame leaves
        // exactly what is growing. Controls with greyscale chrome read 0 here and nothing changes.
        val touched = press.cueByFrame.first()
        val cue = press.cueByFrame.map { it - touched }
        val readings = press.frames.map { it.elapsedMs }.zip(cue).joinToString(" ") { "${it.first}:${it.second}" }
        press.frames.zip(cue).forEach { (frame, drawn) ->
            if (frame.elapsedMs < brushMinimumMs() && drawn != 0) {
                throw AssertionError(
                    "$what drew $drawn pixels of cue ${frame.elapsedMs} ms in, under the " +
                        "${brushMinimumMs()} ms brush minimum, over the $touched it draws merely for " +
                        "being touched. Readings: $readings",
                )
            }
        }
        // WHERE THE CUE MUST BE VISIBLE BY. Not the brush minimum itself: on a long gate the fraction
        // there is a few degrees of arc and rounds to no pixels at all, which is the cue drawing
        // correctly and too small to photograph. A fifth of the gate is past that on every gate this
        // kit declares, and on an ordinary 200 ms one it IS the frame after the brush minimum, which
        // is the frame a cue measuring from its own first frame is still silent at.
        val visibleBy = maxOf(brushMinimumMs(), gateMs / A_FIFTH)
        val firstDrawn = press.frames.indexOfFirst { it.elapsedMs >= visibleBy }
        check(firstDrawn >= 0) { "a press of ${press.frames.size} frames never reached $visibleBy ms" }
        if (cue[firstDrawn] <= 0) {
            throw AssertionError(
                "$what was still silent ${press.frames[firstDrawn].elapsedMs} ms into a $gateMs ms gate. " +
                    "A cue reading its zero off its own first frame rather than off the pointer is " +
                    "exactly this much late, and a ring that starts two frames behind can never " +
                    "complete. Readings: $readings",
            )
        }
        for (index in (firstDrawn + 1) until cue.size) {
            if (cue[index] < cue[index - 1]) {
                throw AssertionError(
                    "$what drew less cue at ${press.frames[index].elapsedMs} ms than at " +
                        "${press.frames[index - 1].elapsedMs} ms, so the wait is not running out. " +
                        "Readings: $readings",
                )
            }
        }
        val atTheGate = cue.last()
        if (atTheGate < cue[firstDrawn] * GROWN_BY_THE_GATE) {
            throw AssertionError(
                "$what drew $atTheGate pixels of cue at the frame its $gateMs ms gate commits " +
                    "on, against ${cue[firstDrawn]} at the first frame it drew anything. A cue that " +
                    "barely moves across a gate is not saying how much of it is left. Readings: $readings",
            )
        }
        if (atTheGate < (cue.maxOrNull() ?: 0)) {
            throw AssertionError(
                "$what drew its most cue (${cue.maxOrNull()}) before the frame its gate commits on " +
                    "($atTheGate), so the ring was fullest while the action had not fired. " +
                    "Readings: $readings",
            )
        }
    }

    private fun brushMinimumMs(): Long = com.adelost.designkit.ui.CIRCLE_CUE_BRUSH_MIN_MS

    /**
     * How much more cue a complete gate draws than its first visible frame.
     *
     * The first drawn frame is one frame past the brush minimum, about a quarter of an ordinary gate;
     * a complete one is all of it. Two is a floor with room for a round cap and an antialiased edge.
     */
    private const val GROWN_BY_THE_GATE = 2

    /** See [aHeldControlDrawsItsGateOut]: how much of a gate has to pass before a cue has pixels. */
    private const val A_FIFTH = 5
}
