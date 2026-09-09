package com.adelost.ringkit.ui

import androidx.compose.ui.Modifier
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import com.adelost.designkit.ui.CircleTouchFeedback
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material.Text
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HoldFillBoxAccessibilityTest {
    @get:Rule
    val compose = createComposeRule()
    private var touchFeedbackEnabled by mutableStateOf(true)
    private val feedback = mutableListOf<HapticFeedbackType>()
    private val haptics = object : HapticFeedback {
        override fun performHapticFeedback(hapticFeedbackType: HapticFeedbackType) {
            feedback += hapticFeedbackType
        }
    }

    @Test
    fun labelledHoldOwnsOneNonMergingLongClick() {
        var confirmations = 0
        setHold(label = LABEL, onLongClickLabel = ACTION_LABEL) { confirmations++ }

        val node = compose.onNodeWithContentDescription(LABEL, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
            .assert(SemanticsMatcher("labelled holds never depend on child merging") {
                !it.config.isMergingSemanticsOfDescendants
            })
            .assert(SemanticsMatcher("the declared long-click phrase is retained") {
                it.config.getOrNull(SemanticsActions.OnLongClick)?.label == ACTION_LABEL
            })
        node.performSemanticsAction(SemanticsActions.OnLongClick)
        compose.waitForIdle()

        assertEquals(1, confirmations)
        assertEquals(1, actionableNodes())
    }

    @Test
    fun explicitNullDeliberatelyMergesTheVisibleChildName() {
        var confirmations = 0
        setHold(label = null, onLongClickLabel = MERGED_NAME) { confirmations++ }

        compose.onNodeWithTag(TARGET, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick))
            .assert(SemanticsMatcher("explicit null keeps child-name merging") {
                it.config.isMergingSemanticsOfDescendants
            })
        compose.onNodeWithText(MERGED_NAME)
            .performSemanticsAction(SemanticsActions.OnLongClick)
        compose.waitForIdle()

        assertEquals(1, confirmations)
        assertEquals(1, actionableNodes())
    }

    @Test
    fun disabledHoldKeepsItsNameWithoutAnAction() {
        var confirmations = 0
        setHold(label = LABEL, onLongClickLabel = ACTION_LABEL, enabled = false) {
            confirmations++
        }

        compose.onNodeWithContentDescription(LABEL, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnLongClick))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
        compose.waitForIdle()

        assertEquals(0, confirmations)
        assertEquals(0, actionableNodes())
    }

    @Test
    fun pointerStillRejectsAGrazeAndConfirmsOneFullHold() {
        var confirmations = 0
        setHold(label = LABEL, onLongClickLabel = ACTION_LABEL) { confirmations++ }
        val node = compose.onNodeWithTag(TARGET, useUnmergedTree = true)
        compose.mainClock.autoAdvance = false

        node.performTouchInput { down(center) }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(HOLD_MS - 32L)
        node.performTouchInput { up() }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertEquals(0, confirmations)

        assertEquals(0, feedback.size)

        compose.mainClock.autoAdvance = false
        node.performTouchInput { down(center) }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(HOLD_MS + 32L)
        node.performTouchInput { up() }
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertEquals(1, confirmations)
        assertEquals(listOf(HapticFeedbackType.LongPress), feedback)
        compose.runOnIdle { touchFeedbackEnabled = false }
        compose.mainClock.autoAdvance = false
        node.performTouchInput { down(center) }
        compose.mainClock.advanceTimeByFrame()
        compose.mainClock.advanceTimeBy(HOLD_MS + 32L)
        node.performTouchInput { up() }
        compose.mainClock.autoAdvance = true
        compose.waitForIdle()
        assertEquals(2, confirmations)
        assertEquals(1, feedback.size)
    }

    private fun setHold(
        label: String?,
        onLongClickLabel: String?,
        enabled: Boolean = true,
        onConfirm: () -> Unit,
    ) {
        compose.setContent {
            CompositionLocalProvider(LocalHapticFeedback provides haptics) {
            CircleTouchFeedback(touchFeedbackEnabled) {
            HoldFillBox(
                label = label,
                onLongClickLabel = onLongClickLabel,
                onConfirm = onConfirm,
                fill = Color.White,
                background = Color.Transparent,
                modifier = Modifier.testTag(TARGET),
                holdMs = HOLD_MS,
                enabled = enabled,
            ) {
                Text(MERGED_NAME)
            }
            }
            }
        }
    }

    private fun actionableNodes(): Int = compose.onAllNodes(
        SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick)
            .or(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick)),
        useUnmergedTree = true,
    ).fetchSemanticsNodes().size

    private companion object {
        const val TARGET = "hold-fill-box"
        const val LABEL = "RESET ALTITUDE"
        const val ACTION_LABEL = "HOLD TO RESET"
        const val MERGED_NAME = "PLUS"
        const val HOLD_MS = 900L
    }
}
