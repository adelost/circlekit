package com.adelost.designkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight

/**
 * THE CIRCLE AT THE START OF A ROW, which is the one part of a row that carries state.
 *
 * Split out of CircleRingRow.kt in row 215, which stood at exactly 500 lines: the row is what a press on
 * it MEANS, and this is the one thing a row draws that is not words. It is also where a row paints the
 * wait, which is why the row tells the gesture its cue is already owned.
 */
@Composable
internal fun CircleRowLeadingRing(
    icon: ImageVector?,
    centerValue: String?,
    active: Boolean?,
    affordance: CircleRowAffordance,
    accent: CircleAccent,
    semanticColor: Color?,
    phoneDesign: PhoneSurfaceDesign?,
    feedbackSweep: () -> Float,
    iconRotationDeg: Float,
) {
    // Progress is the one action colour (the scheme in scope); the disc and the glyph speak the row's own kind
    // (circleRowDiscLook). A state is the scale's colour on the value (style C), so [semanticColor] colours a centre
    // value and never the glyph: the same icon has the same colour everywhere.
    val progressContour = circleBrandColor()
    val look = circleRowDiscLook(affordance, active, circleAccentTones(accent))
    val off = affordance.operable && active == false
    Box(
        modifier = Modifier
            .size(phoneDesign?.rowIconDiameter ?: MenuDesign.iconRingDiameter)
            .clip(CircleShape)
            .background(look.ground)
            .then(look.contour?.let { Modifier.circleRingContour(it) } ?: Modifier)
            .circleProgressContour(feedbackSweep, color = progressContour),
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) {
            CircleStyledIcon(
                style = ringIconStyle(icon, accent),
                contentDescription = null,
                strength = if (off) CircleAccentStrength.INACTIVE else CircleAccentStrength.ACTIVE,
                modifier = Modifier.size(phoneDesign?.rowIconSize ?: MenuDesign.iconSize).rotate(iconRotationDeg),
            )
        } else {
            CircleText(
                text = requireNotNull(centerValue),
                color = semanticColor ?: look.icon,
                fontSizeSp = (phoneDesign?.rowCenterValueSize ?: MenuDesign.rowCenterValueSize).value,
                fontWeight = FontWeight.Black,
                tabularNumerals = true,
                maxLines = 1,
            )
        }
    }
}
