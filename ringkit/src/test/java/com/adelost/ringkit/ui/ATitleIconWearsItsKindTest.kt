package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import com.adelost.designkit.glass.CircleGlass
import com.adelost.designkit.glass.CircleGlassPalette
import com.adelost.designkit.ui.CircleAccentPaletteProvider
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.CircleUiProfiles
import com.adelost.designkit.ui.LocalCircleActionHostCost
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.resolveCircleSurfaceLayout
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * A page's title icon wears its kind, as the same icon does on every disc (style C, Mattias 2026-10-17: the colour
 * belongs to the icon). Skyvw's Detail pages (WIND, GPS, ALT REF, NETWORK) and Link's phone headers draw these; both
 * were the dimmed grey of text before.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ATitleIconWearsItsKindTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val glass = CircleGlass(compose)

    @Test
    fun `the round title's icon wears its kind`() {
        mount(round = true) { ScreenTitle(text = "DETAIL", icon = RingIcons.Grid, topPadding = 24.dp) }

        assertTrue("the title icon is its kind's strong tone", glass.count(CircleGlassPalette.kind.strong) > 0)
    }

    @Test
    fun `the phone header's icon wears its kind`() {
        mount(round = false) { PhoneScreenHeader(title = "DETAIL", onBack = null, backLabel = "BACK", icon = RingIcons.Grid) }

        assertTrue("the header icon is its kind's strong tone", glass.count(CircleGlassPalette.kind.strong) > 0)
    }

    private fun mount(round: Boolean, content: @Composable () -> Unit) = compose.setContent {
        CompositionLocalProvider(
            LocalCircleActionHostCost provides CircleActionHostCost.NONE,
            LocalCircleSurfaceLayout provides if (round) {
                resolveCircleSurfaceLayout(CircleUiProfiles.CANON_ROUND_CANVAS_DP, round = true)
            } else {
                resolveCircleSurfaceLayout(390f, 844f, round = false)
            },
        ) {
            CircleAccentPaletteProvider(CircleGlassPalette.palette) {
                // A round title measures its inset against the face it sits on, so it is mounted on one.
                val face = if (round) Modifier.size(CircleUiProfiles.CANON_ROUND_CANVAS_DP.dp) else Modifier.fillMaxSize()
                Box(face.background(Color.Black)) { content() }
            }
        }
    }
}
