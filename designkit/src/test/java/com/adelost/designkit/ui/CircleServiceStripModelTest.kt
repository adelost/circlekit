package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class CircleServiceStripModelTest {
    private val icon = ImageVector.Builder("probe", 1.dp, 1.dp, 1f, 1f).build()
    private fun glyph(intervalMs: Long?, lastUpdateMs: Long?, look: CircleServiceLook = CircleServiceLook.LIVE) =
        CircleServiceGlyph("svc", icon, "30s", look, intervalMs, lastUpdateMs, "svc")

    /** Mattias 2026-09-14: "en åttabitars progression när det är dags för nästa uppdatering". */
    /**
     * Row 178 (Skyvw): a product that measures a service's health says so per glyph, and the strip draws that colour
     * instead of its look's. The strip still picks no colour itself, and a glyph without one is unchanged.
     */
    @Test
    fun `a glyph's own tint reaches its frame, and a glyph without one keeps its look`() {
        val measured = CircleServiceGlyph("svc", icon, "LIVE", CircleServiceLook.LIVE, 1_000L, 0L, "svc", tint = Color.Red)
        val plain = glyph(intervalMs = 1_000L, lastUpdateMs = 0L)
        val frames = circleServiceFrames(listOf(measured, plain), 10L)

        assertEquals(Color.Red, frames.first().tint)
        assertEquals(null, frames.last().tint)
        // The frames are compared to skip a redraw, so the same glyphs at the same moment stay equal.
        assertEquals(frames, circleServiceFrames(listOf(measured, plain), 10L))
    }

    @Test
    fun `the ring is empty when an update lands, half at half the interval, full when the next is due`() {
        val traffic = glyph(intervalMs = 30_000L, lastUpdateMs = 100_000L)
        assertEquals(0, circleServiceLitSegments(traffic, 100_000L))
        assertEquals(3, circleServiceLitSegments(traffic, 100_000L + 11_250L))
        assertEquals(4, circleServiceLitSegments(traffic, 115_000L))
        assertEquals(7, circleServiceLitSegments(traffic, 129_999L))
        assertEquals(8, circleServiceLitSegments(traffic, 130_000L))
        assertEquals("overdue stays full", 8, circleServiceLitSegments(traffic, 400_000L))
    }

    /** Mattias 2026-09-14: "20 Hz går ju såklart inte, men allting som är över en sekund". */
    @Test
    fun `a service of a second or faster keeps a still full ring, an unmeasured or stale one lights nothing`() {
        assertEquals(8, circleServiceLitSegments(glyph(intervalMs = 50L, lastUpdateMs = 0L), 20L))
        assertEquals(8, circleServiceLitSegments(glyph(intervalMs = 1_000L, lastUpdateMs = 0L), 10L))
        assertEquals(0, circleServiceLitSegments(glyph(intervalMs = 1_001L, lastUpdateMs = 0L), 10L))
        assertEquals(0, circleServiceLitSegments(glyph(intervalMs = null, lastUpdateMs = 0L), 90_000L))
        assertEquals(0, circleServiceLitSegments(glyph(intervalMs = 30_000L, lastUpdateMs = null), 90_000L))
        assertEquals(0, circleServiceLitSegments(glyph(30_000L, 0L, CircleServiceLook.STALE), 90_000L))
        assertThrows(IllegalArgumentException::class.java) { circleServiceLitSegments(glyph(0L, 0L), 1L) }
    }

    @Test
    fun `a frame changes only when a lit count or a glyph changes, so a quiet second draws nothing`() {
        val traffic = glyph(intervalMs = 30_000L, lastUpdateMs = 0L)
        assertEquals(circleServiceFrames(listOf(traffic), 4_000L), circleServiceFrames(listOf(traffic), 7_000L))
        assertEquals(1, circleServiceFrames(listOf(traffic), 4_000L).single().litSegments)
        assertEquals(2, circleServiceFrames(listOf(traffic), 8_000L).single().litSegments)
        // A 20 Hz sensor lands an update every second; its still ring and number draw the same frame.
        assertEquals(circleServiceFrames(listOf(glyph(50L, 1_000L)), 1_020L), circleServiceFrames(listOf(glyph(50L, 2_000L)), 2_020L))
    }

    /**
     * wear34b and p0phone 2026-09-14: the host republished its services about once a second, each restart began with a
     * one-second wait, and TRAFFIC read 3/8 for twelve seconds on a 30 s countdown.
     */
    @Test
    fun `a host that republishes faster than a tick still moves the ring on every publish`() = runBlocking {
        var now = 100_000L
        val traffic = { _: Long -> listOf(glyph(intervalMs = 30_000L, lastUpdateMs = 100_000L)) }
        val drawn = mutableListOf<Int>()
        val republishing = flow {
            repeat(CIRCLE_SERVICE_RING_SEGMENTS + 1) { emit(traffic); now += 3_750L }
        }
        val strip = launch { drawCircleServiceFrames(republishing, { now }, { awaitCancellation() }) { drawn += it.single().litSegments } }
        repeat(1_000) { if (drawn.size <= CIRCLE_SERVICE_RING_SEGMENTS) yield() }
        strip.cancelAndJoin()
        assertEquals((0..CIRCLE_SERVICE_RING_SEGMENTS).toList(), drawn)
    }

    @Test
    fun `a quiet host draws once per lit segment, not once per tick, while a 20 Hz neighbour keeps landing updates`() = runBlocking {
        var now = 0L
        var ticks = 0
        val services = { at: Long -> listOf(glyph(intervalMs = 50L, lastUpdateMs = at - 10L), glyph(intervalMs = 30_000L, lastUpdateMs = 0L)) }
        val drawn = mutableListOf<Int>()
        val strip = launch {
            drawCircleServiceFrames(flowOf(services), { now }, { if (ticks++ < 30) now += 1_000L else awaitCancellation() }) {
                drawn += it.last().litSegments
            }
        }
        repeat(1_000) { if (ticks <= 30) yield() }
        strip.cancelAndJoin()
        // 30 one-second ticks over a 30 s countdown: the first frame and one per segment, never the 20 Hz updates.
        assertEquals((0..CIRCLE_SERVICE_RING_SEGMENTS).toList(), drawn)
    }

    @Test
    fun `what does not fit is counted on the last row, and later glyphs step aside for the count`() {
        val widths = listOf(20, 20, 20, 20, 20)
        assertEquals(CircleServiceRows(listOf(listOf(0, 1)), 3), fitCircleServiceRows(widths, gap = 3, maxWidth = 55, maxRows = 1) { 8 })
        // 20 + 2 + 20 + 2 + 20 = 64: three to a row, the rest wraps.
        assertEquals(CircleServiceRows(listOf(listOf(0, 1, 2), listOf(3, 4)), 0), fitCircleServiceRows(widths, gap = 2, maxWidth = 64, maxRows = 2) { 8 })
        // Two rows full and one left over: the last row gives up its last glyph so "+2" fits.
        assertEquals(CircleServiceRows(listOf(listOf(0, 1), listOf(2)), 2), fitCircleServiceRows(widths, gap = 2, maxWidth = 42, maxRows = 2) { 8 })
        assertEquals(CircleServiceRows(listOf(listOf(0, 1, 2), listOf(3, 4)), 0),
            fitCircleServiceRows(widths, gap = 2, maxWidth = 64, maxRows = Int.MAX_VALUE) { 8 })
        assertThrows(IllegalArgumentException::class.java) { fitCircleServiceRows(widths, 2, 64, 0) { 8 } }
    }

    /**
     * Row 178 (Skyvw): the strip owns the press, not the glyph. A Skyvw glyph measures about 14 x 6 dp on a strip
     * whose cells sit 2 dp apart, far under Android's 48 dp target, so a finger aimed at one would miss it or hit its
     * neighbour. Every press inside the strip therefore names the glyph nearest it, and the room a host asks for
     * around them is shared the same way.
     */
    @Test
    fun `a press between two glyphs names the nearer one, and one on the count names no service`() {
        val seating = circleServiceSeats(
            listOf(listOf(CircleServiceBox("gps", 20, 6), CircleServiceBox("baro", 30, 6), CircleServiceBox(null, 8, 6))),
            gap = 4, width = 66, minHeight = 24,
        )
        val seats = seating.seats

        assertEquals("the room the host asked for", 24, seating.height)
        assertEquals("on the ink", "gps", circleServiceKeyAt(seats, 19, 12))
        assertEquals("in the gap, nearer gps", "gps", circleServiceKeyAt(seats, 21, 12))
        assertEquals("in the gap, nearer baro", "baro", circleServiceKeyAt(seats, 23, 12))
        assertEquals("the seats meet in the middle of the gap: that pixel is the later glyph's", "baro", circleServiceKeyAt(seats, 22, 12))
        assertEquals("the +N count names no service", null, circleServiceKeyAt(seats, 60, 12))
        assertEquals("high in the room, above the ink", "gps", circleServiceKeyAt(seats, 5, 0))
        assertEquals("low in the room, below it", "gps", circleServiceKeyAt(seats, 5, 23))
        // The ink stays 6 tall and centres in the 24 the finger gets; only the press reaches further.
        assertEquals(9, seats.first().y)
        assertEquals(0, seats.first().x)
    }

    /**
     * Skyvw row 178, measured on the 320 face: the strip wraps into three rows of 6 dp ink, sitting 6 dp apart. They
     * cannot each be a finger tall, and holding them apart to make them so would respace the face's glyphs. The room
     * is the strip's, and the glyphs keep their own tight rows inside it.
     */
    @Test
    fun `the room a host asks for never moves a glyph, and every part of it names the nearest`() {
        val row = listOf(CircleServiceBox("gps", 20, 6))
        val tight = circleServiceSeats(List(3) { row }, gap = 4, width = 20)
        val roomy = circleServiceSeats(List(3) { row }, gap = 4, width = 20, minHeight = 72)

        assertEquals("three tight rows of ink", 18, tight.height)
        assertEquals(72, roomy.height)
        assertEquals("the rows stay 6 apart, as drawn", listOf(0, 6, 12), tight.seats.map { it.y })
        assertEquals("and stay 6 apart in the larger room, centred", listOf(27, 33, 39), roomy.seats.map { it.y })
        // Every press in that room lands on the row nearest it, top to bottom.
        assertEquals("gps", circleServiceKeyAt(roomy.seats, 10, 0))
        assertEquals("gps", circleServiceKeyAt(roomy.seats, 10, 71))
    }

    @Test
    fun `a second row is pressed as its own row, so a press there never names the row above`() {
        val seats = circleServiceSeats(
            listOf(listOf(CircleServiceBox("gps", 20, 6)), listOf(CircleServiceBox("baro", 30, 6))),
            gap = 4, width = 30,
        ).seats

        assertEquals("gps", circleServiceKeyAt(seats, 10, 3))
        assertEquals("baro", circleServiceKeyAt(seats, 10, 9))
        // A short row is centred, and its glyph draws in its own band.
        assertEquals(5, seats.first().x)
        assertEquals(6, seats.last().y)
    }
}
