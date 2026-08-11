package com.adelost.renderkit.list

import androidx.compose.ui.graphics.Color
import com.adelost.designkit.ui.GraphiteTokens

/**
 * Declarative background intent for shared list surfaces.
 *
 * Hosts translate this value; shared rows and screens never hardcode a
 * form-factor background. OLED remains the default, while graphite is kept as
 * an explicit style for surfaces that deliberately need a lifted canvas.
 */
enum class SkyvwListBackground {
    OLED,
    GRAPHITE,
}

internal fun SkyvwListBackground.color(): Color = when (this) {
    SkyvwListBackground.OLED -> Color.Black
    SkyvwListBackground.GRAPHITE -> GraphiteTokens.Canvas
}
