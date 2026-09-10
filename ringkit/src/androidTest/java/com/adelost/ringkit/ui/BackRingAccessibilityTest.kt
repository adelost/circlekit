package com.adelost.ringkit.ui

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class BackRingAccessibilityTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun normalBackKeepsTheActionRingSizeAndLargerHitTarget() {
        compose.setContent {
            Box(Modifier.size(96.dp), contentAlignment = Alignment.Center) {
                BackRing(PRODUCT_LABEL, {}, Modifier.testTag("artwork"))
            }
        }
        compose.onNodeWithTag("artwork", useUnmergedTree = true)
            .assertWidthIsEqualTo(30.dp).assertHeightIsEqualTo(30.dp)
        compose.onNodeWithContentDescription(PRODUCT_LABEL, useUnmergedTree = true)
            .assertWidthIsEqualTo(48.dp).assertHeightIsEqualTo(48.dp)
    }

    @Test
    fun holdBackKeepsTheSameVisualAndHitGeometry() {
        compose.setContent {
            Box(Modifier.size(96.dp), contentAlignment = Alignment.Center) {
                BackRing(PRODUCT_LABEL, {}, Modifier.testTag("artwork"), holdMs = 900L)
            }
        }
        compose.onNodeWithTag("artwork", useUnmergedTree = true)
            .assertWidthIsEqualTo(30.dp).assertHeightIsEqualTo(30.dp)
        compose.onNodeWithContentDescription(PRODUCT_LABEL, useUnmergedTree = true)
            .assertWidthIsEqualTo(48.dp).assertHeightIsEqualTo(48.dp)
    }

    @Test
    fun tapBackUsesOnlyTheCallersDeclaredName() {
        var actions = 0
        compose.setContent {
            BackRing(label = PRODUCT_LABEL, onBack = { actions++ })
        }

        val node = compose.onNodeWithContentDescription(PRODUCT_LABEL, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnLongClick))
        node.performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()

        assertEquals(1, actions)
        assertEquals(1, actionableNodes())
    }

    @Test
    fun holdBackUsesOnlyTheCallersDeclaredNameAndLongClick() {
        var actions = 0
        compose.setContent {
            BackRing(
                label = PRODUCT_LABEL,
                onBack = { actions++ },
                holdMs = 900L,
            )
        }

        val node = compose.onNodeWithContentDescription(PRODUCT_LABEL, useUnmergedTree = true)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick))
            .assert(SemanticsMatcher.keyNotDefined(SemanticsActions.OnClick))
            .assert(SemanticsMatcher("the hold node owns its name without merging artwork") {
                !it.config.isMergingSemanticsOfDescendants
            })
        node.performSemanticsAction(SemanticsActions.OnLongClick)
        compose.waitForIdle()

        assertEquals(1, actions)
        assertEquals(1, actionableNodes())
    }

    private fun actionableNodes(): Int = compose.onAllNodes(
        SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick)
            .or(SemanticsMatcher.keyIsDefined(SemanticsActions.OnLongClick)),
        useUnmergedTree = true,
    ).fetchSemanticsNodes().size

    private companion object {
        const val PRODUCT_LABEL = "RETURN"
    }
}
