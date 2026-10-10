package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Skyvw, Mattias 2026-10-09, on the phone's 320 dp watch preview: "Varför ändras storleken enormt mycket när man går
 * in i settings versus när man är i kartläget?" A menu opened as a window was drawn at the phone's scale over a face
 * drawn at 320 / 192 of it. The same circle is measured on the page and in a [CircleWindow] over it.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w411dp-h891dp-xxhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AWindowKeepsItsSurfaceScaleTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `a circle in a window over a 320 dp face is as large as the same circle on the face`() {
        compose.setContent {
            Host(CircleHostPreviewState(mode = CircleHostMode.WATCH_EXACT, watchDiameterDp = 320f)) {
                Box(Modifier.size(30.dp).testTag(PAGE))
                CircleWindow(onDismissRequest = {}) { Box(Modifier.size(30.dp).testTag(WINDOW)) }
            }
        }
        compose.waitForIdle()

        val density = compose.activity.resources.displayMetrics.density
        assertEquals("the face's circle, 30 x 320 / 192 dp of the phone, in px", 30f * 320f / 192f * density, widthPx(PAGE), 1f)
        assertEquals("the window's circle against the face's, in px", widthPx(PAGE), widthPx(WINDOW), 1f)
    }

    @Test
    fun `a window opened inside a component that scales itself is drawn at the surface's scale`() {
        compose.setContent {
            Host(CircleHostPreviewState(mode = CircleHostMode.RESPONSIVE)) {
                Column {
                    Box(Modifier.size(30.dp).testTag(PAGE))
                    CircleComponentViewport(spec = LocalCircleSurfaceLayout.current.altitudeDialViewport) {
                        Box(Modifier.size(30.dp).testTag(COMPONENT))
                        CircleWindow(onDismissRequest = {}) { Box(Modifier.size(30.dp).testTag(WINDOW)) }
                    }
                }
            }
        }
        compose.waitForIdle()

        val page = widthPx(PAGE)
        assertTrue("the dial scales its subtree, or this case proves nothing", widthPx(COMPONENT) > page * 1.5f)
        assertEquals("the window's circle against the page's, in px", page, widthPx(WINDOW), 1f)
    }

    @Composable
    private fun Host(state: CircleHostPreviewState, content: @Composable () -> Unit) {
        CircleHostSurface(
            isWatchDevice = false,
            state = state,
            onStateChange = null,
            actionHostCosts = CircleActionHostCosts(CircleActionHostCost.WORN, CircleActionHostCost.WORN),
        ) { _ -> content() }
    }

    private fun widthPx(tag: String): Float =
        compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode().size.width.toFloat()

    private companion object {
        const val PAGE = "page.circle"
        const val COMPONENT = "component.circle"
        const val WINDOW = "window.circle"
    }
}
