package com.adelost.designkit.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * The wear-free text/icon primitives every SHARED Skyvw screen renders
 * through (port contract, docs/plans/2026-07-18-phone-responsive-port.md).
 * Wear and phone hosts both get exactly this rendering — one font family
 * ([GraphiteType.Sans]), one sizing rule — so a shared screen cannot fork
 * typography per form factor.
 *
 * Sizing rule: sizes are passed as raw sp floats and resolved through
 * [skyvwFixedSp] — the same compensation as `fixedSkyvwUiSp`/`swSp`:
 * approved atom sizes scale with the profile's atomScale (locked 1x today)
 * and are DIVIDED by any system font-scale above 1, so accessibility
 * font settings and viewport swaps never inflate an approved atom.
 */
@Composable
fun skyvwFixedSp(baseSp: Float): TextUnit {
    val fontScale = LocalDensity.current.fontScale
    val atomScale = LocalSkyvwUiProfile.current.atomScale
    return fixedSkyvwUiSp(baseSp * atomScale, fontScale).sp
}

@Composable
fun SkyvwText(
    text: String,
    color: Color,
    fontSizeSp: Float,
    modifier: Modifier = Modifier,
    fontWeight: FontWeight = FontWeight.Normal,
    letterSpacingSp: Float = 0f,
    textAlign: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    tabularNumerals: Boolean = false,
    /** WatchExact ports set this to the line height the Wear theme used to
     *  inject (wear body1 carries lineHeight 20.sp that every wear `Text`
     *  inherited regardless of its own fontSize). Null = natural metrics. */
    lineHeightSp: Float? = null,
    /** Measured layout, for callers that must react to overflow (a row title
     *  that shrinks rather than losing letters). */
    onTextLayout: ((androidx.compose.ui.text.TextLayoutResult) -> Unit)? = null,
) {
    BasicText(
        text = text,
        modifier = modifier,
        style = TextStyle(
            color = color,
            fontFamily = GraphiteType.Sans,
            fontSize = skyvwFixedSp(fontSizeSp),
            fontWeight = fontWeight,
            // Do not call skyvwFixedSp(0): zero means "unspecified", while
            // fixedSkyvwUiSp deliberately accepts only visible positive atoms.
            letterSpacing = letterSpacingSp
                .takeIf { it > 0f }
                ?.let { skyvwFixedSp(it) }
                ?: TextUnit.Unspecified,
            textAlign = textAlign ?: TextAlign.Unspecified,
            fontFeatureSettings = if (tabularNumerals) GraphiteType.TABULAR_NUMERALS else null,
            lineHeight = lineHeightSp?.let { skyvwFixedSp(it) } ?: TextUnit.Unspecified,
            // Same explicit choice wear's DefaultTextStyle makes; pinned here
            // so a Compose default change can never fork watch/phone metrics.
            platformStyle = PlatformTextStyle(includeFontPadding = false),
        ),
        maxLines = maxLines,
        overflow = overflow,
        onTextLayout = onTextLayout,
    )
}

@Composable
fun SkyvwIcon(
    imageVector: ImageVector,
    contentDescription: String?,
    tint: Color,
    modifier: Modifier = Modifier,
) {
    Image(
        painter = rememberVectorPainter(imageVector),
        contentDescription = contentDescription,
        modifier = modifier,
        colorFilter = ColorFilter.tint(tint),
    )
}
