package com.adelost.ringkit.ui

import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
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
    val compose = createComposeRule()

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
        compose.runOnIdle { nav.push(detail) }
        compose.waitForIdle()
        val hero = compose.onNodeWithText("1005 hPa", useUnmergedTree = true)
            .fetchSemanticsNode().boundsInRoot
        assertTrue("detail hero overlaps escape", !hero.overlaps(escape))
    }

    @Composable private fun roundMenu(content: @Composable () -> Unit) {
        Box(Modifier.size(192.dp)) {
            CircleHostSurface(isWatchDevice = true, state = CircleHostPreviewState(), onStateChange = null) {
                CompositionLocalProvider(LocalRoundChromeReservation provides listOf(CircleChromeSlot.HOUR_10)) {
                    content()
                    RingRoundChrome(listOf(RingChromeAction(CircleChromeSlot.HOUR_10, RingIcons.Cross, "Back", {})))
                }
            }
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
