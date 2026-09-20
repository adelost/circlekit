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

/** WHAT: Checks back-ring artwork and target semantics. WHY: Keeps visible size separate from the accessible hit target. */
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

    /** Link's DEV HOST route renders the shared host preview with no back host (Mattias 2026-09-14). */
    @Test
    fun roundHostPreviewPaintsItsOwnNamedBackWithoutAProductHost() {
        var exits = 0
        val devHost = circleHostPreviewScreen(
            CircleHostPreviewPort(
                isWatchDevice = false,
                state = kotlinx.coroutines.flow.MutableStateFlow(com.adelost.designkit.ui.CircleHostPreviewState()),
                systemOrientationAllowed = true,
                onMode = {},
                onDiameter = {},
                onOrientation = {},
            ),
        )
        compose.setContent {
            Box(Modifier.size(192.dp)) {
                com.adelost.designkit.ui.CircleHostSurface(
                    isWatchDevice = true,
                    state = com.adelost.designkit.ui.CircleHostPreviewState(),
                    onStateChange = null,
                    actionHostCosts = com.adelost.designkit.ui.CircleActionHostCosts(
                        responsive = com.adelost.designkit.ui.CircleActionHostCost.NONE,
                        watchExact = com.adelost.designkit.ui.CircleActionHostCost.WORN,
                    ),
                ) {
                    RenderRingScreen(RingNavigator(devHost), onExit = { exits++ }, backLabel = PRODUCT_LABEL)
                }
            }
        }

        val back = compose.onNodeWithContentDescription(PRODUCT_LABEL, useUnmergedTree = true)
            .assertWidthIsEqualTo(48.dp).assertHeightIsEqualTo(48.dp)
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.OnClick))
        back.performSemanticsAction(SemanticsActions.OnClick)
        compose.waitForIdle()

        assertEquals(1, exits)
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
