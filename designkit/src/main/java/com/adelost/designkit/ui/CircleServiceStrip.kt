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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.remember
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
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
    /** The least height each ROW of a pressable strip takes, so a reading a few dp tall still seats a finger. The
     *  glyphs keep their own size and centre in it, and a strip nobody can press ignores it. */
    val minRowHeight: Dp = 0.dp,
)

/**
 * Every service the host lists, as a small icon, its number and a segmented countdown ring (see
 * [circleServiceLitSegments]). What does not fit in [maxRows] is counted as "+N".
 *
 * [glyphsAt] builds the glyphs for a moment on [clock]; the strip asks whenever the host passes a new one and once a
 * second between, and redraws only when a number, a look or a lit segment count changed, so a quiet strip costs a
 * wake-up and no frame ([drawCircleServiceFrames]).
 */
@Composable
fun CircleServiceStrip(
    glyphsAt: (nowMs: Long) -> List<CircleServiceGlyph>,
    clock: () -> Long,
    style: CircleServiceStripStyle,
    maxRows: Int,
    modifier: Modifier = Modifier,
    /** One tap on a glyph, by its key. Null leaves the strip a reading, as it was: a glance nobody can press by
     *  mistake. A host that can explain a service passes this, and the strip reports the glyph under the finger. */
    onGlyphTap: ((key: String) -> Unit)? = null,
) {
    val latestGlyphsAt = rememberUpdatedState(glyphsAt)
    val frames by produceState(circleServiceFrames(glyphsAt(clock()), clock()), clock) {
        drawCircleServiceFrames(snapshotFlow { latestGlyphsAt.value }, clock, { delay(CIRCLE_SERVICE_TICK_MS) }) { value = it }
    }
    if (frames.isEmpty()) return
    // The strip owns the press, not the glyph: a glyph is a few dp of ink, far under a finger, so a press anywhere in
    // the strip lands on the glyph nearest it ([circleServiceSeats]). A strip nobody can press speaks as one reading;
    // a strip whose glyphs open something lets each glyph speak on its own, so a reader reaches the one it asks about.
    val seated = remember { CircleServiceSeatLatch() }
    val latestTap = rememberUpdatedState(onGlyphTap)
    val pressable = if (onGlyphTap == null) {
        modifier.clearAndSetSemantics { contentDescription = frames.joinToString(", ") { it.description } }
    } else {
        modifier.pointerInput(Unit) {
            detectTapGestures { at ->
                circleServiceKeyAt(seated.seats, at.x.toInt(), at.y.toInt())?.let { key -> latestTap.value?.invoke(key) }
            }
        }
    }
    SubcomposeLayout(pressable) { constraints ->
        val free = Constraints(maxWidth = constraints.maxWidth)
        val placeables = frames.map { frame ->
            subcompose(frame.key) { CircleServiceGlyphView(frame, style, onGlyphTap) }.single().measure(free)
        }
        val gapPx = style.gap.roundToPx()
        val layout = fitCircleServiceRows(placeables.map { it.width }, gapPx, minOf(style.maxWidth.roundToPx(), constraints.maxWidth), maxRows) { hidden ->
            subcompose("count-probe-$hidden") { CircleServiceText("+$hidden", style, style.liveTint) }.single().measure(free).width
        }
        val count = layout.hidden.takeIf { it > 0 }?.let { hidden ->
            subcompose("count") { CircleServiceText("+$hidden", style, style.liveTint) }.single().measure(free)
        }
        val rows = layout.rows.mapIndexed { r, row ->
            row.map { CircleServiceMeasured(frames[it].key, placeables[it]) } +
                listOfNotNull(count.takeIf { r == layout.rows.lastIndex }?.let { CircleServiceMeasured(null, it) })
        }
        val boxes = rows.map { row -> row.map { CircleServiceBox(it.key, it.placeable.width, it.placeable.height) } }
        val width = boxes.maxOf { row -> row.sumOf { it.width } + gapPx * (row.size - 1) }
        val seating = circleServiceSeats(boxes, gapPx, width, if (onGlyphTap == null) 0 else style.minRowHeight.roundToPx())
        seated.seats = seating.seats
        val placed = rows.flatten().map { it.placeable }
        layout(width, seating.height) {
            placed.forEachIndexed { i, placeable -> placeable.place(seating.seats[i].x, seating.seats[i].y) }
        }
    }
}

/** A glyph that has measured, on its way to its seat. */
private data class CircleServiceMeasured(val key: String?, val placeable: Placeable)

/** Where the last measure seated the glyphs, read by a press rather than by a draw. */
private class CircleServiceSeatLatch {
    var seats: List<CircleServiceSeat> = emptyList()
}

@Composable
private fun CircleServiceGlyphView(
    frame: CircleServiceFrame,
    style: CircleServiceStripStyle,
    onGlyphTap: ((key: String) -> Unit)? = null,
) {
    val tint = frame.tint ?: if (frame.look == CircleServiceLook.LIVE) style.liveTint else style.staleTint
    val ring = circleServiceHasRing(frame.look)
    // A reader reaches one glyph and activates it by name; a finger is served by the strip's own seat, which is why
    // there is no clickable here and no ripple on a few dp of ink.
    val speaking = onGlyphTap?.let { tap ->
        Modifier.semantics(mergeDescendants = true) {
            contentDescription = frame.description
            role = Role.Button
            onClick { tap(frame.key); true }
        }
    } ?: Modifier
    Row(
        modifier = speaking,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(style.iconSize * 0.18f),
    ) {
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
            style.halo?.let { Image(frame.icon, null, Modifier.size(style.iconSize * 1.2f), colorFilter = ColorFilter.tint(it)) }
            Image(frame.icon, null, Modifier.size(style.iconSize * 0.95f), colorFilter = ColorFilter.tint(tint))
        }
        CircleServiceText(frame.label, style, tint)
    }
}

@Composable
private fun CircleServiceText(text: String, style: CircleServiceStripStyle, color: Color) {
    BasicText(text, style = style.textStyle.copy(color = color), maxLines = 1)
}

private const val CIRCLE_SERVICE_TICK_MS = 1_000L
private const val UNLIT_SEGMENT_ALPHA = 0.25f
private const val SEGMENT_GAP_DEG = 9f
