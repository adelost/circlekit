package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Icon
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class CircleSafeTapAccessibilityTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun pointerStillRequiresTheDeclaredHoldAndCommitsExactlyOnce() {
        var actions = 0
        setControl { actions++ }

        compose.onNodeWithTag(TARGET).performTouchInput {
            down(center)
            advanceEventTime(MenuDesign.tapHoldMs - 1L)
            up()
        }
        compose.waitForIdle()
        assertEquals("a short pointer touch remains a graze", 0, actions)

        compose.onNodeWithTag(TARGET).performTouchInput {
            down(center)
            advanceEventTime(MenuDesign.tapHoldMs + 1L)
            up()
        }
        compose.waitForIdle()
        assertEquals("one completed pointer hold invokes one action", 1, actions)
    }

    @Test
    fun accessibilityClickExposesAndInvokesTheSameActionExactlyOnce() {
        var actions = 0
        setControl { actions++ }

        compose.onNodeWithContentDescription(CONTROL_DESCRIPTION)
            .assertHasClickAction()
            .performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()

        assertEquals("one accessibility click invokes one production action", 1, actions)
        assertEquals("there is one named node", 1, namedNodes())
        assertEquals("there is no unnamed actionable sibling", 1, actionableNodes())
    }

    @Test
    fun disabledControlKeepsItsNameButExposesNoClickAction() {
        var actions = 0
        setControl(enabled = false) { actions++ }

        compose.onNodeWithContentDescription(CONTROL_DESCRIPTION)
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
        compose.waitForIdle()

        assertEquals(0, actions)
    }

    @Test
    fun tapOrHoldOwnsBothNamedActionsAndEachInvokesExactlyOnce() {
        var taps = 0
        var longPresses = 0
        setDualControl(onTap = { taps++ }, onLongPress = { longPresses++ })

        val node = compose.onNodeWithContentDescription(CONTROL_DESCRIPTION)
            .assertHasClickAction()
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick))
        node.performSemanticsAction(SemanticsActions.OnClick)
        node.performSemanticsAction(SemanticsActions.OnLongClick)
        compose.waitForIdle()

        assertEquals(1, taps)
        assertEquals(1, longPresses)
        assertEquals("there is one named node", 1, namedNodes())
        assertEquals("there is no unnamed actionable sibling", 1, actionableNodes())
    }

    @Test
    fun tapOrHoldPointerRungsRemainDistinct() {
        var taps = 0
        var longPresses = 0
        setDualControl(onTap = { taps++ }, onLongPress = { longPresses++ })

        compose.onNodeWithTag(TARGET).performTouchInput {
            down(center)
            advanceEventTime(MenuDesign.tapHoldMs - 1L)
            up()
        }
        compose.waitForIdle()
        assertEquals(0, taps)
        assertEquals(0, longPresses)

        compose.onNodeWithTag(TARGET).performTouchInput {
            down(center)
            advanceEventTime(MenuDesign.tapHoldMs + 1L)
            up()
        }
        compose.waitForIdle()
        assertEquals(1, taps)
        assertEquals(0, longPresses)

        compose.onNodeWithTag(TARGET).performTouchInput {
            down(center)
            advanceEventTime(MenuDesign.holdDestructiveMs + 1L)
            up()
        }
        compose.waitForIdle()
        assertEquals(1, taps)
        assertEquals(1, longPresses)
    }

    private fun setControl(enabled: Boolean = true, onAction: () -> Unit) {
        compose.setContent {
            val feedback = rememberCircleActionFeedbackState()
            Box(
                Modifier
                    .size(48.dp)
                    .testTag(TARGET)
                    .circleSafeTap(
                        feedback = feedback,
                        enabled = enabled,
                        label = CONTROL_DESCRIPTION,
                        onTap = onAction,
                    ),
            ) {
                // This is the production child that exposed the regression.
                // The atom now owns the name, so the visual icon is silent.
                Icon(
                    imageVector = RingIcons.ChevronRight,
                    contentDescription = null,
                )
            }
        }
    }

    private fun setDualControl(onTap: () -> Unit, onLongPress: () -> Unit) {
        compose.setContent {
            val feedback = rememberCircleActionFeedbackState()
            Box(
                Modifier
                    .size(48.dp)
                    .testTag(TARGET)
                    .circleSafeTapOrHold(
                        feedback = feedback,
                        label = CONTROL_DESCRIPTION,
                        onTap = onTap,
                        onLongPress = onLongPress,
                    ),
            ) {
                Icon(
                    imageVector = RingIcons.ChevronRight,
                    contentDescription = null,
                )
            }
        }
    }

    private fun namedNodes(): Int = compose
        .onAllNodes(
            SemanticsMatcher.expectValue(
                androidx.compose.ui.semantics.SemanticsProperties.ContentDescription,
                listOf(CONTROL_DESCRIPTION),
            ),
        )
        .fetchSemanticsNodes().size

    private fun actionableNodes(): Int = compose
        .onAllNodes(
            SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick)
                .or(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick)),
        )
        .fetchSemanticsNodes().size

    private companion object {
        const val TARGET = "circle-safe-tap"
        const val CONTROL_DESCRIPTION = "Named child action"
    }
}
