package com.adelost.ringkit.ui

import androidx.compose.ui.Modifier
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
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class RingRowAccessibilityTest {
    @get:Rule
    val compose = createComposeRule()

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
