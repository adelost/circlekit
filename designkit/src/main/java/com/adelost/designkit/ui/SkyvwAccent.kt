package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color

/**
 * The product-wide colour vocabulary for icons and thin strokes.
 *
 * Catalogs describe meaning with this enum; shared atoms resolve the actual
 * pigment. This keeps Watch and Phone identical and keeps raw colours out of
 * navigation/presentation data. Surfaces remain OLED black.
 */
enum class SkyvwAccent {
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
enum class SkyvwAccentStrength { ACTIVE, SUPPORTING, INACTIVE }

fun skyvwAccentColor(
    accent: SkyvwAccent,
    strength: SkyvwAccentStrength = SkyvwAccentStrength.ACTIVE,
): Color {
    val base = when (accent) {
        SkyvwAccent.NEUTRAL -> GraphiteTokens.Ink
        SkyvwAccent.SKY -> Color(0xFF56B9DD)
        SkyvwAccent.SUN -> Color(0xFFF4D06F)
        SkyvwAccent.CLOUD -> GraphiteTokens.Muted
        SkyvwAccent.RAIN -> Color(0xFF719FC5)
        SkyvwAccent.COLD -> Color(0xFFD7E7EE)
        SkyvwAccent.POSITIVE -> GraphiteTokens.Green
        SkyvwAccent.CAUTION -> GraphiteTokens.Orange
        SkyvwAccent.DANGER -> GraphiteTokens.Red
        SkyvwAccent.ACHIEVEMENT -> Color(0xFFE8B95A)
        SkyvwAccent.VIOLET -> Color(0xFFA289D0)
    }
    if (accent == SkyvwAccent.NEUTRAL) {
        return when (strength) {
            SkyvwAccentStrength.ACTIVE -> GraphiteTokens.Ink
            SkyvwAccentStrength.SUPPORTING -> GraphiteTokens.Muted
            SkyvwAccentStrength.INACTIVE -> GraphiteTokens.Faint
        }
    }
    return base.copy(
        alpha = when (strength) {
            SkyvwAccentStrength.ACTIVE -> 1f
            SkyvwAccentStrength.SUPPORTING -> 0.66f
            SkyvwAccentStrength.INACTIVE -> 0.38f
        },
    )
}
