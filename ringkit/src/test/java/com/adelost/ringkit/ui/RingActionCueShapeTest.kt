package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The three shapes one centre cue takes, and when it takes them. Ported from
 * Skyvw with the cue itself (skyvw:0 row 52): the product carried a second
 * renderer for a language the kit owns, so the law moved here with its
 * evidence rather than being rewritten from the pixels.
 *
 * A tapped row must say what it just did. Every row already publishes its
 * sentence with the confirmation, and the last `when` used to throw it away
 * and draw the bare acknowledgement (Mattias 2026-08-06: "långtryck visar
 * redan förklaringen i mitten — det som saknas är att en vanlig dutt visar
 * den kort").
 */
class RingActionCueShapeTest {

    private fun cue(
        confirmed: Boolean,
        hint: String? = "Which map the ground is drawn from.",
        value: String? = "SATELLITE",
    ) = CircleActionCue(
        icon = RingIcons.Map,
        label = "GROUND",
        progress = if (confirmed) 1f else 0.4f,
        confirmed = confirmed,
        value = value,
        hint = hint,
    )

    @Test
    fun `a tap that changed something keeps the sentence that explains it`() {
        assertEquals(RingActionCueShape.SETTLED_EXPLAIN, ringActionCueShapeFor(cue(confirmed = true)))
    }

    @Test
    fun `a row still being decided covers the face`() {
        assertEquals(RingActionCueShape.DECIDING, ringActionCueShapeFor(cue(confirmed = false)))
    }

    /**
     * The deciding shape reveals its sentence as a function of hold progress,
     * which is right while a ring is filling and wrong for an answer to a press
     * that already ended: that press fired nothing, so its progress is honestly
     * zero and the deciding shape drew the explanation perfectly, at zero
     * alpha. Measured on wear34: published, carried, invisible.
     */
    @Test
    fun `an answer to an abandoned press is never drawn by hold progress`() {
        val abandoned = cue(confirmed = false).copy(progress = 0f, lingers = true)

        assertEquals(RingActionCueShape.SETTLED_EXPLAIN, ringActionCueShapeFor(abandoned))
        assertTrue("a requested answer uses the closeable disclosure", abandoned.isInformation)
        assertEquals(false, cue(confirmed = true).isInformation)
    }

    @Test
    fun `a confirmation with nothing to say stays a bare pulse`() {
        assertEquals(
            RingActionCueShape.BARE,
            ringActionCueShapeFor(cue(confirmed = true, hint = null, value = null)),
        )
    }

    @Test
    fun `a confirmation that only names its new value stays a bare pulse`() {
        // The bare cue already prints the value. Promoting it to a card would
        // turn every toggle in the product into a paragraph.
        assertEquals(RingActionCueShape.BARE, ringActionCueShapeFor(cue(confirmed = true, hint = null)))
    }

    @Test
    fun `the more a settled cue has to say the longer it stays`() {
        val bare = cue(confirmed = true, hint = null, value = null).dwellMs
        val valueOnly = cue(confirmed = true, hint = null).dwellMs
        val sentence = cue(confirmed = true).dwellMs
        assertTrue("a value earns more than a pulse", valueOnly > bare)
        assertTrue("a sentence earns more than a value", sentence > valueOnly)
    }

    @Test
    fun `a worst-case hint is readable inside the window it was written for`() {
        // The dwell is derived from MenuDesign.hintMaxChars, so widening the
        // hint budget silently lengthens every confirmation in every product.
        // This is where that trade becomes a decision instead of a side effect.
        val dwell = cue(confirmed = true, hint = "x".repeat(MenuDesign.hintMaxChars)).dwellMs
        assertTrue("a full hint must not flash past, was $dwell ms", dwell >= 2_000L)
        assertTrue("a confirmation must not become a wall, was $dwell ms", dwell <= 3_500L)
    }

    /** The explanation is help, not decoration, so it must not tax the people
     *  who do not need it (Mattias 2026-07-27: "är uxen här vettig tror du?"). */
    @Test
    fun `a confident press sees no explanation, a lingering one gets all of it`() {
        assertEquals(0f, explainReveal(0f), 0.001f)
        assertEquals(0f, explainReveal(0.35f), 0.001f)
        assertEquals(1f, explainReveal(0.85f), 0.001f)
        assertEquals(1f, explainReveal(1f), 0.001f)
        assertEquals("progress outside the unit range still resolves", 0f, explainReveal(-1f), 0.001f)
        assertEquals(1f, explainReveal(2f), 0.001f)
    }

    @Test
    fun `the reveal is monotonic and never leaves the unit range`() {
        var previous = -1f
        for (step in 0..100) {
            val value = explainReveal(step / 100f)
            assertTrue("reveal must stay a fraction, was $value", value in 0f..1f)
            assertTrue("reveal must not go backwards at $step", value >= previous)
            previous = value
        }
    }

    /**
     * Scrim and text used to ramp on the SAME reveal, so mid-hold the face
     * showed a half-faded sentence over half-faded rows — text on text
     * (Mattias 2026-08-17, the ONE FINGER peek over AUTO-UPDATE).
     */
    @Test
    fun `the scrim always carries the sentence it sits under`() {
        for (step in 0..100) {
            val reveal = explainReveal(step / 100f)
            if (reveal > 0f) {
                assertTrue(
                    "scrim must lead the text at reveal $reveal",
                    explainScrimAlpha(reveal) >= reveal * explainScrimAlpha(1f),
                )
            }
        }
        assertEquals(explainScrimAlpha(1f), explainScrimAlpha(0.5f), 0.001f)
    }
}
