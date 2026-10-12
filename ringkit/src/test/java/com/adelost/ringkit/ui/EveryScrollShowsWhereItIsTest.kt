package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.wear.compose.material.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.designkit.ui.CircleScrollPositionShown
import com.adelost.designkit.ui.CircleUiProfiles
import com.adelost.designkit.ui.LocalCircleActionHostCost
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.MenuGridRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.resolveCircleSurfaceLayout
import com.adelost.renderkit.list.SkyvwLinearListHost
import com.adelost.renderkit.list.SkyvwListItem
import com.adelost.renderkit.list.SkyvwListSpec
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.SourceId
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Mattias 2026-10-11, on the arc his watch draws while a page scrolls: "man ska inte kunna ha en scrollbar sida där
 * den inte syns" (docs/decisions/2026-10-12-every-scroll-shows-where-it-is.md). So every screen the kit draws is
 * mounted on both faces, and every vertical scroll on it must carry the arc's mark. A scroll written without
 * circleVerticalScroll or circleScrollPosition has no mark, and this names the screen it is on.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class EveryScrollShowsWhereItIsTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `every screen the round face draws shows where its scroll stands`() {
        val nav = RingNavigator(theScreens().first())
        compose.setContent {
            CompositionLocalProvider(
                LocalCircleActionHostCost provides CircleActionHostCost.NONE,
                LocalCircleSurfaceLayout provides
                    resolveCircleSurfaceLayout(CircleUiProfiles.CANON_ROUND_CANVAS_DP, round = true),
            ) {
                Box(Modifier.size(CircleUiProfiles.CANON_ROUND_CANVAS_DP.dp).background(Color.Black)) {
                    RenderRingScreen(nav = nav, onExit = {}, backLabel = "BACK")
                }
            }
        }
        everyScreenShowsItsPosition(nav, scrollingKinds = ROUND_SCROLLERS)
    }

    @Test
    fun `every screen the phone draws shows where its scroll stands`() {
        val nav = RingNavigator(theScreens().first())
        compose.setContent {
            CompositionLocalProvider(
                LocalCircleActionHostCost provides CircleActionHostCost.NONE,
                LocalCircleSurfaceLayout provides resolveCircleSurfaceLayout(390f, 844f, round = false),
            ) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    RenderRingScreen(nav = nav, onExit = {}, backLabel = "BACK")
                }
            }
        }
        everyScreenShowsItsPosition(nav, scrollingKinds = PHONE_SCROLLERS)
    }

    @Test
    fun `the phone's list host shows where its list stands`() {
        compose.setContent {
            SkyvwLinearListHost(
                SkyvwListSpec(items = List(40) { index -> SkyvwListItem(key = "row-$index") { Text("ROW $index") } }),
            )
        }
        assertEquals("the list host's scrolls without the arc", emptyList<String>(), scrollsWithoutTheirPosition())
        assertTrue("the list host drew no scroll at all", scrolls() > 0)
    }

    private fun everyScreenShowsItsPosition(nav: RingNavigator, scrollingKinds: Set<String>) {
        theScreens().forEach { screen ->
            compose.runOnIdle { nav.push(screen) }
            compose.waitForIdle()
            val kind = screen::class.simpleName.orEmpty()
            assertEquals("$kind: scrolls without the arc", emptyList<String>(), scrollsWithoutTheirPosition())
            if (kind in scrollingKinds) assertTrue("$kind drew no scroll, so this proves nothing", scrolls() > 0)
        }
    }

    private fun scrollNodes() = compose
        .onAllNodes(SemanticsMatcher.keyIsDefined(SemanticsProperties.VerticalScrollAxisRange), useUnmergedTree = true)
        .fetchSemanticsNodes()

    private fun scrolls(): Int = scrollNodes().size

    private fun scrollsWithoutTheirPosition(): List<String> = scrollNodes()
        .filterNot { CircleScrollPositionShown in it.config }
        .map { "scroll node ${it.id} at ${it.boundsInRoot}" }

    /** One of every screen the kit draws, each with more content than the face holds. */
    private fun theScreens(): List<RingScreen> {
        val stat = StatRowSpec(
            id = SourceId("gps"), icon = RingIcons.Grid, label = "GPS", value = flowOf("OK"),
            health = flowOf(Health.FRESH), detail = { theDetail() },
        )
        val dialPreview = ColorDialPreviewSpec(
            maxAltitudeM = 4000f, defaultAltitudeM = 1000f, checkpointsM = listOf(1000f, 2000f),
            colorAt = { _, _ -> Color.White }, render = { _, _, modifier -> Box(modifier) },
        )
        return listOf(
            RingScreen.Rows(
                title = "ROWS",
                items = flowOf(List(40) { RowSpec(key = "row-$it", title = "ROW $it", sub = "", icon = RingIcons.Grid) }),
            ),
            RingScreen.Hub(title = "HUB", rows = List(6) { stat.copy(id = SourceId("source-$it")) }),
            theDetail(),
            RingScreen.Launcher(
                title = "LAUNCHER",
                gridRole = MenuGridRole.SETTINGS,
                entries = List(9) { LaunchSpec(icon = RingIcons.Grid, label = "ITEM $it", open = { null }) },
            ),
            RingScreen.ColorPicker(selected = flowOf(CircleColorTheme.entries.first()), onSelect = {}, dialPreview = dialPreview),
            RingScreen.DialPreview(startAltitudeM = 1000f, theme = CircleColorTheme.entries.first(), spec = dialPreview),
        )
    }

    private fun theDetail() = RingScreen.Detail(
        title = "DETAIL", icon = RingIcons.Grid, sourceId = SourceId("gps"), hero = flowOf("OK"), sub = flowOf(""),
        freshness = flowOf("NOW"), health = flowOf(Health.FRESH), progress = flowOf(null),
        actions = List(6) { ActionSpec(label = "ACTION $it", icon = RingIcons.Grid, onRun = {}) },
    )

    private companion object {
        /** The kinds that scroll on each face; the rest draw no scroll there and only must not grow one bare. */
        val ROUND_SCROLLERS = setOf("Rows", "Hub", "Detail", "Launcher")
        val PHONE_SCROLLERS = setOf("Rows", "Hub", "Detail", "Launcher", "ColorPicker", "DialPreview")
    }
}
