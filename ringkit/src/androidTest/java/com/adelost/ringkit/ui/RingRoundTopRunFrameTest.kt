package com.adelost.ringkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertWidthIsEqualTo
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleHostPreviewState
import com.adelost.designkit.ui.CircleHostSurface
import com.adelost.designkit.ui.CircleIconDisc
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * The run on the glass, not on paper: what the three seats actually lay out to
 * at the canon face, that an unfilled seat leaves the frame exactly as it was,
 * and that the run alone keeps the picture behind it where the page host's cap
 * covers it (rows 192 and 193; the choice and its pictures are
 * .agents/2/row182/PROPOSAL.md in the Skyvw repo).
 */
class RingRoundTopRunFrameTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun theEscapeSitsAtTwelveWhetherOrNotCompanionsAreBesideIt() {
        compose.setRun(left = null, right = null)
        val alone = compose.centerOf(BACK)

        assertEquals("back x", 96f, alone.first.value, 1f)
        assertEquals("back y", MenuDesign.roundBackLayerCenterY.value, alone.second.value, 1f)
    }

    @Test
    fun aFilledSeatDrawsWhereTheRunSaysAndAnEmptyOneDrawsNothing() {
        compose.setRun(left = seat(LEFT), right = null)

        val back = compose.centerOf(BACK)
        val left = compose.centerOf(LEFT)
        val expected = roundTopRunSeatCenters(CANON, seats = 3)

        assertEquals("back keeps twelve with a companion beside it",
            MenuDesign.roundBackLayerCenterY.value, back.second.value, 1f)
        assertEquals("the left seat's x", expected[0].first, left.first.value, 1f)
        assertEquals("the left seat's y", expected[0].second, left.second.value, 1f)
        compose.onNodeWithContentDescription(LEFT, useUnmergedTree = true)
            .assertWidthIsEqualTo(MenuDesign.watchActionRingDiameter)
            .assertHeightIsEqualTo(MenuDesign.watchActionRingDiameter)
        // The unfilled seat: nothing at all, not an empty ring and not a gap
        // anyone can tap.
        assertEquals(0, compose.onAllNodesWithDescription(RIGHT))
    }

    @Test
    fun threeSeatsShareOneDiameterAndOneRadius() {
        compose.setRun(left = seat(LEFT), right = seat(RIGHT))

        val centers = listOf(compose.centerOf(LEFT), compose.centerOf(BACK), compose.centerOf(RIGHT))
        for (label in listOf(LEFT, RIGHT)) {
            compose.onNodeWithContentDescription(label, useUnmergedTree = true)
                .assertWidthIsEqualTo(MenuDesign.watchActionRingDiameter)
                .assertHeightIsEqualTo(MenuDesign.watchActionRingDiameter)
        }
        // Symmetric about twelve, and both companions at the same height.
        assertEquals("the run is centred on the escape",
            centers[1].first.value - centers[0].first.value,
            centers[2].first.value - centers[1].first.value, 1f)
        assertEquals("both companions sit at the same height",
            centers[0].second.value, centers[2].second.value, 1f)
        // And lower than the escape, because the run follows the face.
        assertTrue(
            "a companion must sit lower than the escape: ${centers[0].second} vs ${centers[1].second}",
            centers[0].second.value > centers[1].second.value,
        )
    }

    /**
     * The same three seats when the run is mounted ALONE, as a picture surface
     * mounts it: no cap over the map, and the geometry unchanged. What the cap
     * does to a page is a drawing, and row 193 proves that on the device
     * instead of on a sampled pixel (.agents/2/row193 in the Skyvw repo).
     */
    @Test
    fun theRunAloneSeatsTheSameThreeSeats() {
        compose.setContent {
            Box(Modifier.size(CANON.dp).testTag(FACE)) {
                CircleHostSurface(
                    isWatchDevice = true,
                    state = CircleHostPreviewState(),
                    onStateChange = null,
                ) {
                    RingRoundTopRun(
                        centre = { BackRing(label = BACK, onBack = {}) },
                        left = seat(LEFT),
                        right = seat(RIGHT),
                    )
                }
            }
        }
        compose.waitForIdle()

        val expected = roundTopRunSeatCenters(CANON, seats = 3)
        listOf(LEFT to expected[0], BACK to expected[1], RIGHT to expected[2]).forEach { (label, seat) ->
            val centre = compose.centerOf(label)
            assertEquals("$label x", seat.first, centre.first.value, 1f)
            assertEquals("$label y", seat.second, centre.second.value, 1f)
        }
    }

    private fun seat(label: String): RoundTopSeat = {
        CircleIconDisc(
            icon = RingIcons.Gear,
            contentDescription = label,
            actionLabel = label,
            onTap = {},
            diameter = MenuDesign.watchActionRingDiameter,
        )
    }

    private fun ComposeContentTestRule.setRun(left: RoundTopSeat?, right: RoundTopSeat?) {
        setContent {
            Box(Modifier.size(CANON.dp).testTag(FACE)) {
                CircleHostSurface(
                    isWatchDevice = true,
                    state = CircleHostPreviewState(),
                    onStateChange = null,
                ) {
                    RingRoundBackHost(onBack = {}, label = BACK, left = left, right = right) {
                        Box(Modifier.size(CANON.dp))
                    }
                }
            }
        }
        waitForIdle()
    }

    private fun ComposeContentTestRule.centerOf(label: String): Pair<Dp, Dp> {
        val bounds = onNodeWithContentDescription(label, useUnmergedTree = true).getUnclippedBoundsInRoot()
        return (bounds.left + (bounds.right - bounds.left) / 2) to
            (bounds.top + (bounds.bottom - bounds.top) / 2)
    }

    private fun ComposeContentTestRule.onAllNodesWithDescription(label: String): Int =
        onAllNodes(
            androidx.compose.ui.test.hasContentDescription(label),
            useUnmergedTree = true,
        ).fetchSemanticsNodes().size

    private companion object {
        const val CANON = 192f
        const val BACK = "RETURN"
        const val LEFT = "SETTINGS"
        const val RIGHT = "ROTATE"
        const val FACE = "round-face"
    }
}
