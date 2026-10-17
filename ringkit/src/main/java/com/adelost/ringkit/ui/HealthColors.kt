package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.adelost.ringkit.data.Health

/**
 * The one health reading in the kit: fresh, aging, and a value that is not
 * being kept up to date at all, as the scale's ok, caution and danger in
 * [palette]; a source that is off is the grey that means off.
 *
 * [broken] is a parameter because the products disagree on one branch and only
 * one of them can be right for a given face. A tool whose job is to report a
 * failure says so in red; an instrument a person flies with says "this number
 * is not being updated" without a warning colour that means something else at
 * altitude (Skyvw's freshness law, skyvw:0 rows 35 and 49: grey when it should
 * update and cannot, never red). Stating it at the call keeps both honest
 * instead of leaving a second copy of the whole mapping in the product.
 *
 * [palette] is the kit's own tones for code that has no composition; a composable reads the palette in scope through
 * [stateColor], so a product's colours are the ones it declared (style C).
 */
fun Health.ringColor(
    broken: Color? = null,
    palette: CircleAccentPalette = CircleAccentPalette.Default,
): Color = when (this) {
    Health.FRESH -> palette.color(CircleAccent.POSITIVE)
    Health.AGING -> palette.color(CircleAccent.CAUTION)
    Health.BROKEN -> broken ?: palette.color(CircleAccent.DANGER)
    Health.OFF -> RingTokens.Off
}

/** [ringColor] in the palette in scope: the colour a composable paints a source's state with, on its value. */
@Composable
fun Health.stateColor(broken: Color? = null): Color = ringColor(broken, LocalCircleAccentPalette.current)
