package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.adelost.designkit.glass.CircleGlass
import com.adelost.designkit.glass.CircleGlassPalette
import com.adelost.designkit.ui.CircleAccentPaletteProvider
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.LocalCircleActionHostCost
import com.adelost.designkit.ui.RingIcons
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.SourceId
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * The scale's ok, caution and danger come from the palette in scope wherever a composable paints them (style C): a
 * product writes its colours once, and the kit's old hex copies (GraphiteTokens.Green, Orange, Red) must not answer
 * for them. Each surface here is mounted under a palette unlike the kit's and must paint the palette's step.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TheScaleIsThePaletteInScopeTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val glass = CircleGlass(compose)

    @Test
    fun `a source's freshness line on its page is the palette's ok`() {
        val detail = RingScreen.Detail(
            title = "GPS", icon = RingIcons.Grid, sourceId = SourceId("gps"), hero = flowOf("11"), sub = flowOf(""),
            freshness = flowOf("NOW"), health = flowOf(Health.FRESH), progress = flowOf(null), actions = emptyList(),
        )
        mount { RenderRingScreen(nav = RingNavigator(detail), onExit = {}, backLabel = "BACK") }

        assertTrue("the freshness line", glass.count(CircleGlassPalette.ok) > 0)
    }

    @Test
    fun `a destructive hold is the palette's danger`() {
        mount { HoldPill(text = "CLEAR", onConfirm = {}, destructive = true) }

        assertTrue("the destructive hold's words", glass.count(CircleGlassPalette.danger) > 0)
    }

    @Test
    fun `a player's failed and complete states are the palette's danger and ok`() {
        val state = mutableStateOf(RingPlaybackState.FAILED)
        mount {
            RingPlaybackControls(
                RingPlaybackSpec(
                    title = "REPLY", state = state.value, positionMs = 12_000L, durationMs = 83_000L,
                    onPlayPause = {}, onStop = {},
                ),
            )
        }
        assertTrue("a failed player's status", glass.count(CircleGlassPalette.danger) > 0)

        state.value = RingPlaybackState.COMPLETE
        assertTrue("a complete player's status", glass.count(CircleGlassPalette.ok) > 0)
    }

    private fun mount(content: @Composable () -> Unit) = compose.setContent {
        CompositionLocalProvider(LocalCircleActionHostCost provides CircleActionHostCost.NONE) {
            CircleAccentPaletteProvider(CircleGlassPalette.palette) {
                Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) { content() }
            }
        }
    }
}
