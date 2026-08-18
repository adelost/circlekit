package com.adelost.designkit.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
 * The wear-free text/icon primitives every SHARED Circle screen renders
 * through (port contract, docs/plans/2026-07-18-phone-responsive-port.md).
 * Wear and phone hosts both get exactly this rendering — one font family
 * ([GraphiteType.Sans]), one sizing rule — so a shared screen cannot fork
 * typography per form factor.
 *
 * Sizing rule: sizes are passed as raw sp floats and resolved through
 * [circleFixedSp] — the same compensation as `fixedCircleUiSp`/`swSp`:
 * approved atom sizes scale with the profile's atomScale (locked 1x today)
 * and are DIVIDED by any system font-scale above 1, so accessibility
 * font settings and viewport swaps never inflate an approved atom.
 */
@Composable
fun circleFixedSp(baseSp: Float): TextUnit {
    val fontScale = LocalDensity.current.fontScale
    val atomScale = LocalCircleUiProfile.current.atomScale
    return fixedCircleUiSp(baseSp * atomScale, fontScale).sp
}

@Composable
fun CircleText(
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
            fontSize = circleFixedSp(fontSizeSp),
            fontWeight = fontWeight,
            // Do not call circleFixedSp(0): zero means "unspecified", while
            // fixedCircleUiSp deliberately accepts only visible positive atoms.
            letterSpacing = letterSpacingSp
                .takeIf { it > 0f }
                ?.let { circleFixedSp(it) }
                ?: TextUnit.Unspecified,
            textAlign = textAlign ?: TextAlign.Unspecified,
            fontFeatureSettings = if (tabularNumerals) GraphiteType.TABULAR_NUMERALS else null,
            lineHeight = lineHeightSp?.let { circleFixedSp(it) } ?: TextUnit.Unspecified,
            // Same explicit choice wear's DefaultTextStyle makes; pinned here
            // so a Compose default change can never fork watch/phone metrics.
            platformStyle = PlatformTextStyle(includeFontPadding = false),
        ),
        maxLines = maxLines,
        overflow = overflow,
        onTextLayout = onTextLayout,
    )
}

/**
 * Text that stays whole: renders at [fontSizeSp] and steps down as far as
 * [minFontSizeSp] when the measured line would not fit, so a wide surface is
 * unaffected and a narrow one loses weight instead of letters. Below the
 * floor it ellipsises — an unreadable label is worse than an honest "…".
 *
 * This is the row-title mechanism promoted to a shared atom: labels that
 * ellipsised mid-word ("GREAT VISIBILI…") did so because only CircleRingRow
 * could reach the shrink (Mattias 2026-08-17: labels truncate mid-word).
 */
@Composable
fun CircleFittedText(
    text: String,
    color: Color,
    fontSizeSp: Float,
    modifier: Modifier = Modifier,
    minFontSizeSp: Float = fontSizeSp * 0.75f,
    shrinkStepSp: Float = 0.5f,
    fontWeight: FontWeight = FontWeight.Normal,
    letterSpacingSp: Float = 0f,
    maxLines: Int = 1,
    tabularNumerals: Boolean = false,
    lineHeightSp: Float? = null,
) {
    var sizeSp by remember(text, fontSizeSp, maxLines) { mutableFloatStateOf(fontSizeSp) }
    CircleText(
        text = text,
        color = color,
        fontSizeSp = sizeSp,
        fontWeight = fontWeight,
        letterSpacingSp = letterSpacingSp,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        tabularNumerals = tabularNumerals,
        lineHeightSp = lineHeightSp,
        modifier = modifier,
        onTextLayout = { result ->
            if (result.hasVisualOverflow && sizeSp > minFontSizeSp) {
                sizeSp = (sizeSp - shrinkStepSp).coerceAtLeast(minFontSizeSp)
            }
        },
    )
}

@Composable
fun CircleIcon(
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
