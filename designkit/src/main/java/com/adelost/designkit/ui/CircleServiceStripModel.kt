package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collectLatest

/**
 * A strip of small service glyphs: an icon, a number, and a ring that counts down to the service's next update in
 * [CIRCLE_SERVICE_RING_SEGMENTS] segments, so a glance shows how fresh the data is and how often it arrives.
 *
 * The strip knows no product and owns no clock. The host says which services exist, formats each number, and passes
 * the clock it measures updates with; this file answers only what the ring shows at a given moment and how the glyphs
 * wrap into rows.
 */

const val CIRCLE_SERVICE_RING_SEGMENTS: Int = 8

/** A service that updates this often or faster keeps a still, full ring: a countdown would flicker, not count. */
const val CIRCLE_SERVICE_STILL_RING_MAX_INTERVAL_MS: Long = 1_000L

/** How a glyph is drawn: delivering with its countdown, or unable to update (dimmed, no ring). */
enum class CircleServiceLook { LIVE, STALE }

/** One service as the strip draws it, at one moment. */
@Immutable
data class CircleServiceGlyph(
    /** Stable per service, so a row keeps its glyphs when one number changes. */
    val key: String,
    val icon: ImageVector,
    /** The number beside the icon, formatted by the host ("30s", "20Hz", "4h"). */
    val label: String,
    val look: CircleServiceLook,
    /** How long the service keeps between updates; null when it has not been measured yet. */
    val intervalMs: Long?,
    /** When the last update landed, on the host's clock; null before the first. */
    val lastUpdateMs: Long?,
    /** What a screen reader hears for this glyph. */
    val description: String,
    /** The host's own colour for this glyph, over the style's tint for its look; null keeps the look's own. A
     *  product that measures health per service says so here, so the strip still picks no colour itself. */
    val tint: Color? = null,
)

/**
 * Lit ring segments at [nowMs]: the time since the last update over the interval, rounded down, so the ring is empty
 * when an update lands and full when the next one is due. Overdue stays full. A service of a second or faster is
 * still and full; an unmeasured service and a stale one show no lit segment.
 */
fun circleServiceLitSegments(glyph: CircleServiceGlyph, nowMs: Long): Int {
    if (glyph.look == CircleServiceLook.STALE) return 0
    val interval = glyph.intervalMs ?: return 0
    require(interval > 0L) { "Service ${glyph.key} keeps a non-positive interval: $interval ms" }
    if (interval <= CIRCLE_SERVICE_STILL_RING_MAX_INTERVAL_MS) return CIRCLE_SERVICE_RING_SEGMENTS
    val since = (nowMs - (glyph.lastUpdateMs ?: return 0)).coerceAtLeast(0L)
    return (since * CIRCLE_SERVICE_RING_SEGMENTS / interval).coerceAtMost(CIRCLE_SERVICE_RING_SEGMENTS.toLong()).toInt()
}

/** Whether a glyph draws a ring at all: a stale service has none. */
fun circleServiceHasRing(look: CircleServiceLook): Boolean = look == CircleServiceLook.LIVE

/**
 * What one glyph draws, and nothing it was computed from: a 20 Hz service lands a new update every second without
 * changing its frame, so equal frames draw nothing new.
 */
@Immutable
data class CircleServiceFrame(
    val key: String,
    val icon: ImageVector,
    val label: String,
    val look: CircleServiceLook,
    val litSegments: Int,
    val description: String,
    val tint: Color? = null,
)

fun circleServiceFrames(glyphs: List<CircleServiceGlyph>, nowMs: Long): List<CircleServiceFrame> = glyphs.map {
    CircleServiceFrame(it.key, it.icon, it.label, it.look, circleServiceLitSegments(it, nowMs), it.description, it.tint)
}

/**
 * Draws the strip's frames: at once for every glyph source the host publishes, then after every [tick] on the latest
 * one, skipping a frame equal to the last drawn. The frame comes before the wait, so a host that republishes faster
 * than a tick (a sensor's once-a-second summary) still moves the ring instead of restarting a wait that never ends.
 */
