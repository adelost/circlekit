package com.adelost.designkit.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlin.math.abs

/**
 * The part of a scroll's whole content in view, as shares of the content from its top: [from] where the view
 * begins and [to] where it ends.
 */
data class CircleScrollWindow(val from: Float, val to: Float) {
    init {
        require(from in 0f..1f && to in from..1f) { "a window is a part of the content: $from..$to" }
    }
}

/**
 * Every vertical scroll shows where it stands (Mattias 2026-10-11, on the arc his watch draws: "man ska inte
 * kunna ha en scrollbar sida där den inte syns", docs/decisions/2026-10-12-every-scroll-shows-where-it-is.md).
 * The arc marks its node with this, so a test proves that no scroll on a screen goes without it.
 */
val CircleScrollPositionShown = SemanticsPropertyKey<Unit>("CircleScrollPositionShown")

/**
 * The arc's look, judged on glass. The colours are the progress ring's, a dim track and the shown part at full ink,
 * and both are bands of the kit's one band shape, ending as the product declared ([LocalCircleBandEnds]).
 */
object CircleScrollPositionDesign {
    /** On a round face, the arc's length, centred at three o'clock. */
    const val ROUND_SWEEP_DEG = 60f
    /** On a round face, from the face's edge to the middle of the arc's line. */
    val RoundEdgeInset = 5.dp
    /** On a phone, from the right edge to the middle of the line, and the gap the line keeps at either end. */
    val PhoneEdgeInset = 4.dp
    val PhoneEndInset = 8.dp
    val Stroke = CircleLine.Bar
    /** The shown part never draws shorter than this share of the track, so a long page still shows one. */
    const val MIN_SHOWN_SHARE = 0.2f
    /** Shown this long after the position last moved, then faded. */
    const val HOLD_MS = 1_000L
    const val FADE_IN_MS = 150
    const val FADE_OUT_MS = 400
}

/** A plain vertical scroll wearing its position, in the one order that keeps the arc still while the content moves. */
@Composable
fun Modifier.circleVerticalScroll(state: ScrollState, enabled: Boolean = true): Modifier =
    circleScrollPosition(state).verticalScroll(state, enabled)

/** The position of a plain scroll. Prefer [circleVerticalScroll], which cannot put the arc inside the content. */
@Composable
fun Modifier.circleScrollPosition(state: ScrollState): Modifier = circleScrollPosition(
    moved = { state.value },
    window = { viewportPx -> scrollWindow(state.value.toFloat(), state.maxValue.toFloat(), viewportPx) },
)

/** The position of a lazy list, on the list's own modifier. */
@Composable
fun Modifier.circleScrollPosition(state: LazyListState): Modifier = circleScrollPosition(
    moved = { state.firstVisibleItemIndex to state.firstVisibleItemScrollOffset },
    window = { _ ->
        val info = state.layoutInfo
        lazyWindow(
            lines = info.visibleItemsInfo.map { CircleScrollLine(it.index, it.offset, it.size) },
            lineCount = info.totalItemsCount,
            spacingPx = info.mainAxisItemSpacing,
            viewportPx = info.viewportEndOffset - info.viewportStartOffset,
            paddingPx = info.beforeContentPadding + info.afterContentPadding,
            atStart = !state.canScrollBackward,
            atEnd = !state.canScrollForward,
        )
    },
)

/** The position of a lazy grid, on the grid's own modifier. Its lines are its rows. */
@Composable
fun Modifier.circleScrollPosition(state: LazyGridState): Modifier = circleScrollPosition(
    moved = { state.firstVisibleItemIndex to state.firstVisibleItemScrollOffset },
    window = { _ ->
        val info = state.layoutInfo
        val columns = (info.visibleItemsInfo.maxOfOrNull { it.column } ?: 0) + 1
        lazyWindow(
            lines = info.visibleItemsInfo.groupBy { it.row }.map { (row, cells) ->
                CircleScrollLine(row, cells.minOf { it.offset.y }, cells.maxOf { it.size.height })
            },
            lineCount = (info.totalItemsCount + columns - 1) / columns,
            spacingPx = info.mainAxisItemSpacing,
            viewportPx = info.viewportEndOffset - info.viewportStartOffset,
            paddingPx = info.beforeContentPadding + info.afterContentPadding,
            atStart = !state.canScrollBackward,
            atEnd = !state.canScrollForward,
        )
    },
)

