package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
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

    private fun setControl(enabled: Boolean = true, onAction: () -> Unit) {
        compose.setContent {
            val feedback = rememberCircleActionFeedbackState()
            Box(
                Modifier
                    .size(48.dp)
                    .testTag(TARGET)
                    .circleSafeTap(feedback = feedback, enabled = enabled, onTap = onAction),
            ) {
                // The production structure that exposed the regression:
                // the gesture atom owns the parent while an Icon child owns
                // the spoken name. The merged node must carry both.
                Box(
                    Modifier
                        .fillMaxSize()
                        .semantics { contentDescription = CONTROL_DESCRIPTION },
                )
            }
        }
    }

    private companion object {
        const val TARGET = "circle-safe-tap"
        const val CONTROL_DESCRIPTION = "Named child action"
    }
}
