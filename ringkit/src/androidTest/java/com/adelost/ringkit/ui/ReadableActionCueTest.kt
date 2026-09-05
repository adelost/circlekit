package com.adelost.ringkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleActionCueEvent
import com.adelost.designkit.ui.LocalCircleActionCuePublisher
import com.adelost.designkit.ui.RingIcons
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
}