suspend fun drawCircleServiceFrames(
    glyphSources: Flow<(nowMs: Long) -> List<CircleServiceGlyph>>,
    clock: () -> Long,
    tick: suspend () -> Unit,
    draw: (List<CircleServiceFrame>) -> Unit,
) {
    var drawn: List<CircleServiceFrame>? = null
    glyphSources.collectLatest { glyphsAt ->
        while (true) {
            val now = clock()
            val frames = circleServiceFrames(glyphsAt(now), now)
            if (frames != drawn) {
                drawn = frames
                draw(frames)
            }
            tick()
        }
    }
}

/** Glyphs placed row by row in order, and how many did not fit; the last row keeps room for their "+N" count. */
@Immutable
data class CircleServiceRows(val rows: List<List<Int>>, val hidden: Int)

fun fitCircleServiceRows(
    widths: List<Int>,
    gap: Int,
    maxWidth: Int,
    maxRows: Int,
    countWidth: (hidden: Int) -> Int,
): CircleServiceRows {
    require(maxRows >= 1) { "A strip needs at least one row, got $maxRows" }
    val rows = mutableListOf(mutableListOf<Int>())
    val used = mutableListOf(0)
    fun extent(row: Int, width: Int) = if (rows[row].isEmpty()) width else used[row] + gap + width
    for (i in widths.indices) {
        if (extent(rows.lastIndex, widths[i]) <= maxWidth) {
            used[rows.lastIndex] = extent(rows.lastIndex, widths[i]); rows.last() += i
        } else if (rows.size < maxRows && widths[i] <= maxWidth) {
            rows += mutableListOf(i); used += widths[i]
        } else {
            break
        }
    }
    var hidden = widths.size - rows.sumOf { it.size }
    // The count takes the last row's tail: later glyphs step aside until "+N" fits beside the earlier ones.
    while (hidden > 0 && rows.last().isNotEmpty() && extent(rows.lastIndex, countWidth(hidden)) > maxWidth) {
        rows.last().removeAt(rows.last().lastIndex)
        hidden += 1
        used[rows.lastIndex] = rows.last().sumOf { widths[it] } + gap * (rows.last().size - 1).coerceAtLeast(0)
    }
    return CircleServiceRows(rows.filter { it.isNotEmpty() }, hidden)
}

/** A glyph on its way into a row: the service it draws, and how big it measured. The "+N" count names no service. */
@Immutable
data class CircleServiceBox(val key: String?, val width: Int, val height: Int)

/** Where a glyph is drawn ([x], [y]) and the seat a press for it lands in ([left]..[right], [top]..[bottom]). */
@Immutable
data class CircleServiceSeat(
    val key: String?,
    val x: Int,
    val y: Int,
    val left: Int,
    val top: Int,
    val right: Int,
    val bottom: Int,
)

/**
 * Where the strip puts its measured glyphs, and where a finger may press for each. Rows are centred in [width] and
 * stacked down the middle of [height]; a seat reaches half a gap past its glyph on each side, so a press between two
 * glyphs still names one of them, and fills its row's band of the height, so a strip given room for a finger is
 * pressable everywhere in that room while the glyphs keep their own small size.
 */
fun circleServiceSeats(rows: List<List<CircleServiceBox>>, gap: Int, width: Int, height: Int): List<CircleServiceSeat> {
    require(rows.all { it.isNotEmpty() }) { "A strip row without a glyph cannot be placed" }
    val rowHeights = rows.map { row -> row.maxOf { it.height } }
    val seats = mutableListOf<CircleServiceSeat>()
    var inkTop = ((height - rowHeights.sum()) / 2).coerceAtLeast(0)
    rows.forEachIndexed { r, row ->
        val top = if (r == 0) 0 else inkTop
        val bottom = if (r == rows.lastIndex) maxOf(height, inkTop + rowHeights[r]) else inkTop + rowHeights[r]
        var x = (width - (row.sumOf { it.width } + gap * (row.size - 1))) / 2
        row.forEach { box ->
            seats += CircleServiceSeat(box.key, x, inkTop + (rowHeights[r] - box.height) / 2,
                left = x - gap / 2, top = top, right = x + box.width + gap / 2, bottom = bottom)
            x += box.width + gap
        }
        inkTop += rowHeights[r]
    }
    return seats
}

/** The service a press at [x], [y] in the strip's own space lands on; null outside every seat and on the "+N" count. */
fun circleServiceKeyAt(seats: List<CircleServiceSeat>, x: Int, y: Int): String? =
    seats.firstOrNull { x >= it.left && x < it.right && y >= it.top && y < it.bottom }?.key
