package com.adelost.designkit.ui

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
    val activeContour = circleBrandColor()
    val progressContour = circleBrandColor()
    // The start screen's language everywhere (Mattias 2026-07-21: "samma
    // ljusstyrka som på huvudsidan"): the icon always speaks at full
    // strength — the RING alone carries state, neutral unless the toggle
    // is ON. One shared contour renderer, so a row ring can never weigh
    // differently from a launcher or home ring again.
    //
    // A reading keeps the icon and keeps the SIZE — the list's titles still
    // line up down a straight edge, and nothing moves when a row's action
    // appears or goes away. Only the circle is withheld, because only the
    // circle was making a promise (see [CircleRowAffordance]).
    val contour = circleRowRingContour(affordance, active, activeContour)
    Box(
        modifier = Modifier
            .size(phoneDesign?.rowIconDiameter ?: MenuDesign.iconRingDiameter)
            .clip(CircleShape)
            .then(contour?.let { Modifier.circleRingContour(it) } ?: Modifier)
            .circleProgressContour(feedbackSweep, color = progressContour),
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) {
            CircleStyledIcon(
                style = ringIconStyle(icon, accent),
                contentDescription = null,
                tintOverride = semanticColor,
                modifier = Modifier.size(phoneDesign?.rowIconSize ?: MenuDesign.iconSize).rotate(iconRotationDeg),
            )
        } else {
            CircleText(
                text = requireNotNull(centerValue),
                color = semanticColor ?: circleAccentColor(accent),
                fontSizeSp = (phoneDesign?.rowCenterValueSize ?: MenuDesign.rowCenterValueSize).value,
                fontWeight = FontWeight.Black,
                tabularNumerals = true,
                maxLines = 1,
            )
        }
    }
}
