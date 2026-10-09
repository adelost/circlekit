package com.adelost.designkit.ui

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import androidx.core.view.drawToBitmap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Mattias 2026-10-09, on SETTINGS beside SYSTEM: "det känns som att cirklarna har helt annorlunda storlekar ... Det
 * ska ju vara konsekvent". Every circle was already one diameter; the escape at the top drew a full 1 dp border in a
 * brighter grey, 5 px against an icon ring's 3 px at his 320 dp preview. So the escape and a resting icon ring are
 * drawn side by side and their rings are read on the same row of pixels.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xxxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TheEscapeRingIsAnIconRingTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `the escape ring is as thick and as bright as a resting icon ring`() {
        compose.setContent {
            Column(Modifier.fillMaxSize().background(Color.Black)) {
                CircleBackDisc(
                    enabled = true, pressed = false, holdProgress = { 0f }, scrim = false,
                    diameter = MenuDesign.watchActionRingDiameter, contentDescription = null,
                    modifier = Modifier.testTag(ESCAPE),
                )
                Spacer(Modifier.height(8.dp))
                Box(
                    Modifier.testTag(ICON).size(MenuDesign.watchActionRingDiameter).clip(CircleShape)
                        .circleRingContour(MenuDesign.ringNeutral),
                )
            }
        }
        compose.waitForIdle()
        val window = compose.activity.window.decorView.drawToBitmap(Bitmap.Config.ARGB_8888)
        val escape = ringProfile(window, ESCAPE)
        val icon = ringProfile(window, ICON)
        assertTrue("an icon ring draws something: $icon", icon.lit > 0)
        assertEquals("lit pixels across the ring, escape $escape against icon $icon", icon.lit, escape.lit)
        assertTrue("the ring's brightest pixel, escape $escape against icon $icon", abs(icon.peak - escape.peak) <= 4)
    }

    private data class RingProfile(val lit: Int, val peak: Int)

    /** The ring where it crosses the row through the circle's centre, from its left edge inwards. */
    private fun ringProfile(window: Bitmap, tag: String): RingProfile {
        val bounds = compose.onNodeWithTag(tag).fetchSemanticsNode().boundsInWindow
        val y = bounds.center.y.roundToInt()
        val ring = (bounds.left.roundToInt() until bounds.center.x.roundToInt())
            .map { x -> brightness(window.getPixel(x, y)) }
            .dropWhile { it <= DARK }
            .takeWhile { it > DARK }
        return RingProfile(lit = ring.size, peak = ring.maxOrNull() ?: 0)
    }

    private fun brightness(argb: Int): Int = maxOf((argb shr 16) and 0xFF, (argb shr 8) and 0xFF, argb and 0xFF)

    private companion object {
        const val ESCAPE = "escape"
        const val ICON = "icon"
        const val DARK = 6
    }
}
