package com.adelost.ringkit.ui

import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.CircleChromeSlot
import com.adelost.designkit.ui.CircleHostSurface
import com.adelost.designkit.ui.CircleHostPreviewState
import com.adelost.designkit.ui.LocalRoundChromeReservation
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.SourceId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class RingRowAccessibilityTest {
    @get:Rule
    val compose = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    @org.junit.Before fun useTheProductLikeWindow() {
        compose.activityRule.scenario.onActivity { activity ->
            // The self-targeted test Activity otherwise adds Android's title
            // bar above the kit. Product hosts have no such competing chrome.
            activity.actionBar?.hide()
            activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN)
        }
    }

    @Test fun readingIdentityUsesTheFreeWidthAboveCentredActions() {
        val name = "Alexandra Kristina Svensson Tests · FAKE"
        var accepted = false
        val rows = MutableStateFlow(listOf(
            RowSpec("name", name, "RECEIVED", RingIcons.Link, hint = name),
            RowSpec("accept", "ACCEPT", "", RingIcons.Check, onTap = { accepted = true }),
            RowSpec("decline", "DECLINE", "", RingIcons.Cross, onTap = {}),
        ))
        compose.setContent { roundMenu(CircleChromeSlot.HOUR_9) {
            RenderRingScreen(RingNavigator(RingScreen.Rows("PEOPLE", rows)), {}, "Back")
        } }
        val nameBounds = compose.onNodeWithText(name).fetchSemanticsNode().boundsInRoot
        val acceptBounds = compose.onNodeWithContentDescription("ACCEPT", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        capture("people-reading-nine")
        assertTrue("identity should use the full row: identity=$nameBounds, action=$acceptBounds",
            nameBounds.width >= acceptBounds.width * 0.9f)
        assertEquals("identity is centred in the same usable band as the actions",
            nameBounds.center.x, acceptBounds.center.x, 1f)
        val escape = compose.onNodeWithContentDescription("Back", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        assertTrue("the named action must clear the escape", !acceptBounds.overlaps(escape))
        compose.onNodeWithContentDescription("ACCEPT", useUnmergedTree = true)
            .performSemanticsAction(SemanticsActions.OnClick)
        compose.runOnIdle {
            assertTrue(accepted)
            rows.value = listOf(RowSpec("name", name, "FRIEND", RingIcons.Link, hint = name))
        }
        compose.waitForIdle()
        capture("people-reading-accepted")
    }

    @Test fun directionIsPreservedWhenTheReadingOpensInformation() {
        var published by androidx.compose.runtime.mutableStateOf<com.adelost.designkit.ui.CircleActionCue?>(null)
        val screen = RingScreen.Rows("READINGS", flowOf(listOf(
            RowSpec("direction", "120 m", "8 m/s", RingIcons.Arrow,
                hint = "FROM 270°", iconRotationDeg = 90f, semanticColor = Color.Magenta),
        )))
        val nav = RingNavigator(screen)
        compose.setContent { roundMenu {
            CompositionLocalProvider(com.adelost.designkit.ui.LocalCircleActionCuePublisher provides {
                // Observe the explicit information publication; ordinary INFO
                // button press receipts are a separate, already-tested owner.
                if (it.cue?.lingers == true) published = it.cue
            }) {
                RenderRingScreen(nav, {}, "Back")
                published?.let { RingActionExplanation(it, onDismiss = { published = null }) }
            }
        } }
        assertReadingPigment("8 m/s")
        compose.onNodeWithText("120 m", useUnmergedTree = true)
            .performTouchInput { down(center); advanceEventTime(1); up() }
        compose.onNodeWithContentDescription("ABOUT 120 m", useUnmergedTree = true)
            .performTouchInput { down(center); advanceEventTime(450); up() }
        compose.runOnIdle {
            assertEquals(90f, requireNotNull(published).iconRotationDeg, 0f)
            assertEquals(Color.Magenta, requireNotNull(published).semanticColor)
        }
        assertReadingPigment("8 m/s")
        capture("reading-direction-info")
    }

    /** Pixel proof of the actual value renderer, not a metadata-only equality. */
    private fun assertReadingPigment(value: String) {
        val nodes = compose.onAllNodes(SemanticsMatcher.expectValue(
            SemanticsProperties.Text, listOf(AnnotatedString(value))), useUnmergedTree = true)
        compose.waitUntil { nodes.fetchSemanticsNodes().isNotEmpty() }
        val bitmap = nodes[nodes.fetchSemanticsNodes().lastIndex].captureToImage().asAndroidBitmap()
        assertTrue("explicit reading pigment must reach the visible value",
            (0 until bitmap.height).any { y -> (0 until bitmap.width).any { x ->
                bitmap.getPixel(x, y) == Color.Magenta.toArgb()
            } })
    }

    @Test fun declaredMultilineChoiceReachesTheActualRoundRow() {
        val selected = "SEA GLASS BLUE GREEN"
        val row = RowSpec(key = "colour", title = "COLORS", sub = selected,
            icon = RingIcons.Palette, choices = listOf(selected, "EMBER"), onSelect = {}, multiline = false)
        val rows = MutableStateFlow(listOf(row))
        val screen = RingScreen.Rows("DISPLAY", rows)
        compose.setContent { roundMenu { RenderRingScreen(RingNavigator(screen), {}, "Back") } }
        val named = compose.onNodeWithContentDescription("COLORS · $selected", useUnmergedTree = true)
        val compactHeight = named.fetchSemanticsNode().boundsInRoot.height
        compose.runOnIdle { rows.value = listOf(row.copy(multiline = true)) }
        compose.waitForIdle()
        assertTrue("declared multiline was lost between Rows and RingChoiceRow",
            named.fetchSemanticsNode().boundsInRoot.height > compactHeight)
        capture("choice-multiline")
    }

    @Test fun statusAndDetailClearTheSameOffCentreEscape() {
        val detail = RingScreen.Detail("PRESSURE", RingIcons.Gauge, SourceId("pressure"),
            flowOf("1005 hPa"), flowOf("STATION · 24 KM"), flowOf("REPORTED 22m ago"),
            flowOf(Health.FRESH), flowOf(null))
        val status = RingScreen.Hub("STATUS", listOf(
            StatRowSpec(SourceId("pressure"), RingIcons.Gauge, "PRESSURE", flowOf("1005"),
                flowOf(Health.FRESH), detail = { detail }),
            StatRowSpec(SourceId("position"), RingIcons.Gps, "POSITION", flowOf("±5"),
                flowOf(Health.FRESH), detail = { detail }),
        ))
        val nav = RingNavigator(status)
        compose.setContent { roundMenu { RenderRingScreen(nav, {}, "Back") } }
        val escape = compose.onNodeWithContentDescription("Back", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        val pressure = compose.onNodeWithContentDescription("PRESSURE", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        assertTrue("status ring overlaps escape", !pressure.overlaps(escape))
        capture("status-clearance")
        compose.runOnIdle { nav.push(detail) }
        compose.waitForIdle()
        val hero = compose.onNodeWithText("1005 hPa", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        assertTrue("detail hero overlaps escape", !hero.overlaps(escape))
        capture("pressure-clearance")
    }

    @Composable private fun roundMenu(
        backSlot: CircleChromeSlot = CircleChromeSlot.HOUR_10,
        content: @Composable () -> Unit,
    ) {
        Box(Modifier.size(192.dp).testTag("round-menu-face")) {
            CircleHostSurface(isWatchDevice = true, state = CircleHostPreviewState(), onStateChange = null) {
                CompositionLocalProvider(LocalRoundChromeReservation provides listOf(backSlot)) {
                    content()
                    RingRoundChrome(listOf(RingChromeAction(backSlot, RingIcons.Cross, "Back", {})))
                }
            }
        }
    }

    private fun capture(name: String) {
        val instrumentation = androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
        instrumentation.uiAutomation.waitForIdle(100, 2_000)
        compose.waitForIdle()
        val context = instrumentation.targetContext
        java.io.File(context.cacheDir, "$name.png").outputStream().use { output ->
            check(compose.onNodeWithTag("round-menu-face").captureToImage().asAndroidBitmap()
                .compress(android.graphics.Bitmap.CompressFormat.PNG, 100, output))
        }
    }

    @Test
    fun holdRowOwnsOneNamedLongClickAndNoClick() {
        var confirmations = 0
        setHoldRow { confirmations++ }

        val node = compose.onNodeWithContentDescription(LABEL, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
            .assert(nonMergingActionNode())
            .assert(SemanticsMatcher("long click announces the declared hold hint") { semanticNode ->
                semanticNode.config.getOrNull(SemanticsActions.OnLongClick)?.label == HOLD_HINT
            })
            .assert(hasNoDuplicateChildCopy())
        node.performSemanticsAction(SemanticsActions.OnLongClick)
        compose.waitForIdle()

        assertEquals(1, confirmations)
        assertEquals(1, namedNodes())
        assertEquals(1, actionableNodes())
        assertEquals(
            "moving semantics into the hold engine must not shrink the row focus bounds",
            compose.onNodeWithTag(TARGET, useUnmergedTree = true)
                .fetchSemanticsNode().boundsInRoot,
            node.fetchSemanticsNode().boundsInRoot,
        )
    }

    @Test
    fun holdRowPointerStillRejectsAGrazeAndConfirmsOneFullHold() {
        var confirmations = 0
        setHoldRow { confirmations++ }
        val node = compose.onNodeWithTag(TARGET)
        compose.mainClock.autoAdvance = false

        node.performTouchInput {
            down(center)
        }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(HOLD_MS - 32L)
        node.performTouchInput {
            up()
        }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertEquals(0, confirmations)

        compose.mainClock.autoAdvance = false
        node.performTouchInput {
            down(center)
        }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(HOLD_MS + 32L)
        node.performTouchInput {
            up()
        }
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertEquals(1, confirmations)
    }

    @Test
    fun legacyHoldActionWithNoValueUsesItsDeclaredTitleAsTheActionLabel() {
        compose.setContent {
            RingRow(
                title = LEGACY_TITLE,
                sub = "",
                onTap = {},
                icon = RingIcons.Warning,
                holdToConfirm = true,
            )
        }

        compose.onNodeWithContentDescription(LEGACY_TITLE, useUnmergedTree = true)
            .assert(SemanticsMatcher("long click reuses the only declared copy") { node ->
                node.config.getOrNull(SemanticsActions.OnLongClick)?.label == LEGACY_TITLE
            })
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
    }

    private fun setHoldRow(onConfirm: () -> Unit) {
        compose.setContent {
            RingRow(
                title = TITLE,
                sub = SUB,
                onTap = onConfirm,
                icon = RingIcons.Activity,
                modifier = Modifier.testTag(TARGET),
                holdToConfirm = true,
                holdMs = HOLD_MS,
                hint = HOLD_HINT,
            )
        }
    }

    private fun namedNodes(): Int = compose.onAllNodes(
        SemanticsMatcher.expectValue(
            SemanticsProperties.ContentDescription,
            listOf(LABEL),
        ),
        useUnmergedTree = true,
    ).fetchSemanticsNodes().size

    private fun hasNoDuplicateChildCopy() = SemanticsMatcher(
        "the complete spoken copy is owned only by contentDescription",
    ) { node ->
        val text = node.config.getOrNull(SemanticsProperties.Text).orEmpty()
        AnnotatedString(SUB) !in text && AnnotatedString(TITLE) !in text
    }

    private fun actionableNodes(): Int = compose.onAllNodes(
        SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick)
            .or(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick)),
        useUnmergedTree = true,
    ).fetchSemanticsNodes().size

    private fun nonMergingActionNode() = SemanticsMatcher(
        "the named action node does not depend on descendant merging",
    ) { node -> !node.config.isMergingSemanticsOfDescendants }

    private companion object {
        const val TITLE = "UNDERSTAND"
        const val SUB = "HOLD TO CONFIRM"
        const val LABEL = "$TITLE · $SUB"
        const val HOLD_HINT = "Hold to start or stop recording."
        const val TARGET = "hold-row"
        const val HOLD_MS = 900L
        const val LEGACY_TITLE = "ZERO ALT"
    }
}
