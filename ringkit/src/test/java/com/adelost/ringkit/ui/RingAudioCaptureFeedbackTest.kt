package com.adelost.ringkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class RingAudioCaptureFeedbackTest {
    @Test
    fun durationIsStableBeyondOneMinute() {
        assertEquals("0:00", formatCaptureDuration(0))
        assertEquals("1:05", formatCaptureDuration(65_999))
    }

    @Test
    fun invalidMeterDataFailsAtTheAtomBoundary() {
        assertThrows(IllegalArgumentException::class.java) {
            RingAudioCaptureFeedbackSpec(0, listOf(-0.1f), active = true)
        }
    }
}
