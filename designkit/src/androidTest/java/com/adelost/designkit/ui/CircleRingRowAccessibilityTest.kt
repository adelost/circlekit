package com.adelost.designkit.ui

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.text.AnnotatedString
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
