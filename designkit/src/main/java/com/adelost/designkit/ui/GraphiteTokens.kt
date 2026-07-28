package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Cross-product Cinematic Graphite tokens. These values mirror Trackbook's
 * CSS variables; platform components may change density, never semantics.
 */
object GraphiteTokens {
    val Canvas = Color(0xFF111315)
    val CanvasSoft = Color(0xFF151719)
    val Surface = Color(0xFF1A1D20)
    val SurfaceStrong = Color(0xFF1D2023)
    val Border = Color(0x17F1EFE9)
    val BorderStrong = Color(0x2EF1EFE9)
    val Ink = Color(0xFFF1EFE9)
    val Muted = Color(0xFFA4A49F)
    val Faint = Color(0xFF727579)
    // Default accent is the mathematically balanced Sea Glass family.
    // Runtime-selected families are exposed through LocalCircleColorScheme.
    val Primary = CircleColorSchemes.SeaGlass.active
    val PrimaryInk = Color(0xFF121719)
    val PrimaryStrong = CircleColorSchemes.SeaGlass.highlight
    val Blue = Primary
    val Orange = Color(0xFFE2AF32)
    val Red = Color(0xFFED6863)
    val Green = Color(0xFF63C375)
}

object GraphiteMetrics {
    val RadiusSmall = 8.dp
    val Radius = 12.dp
    val RadiusLarge = 20.dp
    val ControlHeight = 48.dp
    val PageGutter = 20.dp
}
