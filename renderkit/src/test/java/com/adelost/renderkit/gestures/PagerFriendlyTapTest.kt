package com.adelost.renderkit.gestures

import org.junit.Assert.assertEquals
import org.junit.Test

class PagerFriendlyTapTest {
    @Test
    fun `slow pager drag never becomes a long press`() {
        assertEquals(
            PagerTapSampleDisposition.CANCEL,
            pagerTapSampleDisposition(
                distancePx = 42f,
                pressed = true,
                consumed = false,
                touchSlop = 12f,
            ),
        )
    }

    @Test
    fun `stationary press waits and stationary release taps`() {
        assertEquals(
            PagerTapSampleDisposition.WAIT,
            pagerTapSampleDisposition(
                distancePx = 2f,
                pressed = true,
                consumed = false,
                touchSlop = 12f,
            ),
        )
        assertEquals(
            PagerTapSampleDisposition.UP,
            pagerTapSampleDisposition(
                distancePx = 2f,
                pressed = false,
                consumed = false,
                touchSlop = 12f,
            ),
        )
    }
}
