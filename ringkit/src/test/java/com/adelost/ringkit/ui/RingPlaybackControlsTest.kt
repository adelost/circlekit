package com.adelost.ringkit.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class RingPlaybackControlsTest {
    @Test
    fun `time label is honest before duration resolves`() {
        assertEquals("0:03", playbackTimeLabel(3_400L, 0L))
    }

    @Test
    fun `time label and progress clamp at real duration`() {
        assertEquals("1:02 / 2:05", playbackTimeLabel(62_000L, 125_000L))
        assertEquals(1f, playbackProgressFraction(130_000L, 125_000L))
    }

    @Test
    fun `playback state remains visible beside time truth`() {
        assertEquals(
            "FAILED · 0:12 / 1:23",
            playbackStatusLabel(RingPlaybackState.FAILED, 12_000L, 83_000L),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `negative position is refused`() {
        playbackProgressFraction(-1L, 10L)
    }
}
