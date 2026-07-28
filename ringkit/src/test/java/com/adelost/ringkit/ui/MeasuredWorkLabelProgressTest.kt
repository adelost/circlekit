package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import com.adelost.ringkit.data.Progress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MeasuredWorkLabelProgressTest {
    @Test
    fun `idle refresh has no progress and unknown work is indeterminate`() {
        assertNull(measuredWorkLabelProgress(progress = Progress(2, 4), inFlight = false))
        assertEquals(
            CircleLabelProgress.Indeterminate,
            measuredWorkLabelProgress(progress = null, inFlight = true),
        )
    }

    @Test
    fun `measured refresh is clamped and rendered by the label`() {
        assertEquals(
            CircleLabelProgress.Determinate(0.5f),
            measuredWorkLabelProgress(progress = Progress(2, 4), inFlight = true),
        )
        assertEquals(
            CircleLabelProgress.Determinate(1f),
            measuredWorkLabelProgress(progress = Progress(8, 4), inFlight = true),
        )
    }
}
