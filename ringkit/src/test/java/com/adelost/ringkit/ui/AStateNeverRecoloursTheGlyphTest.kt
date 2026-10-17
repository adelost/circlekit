package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.adelost.designkit.glass.CircleGlass
import com.adelost.designkit.glass.CircleGlassPalette
import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentPalette
import com.adelost.designkit.ui.CircleAccentPaletteProvider
import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.CircleTones
import com.adelost.designkit.ui.LocalCircleActionHostCost
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.resolveCircleSurfaceLayout
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * A state is the scale's colour on a value and never recolours the glyph beside it (style C). The adjustment stepper
 * painted its glyph with the row's semanticColor, so Skyvw's ALARM HEIGHTS page showed the bell in the altitude band,
 * and the info card painted a row's icon with it, or ink without one, never in the icon's kind.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AStateNeverRecoloursTheGlyphTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val glass = CircleGlass(compose)

    @Test
    fun `the stepper's glyph keeps its kind and its state sits on the value`() {
        val row = MutableStateFlow(alarmRow(enabled = null))
        val nav = RingNavigator(RingScreen.Adjustment(title = "PULL", initial = row.value, row = row))
        mount(WITH_A_BELL) { RenderRingScreen(nav = nav, onExit = {}, backLabel = "BACK") }

        assertTrue("the glyph beside the value is the bell's kind", glass.count(BELL.edge) > 0)
        assertTrue("the value wears the state", glass.count(STATE) > 0)

        row.value = alarmRow(enabled = true)
        assertTrue("the glyph beside VALUE is the bell's kind", glass.count(BELL.edge) > 0)
    }

    @Test
    fun `the info card's icon wears its kind and its state sits on the value`() {
        val cue = CircleActionCue(
            icon = RingIcons.Grid, label = "WIND", progress = 0f, confirmed = false, value = "5 M/S",
            hint = "The wind at the ground.", lingers = true, semanticColor = STATE,
        )
        mount(CircleGlassPalette.palette) { RingActionExplanation(cue = cue, onDismiss = {}) }

        // The card's close button wears the same neutral kind, so the icon is read inside its own bounds.
        val icon = compose.onNodeWithContentDescription("WIND", useUnmergedTree = true)
        assertTrue("the card's icon is its kind's", glass.count(CircleGlassPalette.kind.strong, inside = icon) > 0)
        assertTrue("the value wears the state", glass.count(STATE) > 0)
    }

    private fun alarmRow(enabled: Boolean?) = RowSpec(
        key = "pull", title = "PULL", sub = "1 200 M", icon = RingIcons.Grid, accent = CircleAccent.SOUND,
        semanticColor = STATE, onDec = {}, onInc = {}, enabled = enabled, onToggle = ({}).takeIf { enabled != null },
    )

    private fun mount(palette: CircleAccentPalette, content: @Composable () -> Unit) = compose.setContent {
        CompositionLocalProvider(
            LocalCircleActionHostCost provides CircleActionHostCost.NONE,
            LocalCircleSurfaceLayout provides resolveCircleSurfaceLayout(390f, 844f, round = false),
        ) {
            CircleAccentPaletteProvider(palette) {
                Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) { content() }
            }
        }
    }

    private companion object {
        /** A state a product hands the row, unlike every tone in scope. */
        val STATE = Color(0xFFE8E820)

        /** The bell's own kind, so its tones can only come from the row's glyph. */
        val BELL = CircleTones(
            strong = Color(0xFFA040F0), dim = Color(0xFF605010), ground = Color(0xFF103040), edge = Color(0xFF90F0A0),
        )

        val WITH_A_BELL = CircleAccentPalette(
            CircleAccent.entries.associateWith { CircleGlassPalette.palette.tones(it) } + (CircleAccent.SOUND to BELL),
        )
    }
}
