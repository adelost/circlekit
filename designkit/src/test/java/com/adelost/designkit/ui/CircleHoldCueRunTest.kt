package com.adelost.designkit.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.runtime.BroadcastFrameClock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * THE LOOP ITSELF, driven on a frame clock this case owns.
 *
 * [CircleHoldCueTest] holds the RULE, circleHoldCueFraction, and that function was never the bug. The bug
 * was which moment the loop calls zero: reading it off the loop's own first frame put the ring two frames
 * behind, so it started at 0.24 instead of 0.2 and froze at 0.88 when the gate fired. lsrc:0 put that back
 * as a one-line mutation of runCircleHoldCue and every case in this package stayed green (2026-09-20),
 * because a case that calls the rule twice cannot see which number the loop hands it. So this one drives
 * the loop and reads what it writes, frame by frame.
 *
 * The two frames are not slack in the loop; they are the press reaching composition. That is why the zero
 * has to come from the pointer and not from the first frame the effect happens to see.
 */
class CircleHoldCueRunTest {

    @Test
    fun `the cue measures from the finger, not from the loop's own first frame`() {
        val gate = MenuDesign.wornTouchCostMs
        // The finger lands at 0 and the loop's first frame is two frames later, which is what a press
        // reaching composition costs at 60 Hz.
        val frames = buildList {
            var at = FIRST_FRAME_MS
            while (at < gate) { add(at); at += FRAME_MS }
            add(gate)
        }
        val read = driveTheCue(pressedAtMs = 0L, holdMs = gate, frames = frames)
        println("hold cue from the finger's zero: ${frames.zip(read)}")

        val lastUnderGate = frames.indexOf(gate) - 1
        assertEquals(
            "at ${frames[lastUnderGate]} ms of a $gate ms gate the ring reads ${read[lastUnderGate]}. " +
                "From the finger's own zero it is ${frames[lastUnderGate].toFloat() / gate}; the loop is " +
                "measuring from its own first frame, which is ${FIRST_FRAME_MS} ms late and can never " +
                "complete",
            frames[lastUnderGate].toFloat() / gate,
            read[lastUnderGate],
            0.0001f,
        )
        assertEquals(
            "the ring reads ${read.last()} at the frame the gate commits on. A ring that is short at the " +
                "moment the action fires teaches the wearer that a full ring is not what acting looks like",
            1f,
            read.last(),
            0f,
        )
        assertEquals(
            "the brush minimum moved: the frame at ${frames.first()} ms is under " +
                "$CIRCLE_CUE_BRUSH_MIN_MS ms of finger and must draw nothing",
            0f,
            read.first(),
            0f,
        )
    }

    @Test
    fun `two clocks that are not the same one give a late cue, never a full one`() {
        // pressedAtMs is the down event's uptime and the frames come from the frame clock. On Android both
        // are CLOCK_MONOTONIC, which is a platform detail rather than a promise. If they ever have
        // different origins the difference is arbitrary, and the dangerous direction is a ring that is
        // ALREADY FULL under a finger that just landed: it would say the gate is done when it has not
        // started. The loop falls back to the frame it can trust instead.
        val gate = MenuDesign.wornTouchCostMs
        val strayFirstFrame = gate + 500L
        val frames = listOf(strayFirstFrame, strayFirstFrame + 48L, strayFirstFrame + gate)
        val read = driveTheCue(pressedAtMs = 0L, holdMs = gate, frames = frames)
        println("hold cue with two clocks: ${frames.zip(read)}")

        assertTrue(
            "the ring was already at ${read.first()} on the first frame under the finger, so a press that " +
                "has just started looks finished",
            read.first() < 1f,
        )
        assertEquals(
            "having fallen back to the frame clock, the cue must then run the gate from THAT frame",
            48f / gate,
            read[1],
            0.0001f,
        )
        assertEquals("and still complete one gate later", 1f, read.last(), 0f)
    }

    // ---- the fixture -----------------------------------------------------------------------------------

    /**
     * Runs [runCircleHoldCue] against a frame clock this case owns, and reads the cue after each frame.
     *
     * Nothing here is a test double of the thing under test: the Animatable, the loop and the frame clock
     * are the production ones, and only WHEN a frame arrives is decided here. [pump] waits until the loop
     * is actually asking for its next frame before sending one, so a reading is never taken from a loop
     * that has not processed the frame before it.
     */
    private fun driveTheCue(pressedAtMs: Long, holdMs: Long, frames: List<Long>): List<Float> = runBlocking {
        val clock = BroadcastFrameClock()
        val hold = Animatable(0f)
        val job = launch(clock) { runCircleHoldCue(hold, pressed = true, timing = CircleResolvedTiming(holdMs), pressedAtMs = pressedAtMs) }
        val read = mutableListOf<Float>()
        for (frameMs in frames) {
            pump(clock, job)
            clock.sendFrame(frameMs * 1_000_000L)
            pump(clock, job)
            read += hold.value
        }
        job.cancel()
        read
    }

    /** Lets the loop run until it is waiting for its next frame, or has finished. */
    private suspend fun CoroutineScope.pump(clock: BroadcastFrameClock, job: Job) {
        var spins = 0
        while (!clock.hasAwaiters && job.isActive && spins < MAX_SPINS) {
            yield()
            spins++
        }
    }

    private companion object {
        const val FRAME_MS = 16L

        /** Two frames: what a press costs to reach composition, and what froze the ring at 0.88. */
        const val FIRST_FRAME_MS = 32L
        const val MAX_SPINS = 200
    }
}
