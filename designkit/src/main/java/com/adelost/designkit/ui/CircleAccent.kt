package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color

/**
 * The product-wide colour vocabulary for icons and thin strokes.
 *
 * Catalogs describe meaning with this enum; shared atoms resolve the actual
 * pigment. This keeps Watch and Phone identical and keeps raw colours out of
 * navigation/presentation data. Surfaces remain OLED black.
 */
enum class CircleAccent {
    NEUTRAL,
    SKY,
    SUN,
    CLOUD,
    RAIN,
    COLD,
    POSITIVE,
    CAUTION,
    DANGER,
    ACHIEVEMENT,
    VIOLET,
}

/** Shape carries state; strength only changes how loudly the colour speaks. */
enum class CircleAccentStrength { ACTIVE, SUPPORTING, INACTIVE }

fun circleAccentColor(
    accent: CircleAccent,
    strength: CircleAccentStrength = CircleAccentStrength.ACTIVE,
): Color {
    val base = when (accent) {
        CircleAccent.NEUTRAL -> GraphiteTokens.Ink
        CircleAccent.SKY -> Color(0xFF56B9DD)
        CircleAccent.SUN -> Color(0xFFF4D06F)
        CircleAccent.CLOUD -> GraphiteTokens.Muted
        CircleAccent.RAIN -> Color(0xFF719FC5)
        CircleAccent.COLD -> Color(0xFFD7E7EE)
        CircleAccent.POSITIVE -> GraphiteTokens.Green
        CircleAccent.CAUTION -> GraphiteTokens.Orange
        CircleAccent.DANGER -> GraphiteTokens.Red
        CircleAccent.ACHIEVEMENT -> Color(0xFFE8B95A)
        CircleAccent.VIOLET -> Color(0xFFA289D0)
    }
    if (accent == CircleAccent.NEUTRAL) {
        return when (strength) {
            CircleAccentStrength.ACTIVE -> GraphiteTokens.Ink
            CircleAccentStrength.SUPPORTING -> GraphiteTokens.Muted
            CircleAccentStrength.INACTIVE -> GraphiteTokens.Faint
        }
    }
    return base.copy(
        alpha = when (strength) {
            CircleAccentStrength.ACTIVE -> 1f
            CircleAccentStrength.SUPPORTING -> 0.66f
            CircleAccentStrength.INACTIVE -> 0.38f
        },
    )
}
