package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleHostMode
import com.adelost.designkit.ui.CircleHostOrientation
import com.adelost.designkit.ui.CircleHostPreviewState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class CircleHostPreviewScreenTest {
    @Test
    fun `phone offers exactly responsive and watch exact plus shared orientation`() = runBlocking {
        val state = MutableStateFlow(CircleHostPreviewState())
        val screen = circleHostPreviewScreen(
            CircleHostPreviewPort(
                isWatchDevice = false,
                state = state,
                systemOrientationAllowed = true,
                onMode = {},
                onDiameter = {},
                onOrientation = {},
            ),
        )
        val rows = screen.items.first()

        assertEquals(listOf("RESPONSIVE", "WATCH EXACT"), rows.first { it.key == "host-mode" }.choices)
        assertEquals(listOf("SYSTEM", "0°", "90°", "180°", "270°"), rows.first { it.key == "orientation" }.choices)
    }

    @Test
    fun `wear exposes no meaningless host or orientation choice`() = runBlocking {
        val screen = circleHostPreviewScreen(
            CircleHostPreviewPort(
                isWatchDevice = true,
                state = MutableStateFlow(CircleHostPreviewState(mode = CircleHostMode.RESPONSIVE)),
                systemOrientationAllowed = true,
                onMode = {},
                onDiameter = {},
                onOrientation = {},
            ),
        )
        val rows = screen.items.first()

        assertFalse(rows.any { it.key == "host-mode" || it.key == "orientation" })
        assertEquals("ROUND · WATCH EXACT", rows.single().sub)
    }

    @Test
    fun `watch size selection always matches a declared choice`() = runBlocking {
        val screen = circleHostPreviewScreen(
            CircleHostPreviewPort(
                isWatchDevice = false,
                state = MutableStateFlow(
                    CircleHostPreviewState(
                        mode = CircleHostMode.WATCH_EXACT,
                        watchDiameterDp = 216f,
                    ),
                ),
                systemOrientationAllowed = true,
                onMode = {},
                onDiameter = {},
                onOrientation = {},
            ),
        )

        val sizeRow = screen.items.first().single { it.key == "watch-diameter" }

        assertEquals("216", sizeRow.sub)
        assertEquals(true, sizeRow.sub in sizeRow.choices)
    }
}
