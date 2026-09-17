package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp

/**
 * A fixed place at a row's end, beside both lines, that the row measures whether or not [content] shows
 * anything. Content that comes and goes (RingKit's row (i)) lives here, so revealing it changes no pixel of the
 * row around it (Skyvw row 118). [width] is what the row lends to it, so the title can win that width back.
 */
class CircleRowEndSlot(val width: Dp, val content: @Composable () -> Unit)

@Composable
internal fun CircleRowEndSlotted(endSlot: CircleRowEndSlot?, gap: Dp, content: @Composable () -> Unit) {
    if (endSlot == null) {
        content()
        return
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f)) { content() }
        Spacer(Modifier.size(gap))
        endSlot.content()
    }
}

/**
 * How many lines a wrapping row line (its title or its value) may take once the row lends [lentWidth] to an end
 * slot. A line that fitted one line in the width it had before keeps that line and shrinks instead: the slot made
 * GROUND SCREEN wrap at rest at 192 and COLORS read "SEA / GLASS", each row a line taller than its neighbours
 * (Skyvw row 118). A line that already wrapped keeps wrapping. [line] gets [modifier] to place on its text, or
 * a bare Modifier when this wrapper already carries it.
 */
@Composable
internal fun CircleRowLineKeepingOneLine(
    text: String,
    fontSizeSp: Float,
    letterSpacingSp: Float,
    fontWeight: FontWeight,
    lentWidth: Dp,
    maxLines: Int,
    modifier: Modifier = Modifier,
    line: @Composable (maxLines: Int, modifier: Modifier) -> Unit,
) {
    if (maxLines == 1 || lentWidth.value <= 0f) {
        line(maxLines, modifier)
        return
    }
    BoxWithConstraints(modifier) {
        val style = circleTextStyle(Color.Unspecified, fontSizeSp, fontWeight, letterSpacingSp)
        val measurer = rememberTextMeasurer()
        val lentPx = with(LocalDensity.current) { lentWidth.roundToPx() }
        val keepsOneLine = remember(text, style, constraints.maxWidth, lentPx) {
            constraints.hasBoundedWidth &&
                measurer.measure(text, style, maxLines = 1, softWrap = false).size.width <= constraints.maxWidth + lentPx
        }
        line(if (keepsOneLine) 1 else maxLines, Modifier)
    }
}