/**
 * The position of a scroll DesignKit does not know, such as Wear's ScalingLazyColumn: [moved] changes when the
 * content moves, and [window] says what is in view of a viewport that tall, null when nothing scrolls.
 */
@Composable
fun Modifier.circleScrollPosition(moved: () -> Any, window: (viewportPx: Float) -> CircleScrollWindow?): Modifier {
    val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
    val ends = LocalCircleBandEnds.current
    val faceSidePx = with(LocalDensity.current) { LocalCircleFaceShortSideDp.current.dp.toPx() }
    val currentMoved by rememberUpdatedState(moved)
    val currentWindow by rememberUpdatedState(window)
    val shown = remember { Animatable(0f) }
    var face by remember { mutableStateOf<CircleScrollFace?>(null) }
    LaunchedEffect(shown) {
        // The first value is the page opening: shown once, as the watch shows its arc at the start of the track.
        snapshotFlow { currentMoved() }.collectLatest {
            shown.animateTo(1f, tween(CircleScrollPositionDesign.FADE_IN_MS))
            delay(CircleScrollPositionDesign.HOLD_MS)
            shown.animateTo(0f, tween(CircleScrollPositionDesign.FADE_OUT_MS))
        }
    }
    return this
        .semantics { this[CircleScrollPositionShown] = Unit }
        .then(
            if (round) {
                Modifier.onGloballyPositioned { coordinates -> face = coordinates.faceOfSide(faceSidePx) }
            } else {
                Modifier
            },
        )
        .drawWithContent {
            drawContent()
            val alpha = shown.value
            if (alpha <= 0f) return@drawWithContent
            val inView = currentWindow(size.height) ?: return@drawWithContent
            val thumb = circleScrollThumb(inView) ?: return@drawWithContent
            val onFace = face
            when {
                !round -> drawEdgeScrollPosition(thumb, ends, alpha)
                onFace == null -> Unit
                // A scroll in a box lower than half the face, such as a short editor field, keeps its line inside its
                // own box: an arc at the face's edge would be clipped with the box or point at the wrong thing.
                size.height < onFace.radiusPx -> drawEdgeScrollPosition(thumb, ends, alpha)
                else -> drawRoundScrollPosition(onFace, thumb, ends, alpha)
            }
        }
}

/** Where along the track, 0 at its top and 1 at its bottom, the shown part runs; null when the content fits. */
fun circleScrollThumb(window: CircleScrollWindow): ClosedFloatingPointRange<Float>? {
    val inView = window.to - window.from
    if (inView >= 1f) return null
    val length = inView.coerceAtLeast(CircleScrollPositionDesign.MIN_SHOWN_SHARE)
    val along = (window.from / (1f - inView)).coerceIn(0f, 1f)
    val start = along * (1f - length)
    return start..(start + length)
}

/** A plain scroll [value] px down of [maxValue], seen through [viewportPx]. */
internal fun scrollWindow(value: Float, maxValue: Float, viewportPx: Float): CircleScrollWindow? {
    if (maxValue <= 0f || viewportPx <= 0f) return null
    val whole = viewportPx + maxValue
    val from = (value / whole).coerceIn(0f, 1f)
    return CircleScrollWindow(from, ((value + viewportPx) / whole).coerceIn(from, 1f))
}

/** One laid-out line of a lazy container: its index, where it starts in the viewport and how tall it is. */
internal data class CircleScrollLine(val index: Int, val offsetPx: Int, val sizePx: Int)

/**
 * A lazy container's window, estimated from the lines it has laid out: the ones off screen are taken as tall as
 * the ones in view. The ends are exact, from whether it can scroll further.
 */
