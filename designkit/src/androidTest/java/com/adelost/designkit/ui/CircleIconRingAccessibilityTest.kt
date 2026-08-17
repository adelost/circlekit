package com.adelost.designkit.ui

import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class CircleIconRingAccessibilityTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun labelledRingOwnsTitleSubAndActionExactlyOnce() {
        var actions = 0
        compose.setContent {
            CircleIconRing(
                icon = RingIcons.Record,
                label = TITLE,
                sub = SUB,
                onTap = { actions++ },
            )
        }

        val node = compose.onNodeWithContentDescription(SPOKEN, useUnmergedTree = true)
            .assertHasClickAction()
            .assert(nonMergingActionNode())
        node.performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()

        assertEquals(1, actions)
        assertEquals(0, textNodes(TITLE))
        assertEquals(0, textNodes(SUB))
        assertEquals(1, actionNodes())
    }

    @Test
    fun disabledRingKeepsItsNameWithoutAnAction() {
        compose.setContent {
            CircleIconRing(
                icon = RingIcons.Record,
                label = TITLE,
                sub = SUB,
                enabled = false,
                onTap = {},
            )
        }

        compose.onNodeWithContentDescription(SPOKEN, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
            .assert(nonMergingActionNode())
        assertEquals(0, textNodes(TITLE))
        assertEquals(0, textNodes(SUB))
        assertEquals(0, actionNodes())
    }

    @Test
    fun passiveFrameKeepsItsVisibleCopyAndHasNoAction() {
        compose.setContent {
            CircleIconRingFrame(
                icon = RingIcons.Record,
                label = TITLE,
                modifier = Modifier,
                diameter = 52.dp,
                active = null,
                accent = CircleAccent.NEUTRAL,
                fontFamily = null,
                labelSize = 9.5.sp,
                centerValue = null,
                contourColor = null,
                iconRotationDegrees = 0f,
                choiceState = null,
                sub = SUB,
                enabled = true,
                gestureModifier = Modifier,
            )
        }

        assertEquals(1, textNodes(TITLE))
        assertEquals(1, textNodes(SUB))
        assertEquals(0, actionNodes())
    }

    private fun textNodes(text: String): Int = compose
        .onAllNodesWithText(text, useUnmergedTree = true)
        .fetchSemanticsNodes().size

    private fun actionNodes(): Int = compose
        .onAllNodes(
            SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick)
                .or(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick)),
            useUnmergedTree = true,
        )
        .fetchSemanticsNodes().size

    private fun nonMergingActionNode() = SemanticsMatcher(
        "the named action node does not depend on descendant merging",
    ) { node -> !node.config.isMergingSemanticsOfDescendants }

    private companion object {
        const val TITLE = "RECORDING"
        const val SUB = "AUTO READY"
        const val SPOKEN = "$TITLE · $SUB"
    }
}
