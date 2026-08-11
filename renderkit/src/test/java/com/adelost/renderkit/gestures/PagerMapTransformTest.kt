package com.adelost.renderkit.gestures

import org.junit.Assert.assertEquals
import org.junit.Test

class PagerMapTransformTest {
    @Test
    fun `one finger orbits only after horizontal touch slop`() {
        assertEquals(
            PagerMapMotionIntent.NONE,
            pagerMapMotionIntent(1, orbitEnabled = true, horizontalTravelPx = 7f, touchSlopPx = 8f),
        )
        assertEquals(
            PagerMapMotionIntent.ORBIT,
            pagerMapMotionIntent(1, orbitEnabled = true, horizontalTravelPx = -9f, touchSlopPx = 8f),
        )
        assertEquals(
            PagerMapMotionIntent.NONE,
            pagerMapMotionIntent(1, orbitEnabled = false, horizontalTravelPx = 20f, touchSlopPx = 8f),
        )
    }

    @Test
    fun `two fingers always own pan and pinch`() {
        assertEquals(
            PagerMapMotionIntent.PAN_ZOOM,
            pagerMapMotionIntent(2, orbitEnabled = false, horizontalTravelPx = 0f, touchSlopPx = 8f),
        )
        assertEquals(
            PagerMapMotionIntent.PAN_ZOOM,
            pagerMapMotionIntent(3, orbitEnabled = true, horizontalTravelPx = 40f, touchSlopPx = 8f),
        )
    }
}
