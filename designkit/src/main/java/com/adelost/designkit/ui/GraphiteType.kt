package com.adelost.designkit.ui

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.adelost.designkit.R

/**
 * Cross-product Graphite type. Onest — a warm humanist sans that stands in
 * for Claude's proprietary "Anthropic Sans" (which can't be redistributed) —
 * ships as ONE variable ttf owned by designkit (`res/font/onest.ttf`).
 *
 * designkit is the single font provider (port contract 2026-07-18): app
 * modules read [Sans] and carry no font copy of their own, so two drifting
 * font families are unrepresentable. The variable font's weight axis is
 * driven by Compose's default variationSettings (derived from each
 * [FontWeight]), so one file covers 400–900.
 */
object GraphiteType {
    /** The one product sans family, built from designkit's own resource. */
    val Sans: FontFamily by lazy { sans(R.font.onest) }

    /**
     * The numeral face: Barlow Semi Condensed, narrow instrument digits for values, counts, dates and times, while
     * words stay in [Sans]. A product's approved design set its numbers in it and its owner chose it over Onest's
     * digits (Skyvw logbook, 2026-10-09: "jag gillar fonten bättre som var i skissen"). designkit ships its two
     * weights; a lighter request meets SemiBold.
     */
    val Numerals: FontFamily by lazy {
        FontFamily(
            Font(R.font.barlow_semi_condensed_semibold, weight = FontWeight.SemiBold),
            Font(R.font.barlow_semi_condensed_bold, weight = FontWeight.Bold),
        )
    }

    /**
     * Every weight a caller requests must be registered here: Compose matches
     * an unregistered weight to the nearest registered one, so a missing entry
     * silently renders lighter instead of failing. The altitude hero asks for
     * Black and shipped at Bold for exactly that reason.
     */
    private fun sans(onestResId: Int): FontFamily = FontFamily(
        Font(onestResId, weight = FontWeight.Normal),
        Font(onestResId, weight = FontWeight.Medium),
        Font(onestResId, weight = FontWeight.SemiBold),
        Font(onestResId, weight = FontWeight.Bold),
        Font(onestResId, weight = FontWeight.ExtraBold),
        Font(onestResId, weight = FontWeight.Black),
    )

    /**
     * Onest's default numerals are proportional (a "1" is nearly half the
     * width of a "0"), so a live-ticking readout wobbles as its digits change.
     * Instruments opt in to the font's tabular-numerals feature instead —
     * every digit on one fixed width, like the system default the dial was
     * designed against.
     */
    const val TABULAR_NUMERALS: String = "tnum"
}
