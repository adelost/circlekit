package com.adelost.ringkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleChoiceIconStrip
import com.adelost.designkit.ui.CircleChoiceIndicator
import com.adelost.designkit.ui.CircleChoiceState
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.circleChoiceIndicatorWidth

/**
 * The switch's answers under the cue's word. Each answer by its own glyph when
 * the switch has them, so the row says WHICH states there are and not only how
 * many (Mattias 2026-09-14: "Kan du även skapa unika iokner här för varje
 * state?"). 12 dp glyphs keep four answers at 64 dp, inside the ring where the
 * strip sits on a 192 dp face; the strip shrinks them past that.
 *
 * Without glyphs it falls back to the button's own dot mark, magnified to read
 * at centre-screen distance.
 */
@Composable
internal fun RingActionCueChoiceMark(state: CircleChoiceState, ink: Color) {
    if (state.icons != null) {
        CircleChoiceIconStrip(
            state = state,
            iconSize = 12.dp,
            selectedColor = ink,
            restColor = RingTokens.Ink.copy(alpha = 0.4f),
            modifier = Modifier.widthIn(max = 76.dp),
        )
        return
    }
    val magnify = 1.6f
    val width = circleChoiceIndicatorWidth(state.optionCount)
    val height = 7.dp
    Box(contentAlignment = Alignment.Center, modifier = Modifier.size(width * magnify, height * magnify)) {
        CircleChoiceIndicator(state = state, selectedColor = ink, modifier = Modifier.size(width, height).scale(magnify))
    }
}
