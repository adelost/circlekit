package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.ui.graphics.Color
import com.adelost.ringkit.data.Health

/**
 * The one health reading in the kit: fresh, aging, and a value that is not
 * being kept up to date at all.
 *
 * [broken] is a parameter because the products disagree on one branch and only
 * one of them can be right for a given face. A tool whose job is to report a
 * failure says so in red; an instrument a person flies with says "this number
 * is not being updated" without a warning colour that means something else at
 * altitude (Skyvw's freshness law, skyvw:0 rows 35 and 49: grey when it should
 * update and cannot, never red). Stating it at the call keeps both honest
 * instead of leaving a second copy of the whole mapping in the product.
 */
fun Health.ringColor(broken: Color = RingTokens.Broken): Color = when (this) {
    Health.FRESH -> RingTokens.Fresh
    Health.AGING -> RingTokens.Aging
    Health.BROKEN -> broken
    Health.OFF -> RingTokens.Off
}
