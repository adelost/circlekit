package com.adelost.designkit.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import kotlinx.coroutines.delay

/** How a host draws its strip: sizes, type and the two tints. The strip never picks a colour for a look itself. */
@Immutable
data class CircleServiceStripStyle(
    val maxWidth: Dp,
    val iconSize: Dp,
    val gap: Dp,
    val textStyle: TextStyle,
    val liveTint: Color,
    val staleTint: Color,
    /** A dark ground under every glyph so it reads over imagery; null on a plain face. */
    val halo: Color?,
)

/**
 * Every service the host lists, as a small icon, its number and a segmented countdown ring (see
 * [circleServiceLitSegments]). What does not fit in [maxRows] is counted as "+N".
 *
 * [glyphsAt] builds the glyphs for a moment on [clock]; the strip asks once a second and redraws only when a number,
 * a look or a lit segment count changed, so a quiet strip costs a wake-up and no frame.
 */
@Composable
fun CircleServiceStrip(
    glyphsAt: (nowMs: Long) -> List<CircleServiceGlyph>,
    clock: () -> Long,
    style: CircleServiceStripStyle,
    maxRows: Int,
    modifier: Modifier = Modifier,
) {
    val frames by produceState(circleServiceFrames(glyphsAt(clock()), clock()), glyphsAt, clock) {
        while (true) {
            delay(CIRCLE_SERVICE_TICK_MS)
            val now = clock()
            value = circleServiceFrames(glyphsAt(now), now)
        }
    }
    if (frames.isEmpty()) return
    SubcomposeLayout(modifier.clearAndSetSemantics { contentDescription = frames.joinToString(", ") { it.glyph.description } }) { constraints ->
        val free = Constraints(maxWidth = constraints.maxWidth)
        val placeables = frames.map { frame ->
            subcompose(frame.glyph.key) { CircleServiceGlyphView(frame, style) }.single().measure(free)
        }
        val gapPx = style.gap.roundToPx()
        val layout = fitCircleServiceRows(placeables.map { it.width }, gapPx, minOf(style.maxWidth.roundToPx(), constraints.maxWidth), maxRows) { hidden ->
            subcompose("count-probe-$hidden") { CircleServiceText("+$hidden", style, style.liveTint) }.single().measure(free).width
        }
        val count = layout.hidden.takeIf { it > 0 }?.let { hidden ->
            subcompose("count") { CircleServiceText("+$hidden", style, style.liveTint) }.single().measure(free)
        }
        val rows = layout.rows.mapIndexed { r, row -> row.map { placeables[it] } + listOfNotNull(count.takeIf { r == layout.rows.lastIndex }) }
        val rowHeights = rows.map { row -> row.maxOf { it.height } }
        val width = rows.maxOf { row -> row.sumOf { it.width } + gapPx * (row.size - 1) }
        layout(width, rowHeights.sum()) {
            var y = 0
            rows.forEachIndexed { r, row ->
                var x = (width - (row.sumOf { it.width } + gapPx * (row.size - 1))) / 2
                row.forEach { placeable ->
                    placeable.place(x, y + (rowHeights[r] - placeable.height) / 2)
                    x += placeable.width + gapPx
                }
                y += rowHeights[r]
            }
        }
    }
}

@Composable
private fun CircleServiceGlyphView(frame: CircleServiceFrame, style: CircleServiceStripStyle) {
    val glyph = frame.glyph
    val tint = if (glyph.look == CircleServiceLook.LIVE) style.liveTint else style.staleTint
    val ring = circleServiceHasRing(glyph)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(style.iconSize * 0.18f)) {
        Box(
            Modifier.size(style.iconSize * 1.4f).drawBehind {
                if (!ring) return@drawBehind
                val stroke = size.minDimension * 0.09f
                val inset = stroke / 2f
                val arc = Size(size.width - stroke, size.height - stroke)
                style.halo?.let { drawArc(it, 0f, 360f, false, Offset(inset, inset), arc, style = Stroke(stroke * 2.5f)) }
                val step = 360f / CIRCLE_SERVICE_RING_SEGMENTS
                for (segment in 0 until CIRCLE_SERVICE_RING_SEGMENTS) {
                    val color = if (segment < frame.litSegments) tint else tint.copy(alpha = UNLIT_SEGMENT_ALPHA)
                    drawArc(color, -90f + segment * step + SEGMENT_GAP_DEG / 2f, step - SEGMENT_GAP_DEG, false,
                        Offset(inset, inset), arc, style = Stroke(stroke))
                }
            },
            contentAlignment = Alignment.Center,
        ) {
            style.halo?.let { Image(glyph.icon, null, Modifier.size(style.iconSize * 1.2f), colorFilter = ColorFilter.tint(it)) }
            Image(glyph.icon, null, Modifier.size(style.iconSize * 0.95f), colorFilter = ColorFilter.tint(tint))
        }
        CircleServiceText(glyph.label, style, tint)
    }
}

@Composable
private fun CircleServiceText(text: String, style: CircleServiceStripStyle, color: Color) {
    BasicText(text, style = style.textStyle.copy(color = color), maxLines = 1)
}

private const val CIRCLE_SERVICE_TICK_MS = 1_000L
private const val UNLIT_SEGMENT_ALPHA = 0.25f
private const val SEGMENT_GAP_DEG = 9f
