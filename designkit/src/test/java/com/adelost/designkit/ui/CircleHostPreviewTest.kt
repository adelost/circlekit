package com.adelost.designkit.ui

import android.content.pm.ActivityInfo
import org.junit.Assert.assertEquals
import org.junit.Test

class CircleHostPreviewTest {
    @Test
    fun `responsive capacity derives only from actual bounds`() {
        val portrait = resolveCircleSurfaceLayout(411f, 891f, round = false)
        val landscape = resolveCircleSurfaceLayout(891f, 411f, round = false)

        assertEquals(CircleSurfaceClass.PHONE_COMPACT, portrait.surfaceClass)
        assertEquals(CircleSurfaceClass.PHONE_WIDE, landscape.surfaceClass)
    }

    @Test
    fun `wear ignores every requested or persisted phone mode`() {
        CircleHostMode.entries.forEach { persisted ->
            listOf(null, "responsive", "watch_exact").forEach { requested ->
                assertEquals(
                    CircleHostMode.WATCH_EXACT,
                    resolveCircleHostMode(true, requested, persisted),
                )
            }
        }
    }

    @Test
    fun `round viewport stays round at every orientation`() {
        CircleHostOrientation.entries.forEach {
            assertEquals(
                CircleSurfaceClass.ROUND,
                resolveCircleSurfaceLayout(400f, 400f, round = true).surfaceClass,
            )
        }
    }

    @Test
    fun `diameter presets and activity orientations are closed`() {
        assertEquals(
            listOf(192f, 216f, 240f, 280f, 320f, 360f, 400f),
            CIRCLE_WATCH_PREVIEW_DIAMETERS_DP,
        )
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR, requestedOrientationFor(CircleHostOrientation.SYSTEM))
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT, requestedOrientationFor(CircleHostOrientation.DEG_0))
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE, requestedOrientationFor(CircleHostOrientation.DEG_90))
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT, requestedOrientationFor(CircleHostOrientation.DEG_180))
        assertEquals(ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE, requestedOrientationFor(CircleHostOrientation.DEG_270))
    }
}
