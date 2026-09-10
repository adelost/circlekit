package com.adelost.designkit.ui

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performSemanticsAction
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class CircleRingRowAccessibilityTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun singleLineActionIsVerticallyCentredWithoutAnEmptyValueLine() {
        compose.setContent {
            Box(Modifier.width(132.dp).testTag("row")) {
                CircleRingRowContent(
                    title = "ACCEPT", sub = "", icon = RingIcons.Check,
                    ringActive = null, affordance = CircleRowAffordance.of({}),
                    leading = null, trailing = null,
                )
            }
        }
        val row = compose.onNodeWithTag("row").fetchSemanticsNode().boundsInRoot
        val title = compose.onNodeWithText("ACCEPT").fetchSemanticsNode().boundsInRoot
        assertEquals(row.center.y, title.center.y, 1f)
    }

    @Test
    fun passiveLongNameUsesTheWholeReadingWidthAndKeepsItsStatus() {
        val name = "Alexandra Kristina Svensson Tests · FAKE"
        compose.setContent {
            Box(Modifier.width(132.dp).testTag("row")) {
                CircleRingRowContent(
                    title = name, sub = "RECEIVED", icon = RingIcons.Link,
                    ringActive = null, affordance = CircleRowAffordance.of(null),
                    leading = null, trailing = null, multiline = true,
                )
            }
        }
        val row = compose.onNodeWithTag("row").fetchSemanticsNode().boundsInRoot
        val title = compose.onNodeWithText(name).fetchSemanticsNode().boundsInRoot
        val status = compose.onNodeWithText("RECEIVED").fetchSemanticsNode().boundsInRoot
        assertEquals(row.width, title.width, 1f)
        assertEquals(row.center.x, title.center.x, 1f)
        org.junit.Assert.assertTrue(status.top >= title.bottom)
        assertEquals(0, actionableNodes())
    }

    @Test
    fun rowOwnsItsDeclaredTitleAndValueAndInvokesTheProductionActionOnce() {
        var actions = 0
        compose.setContent {
            CircleRingRow(
                title = TITLE,
                sub = SUB,
                onTap = { actions++ },
                icon = RingIcons.Activity,
            )
        }

        compose.onNodeWithContentDescription(LABEL, useUnmergedTree = true)
            .assertHasClickAction()
            .assert(nonMergingActionNode())
            .assert(hasNoDuplicateChildCopy())
            .performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()

        assertEquals(1, actions)
        assertEquals(1, namedNodes())
        assertEquals(1, actionableNodes())
    }

    @Test
    fun passiveInformationRowKeepsItsTitleAndExposesNoAction() {
        compose.setContent {
            CircleRingRow(
                title = PASSIVE_TITLE,
                sub = PASSIVE_SUB,
                onTap = null,
                icon = RingIcons.Warning,
            )
        }
        compose.waitForIdle()

        assertEquals(1, textNodesContaining(PASSIVE_TITLE))
        assertEquals(1, textNodesContaining(PASSIVE_SUB))
        assertEquals(0, actionableNodes())
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

    private fun textNodesContaining(text: String): Int = compose.onAllNodes(
        SemanticsMatcher("text contains $text") { node ->
            AnnotatedString(text) in node.config.getOrNull(SemanticsProperties.Text).orEmpty()
        },
        useUnmergedTree = true,
    ).fetchSemanticsNodes().size

    private fun nonMergingActionNode() = SemanticsMatcher(
        "the named action node does not depend on descendant merging",
    ) { node -> !node.config.isMergingSemanticsOfDescendants }

    private companion object {
        const val TITLE = "RECORD"
        const val SUB = "HOLD · AUTO READY"
        const val LABEL = "$TITLE · $SUB"
        const val PASSIVE_TITLE = "CERTIFIED"
        const val PASSIVE_SUB = "NEVER REPLACE EQUIPMENT"
    }
}
