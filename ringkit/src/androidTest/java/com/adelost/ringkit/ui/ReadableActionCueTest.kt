package com.adelost.ringkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.click
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleActionCueEvent
import com.adelost.designkit.ui.LocalCircleActionCuePublisher
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.LocalCircleTapTiming
import com.adelost.designkit.ui.CircleActionTiming
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class ReadableActionCueTest {
    @get:Rule val compose = createComposeRule()

    @Test fun twoLineCaptionStaysOutsideTheProgressRingOnASmallWatch() {
        compose.setContent {
            Box(Modifier.size(192.dp)) {
                RingActionCueHost {
                    val publish = LocalCircleActionCuePublisher.current
                    LaunchedEffect(Unit) {
                        publish(CircleActionCueEvent(this, CircleActionCue(
                            icon = RingIcons.Target,
                            label = "A LONG RECIPIENT NAME",
                            progress = 0.5f,
                            confirmed = false,
                        )))
                    }
                }
            }
        }
        val ring = compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsProperties.ProgressBarRangeInfo))
            .fetchSemanticsNode().boundsInRoot
        val caption = compose.onNodeWithText("A LONG RECIPIENT NAME").fetchSemanticsNode().boundsInRoot
        assertTrue("caption overlaps progress ring", caption.top > ring.bottom)
    }

    @Test fun informationTapNeverChangesTheSettingUnderneath() {
        var changes = 0
        compose.setContent {
            CompositionLocalProvider(LocalCircleTapTiming provides CircleActionTiming.IMMEDIATE) {
                RingActionCueHost {
                    RingChoiceRow(title = "AUDIO", selected = "OFF", options = listOf("OFF", "ON"),
                        role = com.adelost.designkit.ui.CircleChoiceRole.TOGGLE,
                        hint = "Play new replies aloud.", infoSelected = true,
                        onSelect = { changes++ }, icon = RingIcons.Speaker)
                }
            }
        }
        compose.onNodeWithContentDescription("ABOUT AUDIO").performTouchInput { click() }
        compose.onNodeWithText("Play new replies aloud.").assertExists()
        assertEquals(0, changes)
        compose.onNodeWithContentDescription("Close information").performClick()
        compose.onNodeWithContentDescription("AUDIO · OFF").assertExists()
        assertEquals(0, changes)
    }
}
