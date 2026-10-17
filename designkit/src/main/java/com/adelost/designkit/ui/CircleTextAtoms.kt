package com.adelost.designkit.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
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

/**
 * What every [CircleText] under it laid out: its text and the measured layout, on each layout pass. For tests and
 * debug hosts, which need the letters a face really holds; ink shows height, not whether a line was ellipsised. A row
 * whose action speaks for it clears its title's text semantics, so this is the only reading of that title. Null, the
 * default, lays out exactly as before.
 */
val LocalCircleTextLayouts = staticCompositionLocalOf<((text: String, layout: TextLayoutResult) -> Unit)?> { null }

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
