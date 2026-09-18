package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleUiProfiles
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.roundTitleTopPadding
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot

/**
 * The round escape grows to a run of three seats: gear, back, the page's one
 * switch (Mattias 2026-09-17, on a JUMP LOG picture: "bak-knapp, settings-knapp
 * och sen kanske rotationsknapp ... minst tre knappar alltid", and "helst vill
 * vi ha samma storlek på alla cirklarna"). Row 182's proposal chose it,
 * .agents/2/row182/PROPOSAL.md in the Skyvw repo.
 *
 * Everything here is geometry the glass has to satisfy at both faces the row
 * names, so the numbers are asserted, not drawn and eyeballed.
 */
class RingRoundTopRunTest {
    private val faces = listOf(192f, 320f)
    private val canvas = CircleUiProfiles.CANON_ROUND_CANVAS_DP

    @Test
    fun `the escape keeps its exact place, whatever the run is filled with`() {
        for (face in faces) {
            val scale = face / canvas
            val alone = roundTopRunSeatCenters(face, seats = 1).single()
            val (_, centre, _) = roundTopRunSeatCenters(face, seats = 3).let {
                Triple(it[0], it[1], it[2])
            }
            assertEquals("$face dp: one seat is the escape's own place", face / 2f, alone.first, 0.01f)
            assertEquals(
                "$face dp: the escape does not move when companions arrive",
                alone, centre,
            )
            assertEquals(
                "$face dp: and that place is the shared back layer's",
                MenuDesign.roundBackLayerCenterY.value * scale, centre.second, 0.01f,
            )
        }
    }

    @Test
    fun `three seats of one diameter sit on the glass with room to spare`() {
        for (face in faces) {
            val scale = face / canvas
            val radius = face / 2f
            val ink = MenuDesign.watchActionRingDiameter.value * scale / 2f
            val seats = roundTopRunSeatCenters(face, seats = MenuDesign.roundTopRunMaxSeats)
            assertEquals(MenuDesign.roundTopRunMaxSeats, seats.size)
            for ((x, y) in seats) {
                val fromCentre = hypot((x - radius).toDouble(), (y - radius).toDouble()).toFloat()
                assertTrue(
                    "$face dp: a seat's ink must stay on the glass, reached ${fromCentre + ink} of $radius",
                    fromCentre + ink <= radius,
                )
                // Every seat keeps the escape's own radius: the run is an arc.
                assertEquals("$face dp: one radius for the whole run",
                    (radius - MenuDesign.roundBackLayerCenterY.value * scale), fromCentre, 0.05f)
            }
            // Neighbours never share a pixel of target: the discs are exactly
            // MenuDesign.watchActionRingDiameter wide and their centres are further apart.
            val gap = hypot((seats[1].first - seats[0].first).toDouble(),
                (seats[1].second - seats[0].second).toDouble()).toFloat()
            assertTrue("$face dp: seats ${gap} apart must clear ${ink * 2} of disc", gap > ink * 2)
        }
    }

    @Test
    fun `a fourth seat is refused by the declaration, not drawn into the rows`() {
        for (seats in listOf(0, 4, 5)) {
            val refused = runCatching { roundTopRunSeatCenters(192f, seats) }.exceptionOrNull()
            assertTrue(
                "a $seats-seat run must be refused, was ${refused ?: "accepted"}",
                refused is IllegalArgumentException,
            )
        }
        // Two reasons, both as numbers on the 192 dp canon.
        // One: an even run has no seat at twelve, so the escape would have to
        // leave the place it has held since 2026-09-14.
        val fourSeatOffsets = listOf(-1.5f, -0.5f, 0.5f, 1.5f)
        assertTrue(
            "a four-seat run puts no seat at twelve: $fourSeatOffsets",
            fourSeatOffsets.none { it == 0f },
        )
        // Two: the next odd run, five, reaches into the row band this layer
        // exists to keep clear. Its outer seat sits two hours out.
        val fifthInkBottom = 96f - MenuDesign.roundTopRunRadius.value *
            kotlin.math.cos(Math.toRadians(2.0 * MenuDesign.roundTopRunStepDeg)).toFloat() +
            MenuDesign.watchActionRingDiameter.value / 2f
        assertTrue(
            "a five-seat run's outer ink would end at $fifthInkBottom dp, past the title at " +
                "${MenuDesign.roundTopRunContentTop.value}",
            fifthInkBottom > MenuDesign.roundTopRunContentTop.value,
        )
    }

    @Test
    fun `a filled seat pushes the title below its ink, an empty one changes nothing`() {
        assertEquals(
            "no companion: the title starts exactly where it did before the run existed",
            MenuDesign.roundBackLayerContentTop,
            roundTitleTopPadding(backLayer = true, companionSeats = false),
        )
        assertEquals(
            MenuDesign.roundTopRunContentTop,
            roundTitleTopPadding(backLayer = true, companionSeats = true),
        )
        assertTrue(
            "a companion's ink ends lower than the escape's, so the title has to",
            MenuDesign.roundTopRunContentTop > MenuDesign.roundBackLayerContentTop,
        )
        assertTrue(
            "and it clears that ink",
            MenuDesign.roundTopRunContentTop >=
                MenuDesign.roundTopRunSeatCenterY + MenuDesign.watchActionRingDiameter / 2,
        )
    }

    @Test
    fun `the run still costs a row no width at any scroll height`() {
        // The whole point of the layer: it reserves no rim slot. Adding seats to
        // it must not quietly start charging rows for chrome.
        assertEquals(emptyList<Any>(), roundBackHostReservation())
    }
}
