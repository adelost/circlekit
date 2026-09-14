package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleChromeSlot
import com.adelost.designkit.ui.CircleHorizontalInsetsDp
import com.adelost.designkit.ui.CircleHostPreviewState
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.circleHalfChord
import com.adelost.designkit.ui.roundTitleTopPadding
import com.adelost.designkit.ui.roundChromeHorizontalInsetsDp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Mattias 2026-09-14: "bakknappen ska väl vara ett eget lager så att de andra
 * meny-itemsen ska inte tryckas undan" and "finns inga riktig bakknapp i Dev
 * Host". See docs/decisions/2026-09-14-round-menu-back-layer.md.
 */
class RingRoundBackLayerTest {
    private val titleBandBottom = (MenuDesign.roundTitleTopPadding + MenuDesign.roundTitleHeight).value

    @Test
    fun `the shared back never moves a row sideways at any face or scroll height`() {
        for (face in listOf(192f, 216f, 280f, 360f)) {
            val withBack = rowsListInsetsDp(face, face, titleBandBottom, roundRowInsetH.value, roundBackHostReservation())
            val withoutBack = rowsListInsetsDp(face, face, titleBandBottom, roundRowInsetH.value, emptyList())
            assertEquals("$face dp: the list edge must not pay for back", withoutBack, withBack)
            // No height at which a row or a reading line could be asked to
            // step aside as it scrolls past the escape.
            for (y in 0..face.toInt()) {
                assertEquals(
                    "$face dp, y=$y",
                    CircleHorizontalInsetsDp(0f, 0f),
                    roundChromeHorizontalInsetsDp(face, face, y.toFloat(), roundBackHostReservation(),
                        buttonDiameterDp = MenuDesign.backTouchTarget.value),
                )
            }
        }
    }

    @Test
    fun `DEV HOST offers a visible round back without a product back host`() {
        val devHost = circleHostPreviewScreen(
            CircleHostPreviewPort(
                isWatchDevice = false,
                state = MutableStateFlow(CircleHostPreviewState()),
                systemOrientationAllowed = true,
                onMode = {},
                onDiameter = {},
                onOrientation = {},
            ),
        )

        assertTrue("no host above: the renderer paints the escape",
            roundRendererPaintsBack(devHost, backLayerMounted = false, reservedSlots = emptyList()))
        assertFalse("RingRoundBackHost already owns it",
            roundRendererPaintsBack(devHost, backLayerMounted = true, reservedSlots = emptyList()))
        assertFalse("a product shell mounting rim chrome owns its own escape",
            roundRendererPaintsBack(devHost, backLayerMounted = false, reservedSlots = listOf(CircleChromeSlot.HOUR_10)))
        assertFalse("setup cannot be backed around",
            roundRendererPaintsBack(RingScreen.Rows("SETUP", flowOf(emptyList()), showBack = false), false, emptyList()))
    }

    @Test
    fun `the escape sits in the top cap, inside the glass and above the title`() {
        val face = 192f
        val ringRadius = MenuDesign.backDiameter.value / 2f
        val ringTop = MenuDesign.roundBackLayerCenterY.value - ringRadius
        val targetTop = MenuDesign.roundBackLayerCenterY.value - MenuDesign.backTouchTarget.value / 2f
        assertTrue("the whole 48 dp target is on the canvas", targetTop >= 0f)
        assertTrue("the drawn ring is inside the circle at its top edge",
            circleHalfChord(face / 2f, face / 2f - ringTop) >= ringRadius)
        assertTrue("the title starts below the ring",
            roundTitleTopPadding(backLayer = true) >= MenuDesign.roundBackLayerCenterY + MenuDesign.backDiameter / 2)
        assertEquals(MenuDesign.roundTitleTopPadding, roundTitleTopPadding(backLayer = false))
    }
}