internal fun lazyWindow(
    lines: List<CircleScrollLine>,
    lineCount: Int,
    spacingPx: Int,
    viewportPx: Int,
    paddingPx: Int,
    atStart: Boolean,
    atEnd: Boolean,
): CircleScrollWindow? {
    if (lines.isEmpty() || lineCount <= 0 || viewportPx <= 0 || (atStart && atEnd)) return null
    val first = lines.minBy { it.index }
    val linePx = lines.sumOf { it.sizePx + spacingPx }.toFloat() / lines.size
    val whole = linePx * lineCount - spacingPx + paddingPx
    if (whole <= viewportPx) return null
    val inView = viewportPx / whole
    val from = when {
        atStart -> 0f
        atEnd -> 1f - inView
        else -> ((first.index * linePx - first.offsetPx) / whole).coerceIn(0f, 1f - inView)
    }
    return CircleScrollWindow(from, (from + inView).coerceAtMost(1f))
}

/** The round face in the scroll's own coordinates. */
private data class CircleScrollFace(val center: Offset, val radiusPx: Float)

/**
 * The face is the nearest box around the scroll as wide and tall as the face, because a host need not centre it in
 * its window: WATCH EXACT on a phone draws it below the window's middle, under the status bar. A window with no
 * such box, such as a menu's dialog, is the face's own window and centres it.
 */
private fun LayoutCoordinates.faceOfSide(sidePx: Float): CircleScrollFace {
    var box: LayoutCoordinates? = this
    while (box != null) {
        if (abs(box.size.width - sidePx) <= FACE_MATCH_PX && abs(box.size.height - sidePx) <= FACE_MATCH_PX) {
            return CircleScrollFace(localPositionOf(box, Offset(box.size.width / 2f, box.size.height / 2f)), sidePx / 2f)
        }
        box = box.parentLayoutCoordinates
    }
    val root = findRootCoordinates()
    return CircleScrollFace(localPositionOf(root, Offset(root.size.width / 2f, root.size.height / 2f)), sidePx / 2f)
}

/** A face laid out at whole pixels is within this of its side in exact pixels. */
private const val FACE_MATCH_PX = 1.5f

private fun DrawScope.drawRoundScrollPosition(
    face: CircleScrollFace,
    thumb: ClosedFloatingPointRange<Float>,
    ends: CircleBandEnds,
    alpha: Float,
) {
    val radius = face.radiusPx - CircleScrollPositionDesign.RoundEdgeInset.toPx()
    val half = CircleScrollPositionDesign.Stroke.toPx() / 2f
    if (radius - half <= 0f) return
    val sweep = CircleScrollPositionDesign.ROUND_SWEEP_DEG
    // 0 degrees is three o'clock and angles run clockwise, so the track runs from above it to below it.
    val trackStart = -sweep / 2f
    fun band(from: Float, to: Float) =
        circleArcBandPath(face.center, radius - half, radius + half, trackStart + from * sweep, (to - from) * sweep, ends, ends)
    drawPath(band(0f, 1f), RingTokens.ProgressTrack, alpha = alpha)
    drawPath(band(thumb.start, thumb.endInclusive), RingTokens.ProgressArc, alpha = alpha)
}

private fun DrawScope.drawEdgeScrollPosition(thumb: ClosedFloatingPointRange<Float>, ends: CircleBandEnds, alpha: Float) {
    val x = size.width - CircleScrollPositionDesign.PhoneEdgeInset.toPx()
    val top = CircleScrollPositionDesign.PhoneEndInset.toPx()
    val track = size.height - top * 2f
    if (track <= 0f) return
    val width = CircleScrollPositionDesign.Stroke.toPx()
    // The kit's bar is horizontal: drawn turned a quarter about the track's top, it runs down the right edge.
    fun bar(from: Float, to: Float) = circleBarPath(x + from * track, top - width / 2f, x + to * track, width, ends)
    rotate(degrees = 90f, pivot = Offset(x, top)) {
        drawPath(bar(0f, 1f), RingTokens.ProgressTrack, alpha = alpha)
        drawPath(bar(thumb.start, thumb.endInclusive), RingTokens.ProgressArc, alpha = alpha)
    }
}
