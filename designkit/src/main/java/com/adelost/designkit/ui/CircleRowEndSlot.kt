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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.constrainWidth
import androidx.compose.ui.layout.layout

/**
 * A fixed place at a row's end, beside both lines, that the row measures whether or not [content] shows
 * anything. Content that comes and goes (RingKit's row (i)) lives here, so revealing it changes no pixel of the
 * row around it (Skyvw row 118). [width] is what the row lends to it, so the title can win that width back.
 */
class CircleRowEndSlot(val width: Dp, val occupied: Boolean = true, val content: @Composable () -> Unit)

/** The title owns the lent text bounds; the value column and the reserved slot stay put. */
internal fun Modifier.circleRowTitleWidth(lentWidth: Dp): Modifier = if (lentWidth <= 0.dp) this else layout { measurable, constraints ->
    val extra = lentWidth.roundToPx()
    val width = if (constraints.hasBoundedWidth) constraints.maxWidth + extra else constraints.maxWidth
    val text = measurable.measure(constraints.copy(maxWidth = width))
    layout(constraints.constrainWidth(text.width), text.height) { text.placeRelative(0, 0) }
}

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
