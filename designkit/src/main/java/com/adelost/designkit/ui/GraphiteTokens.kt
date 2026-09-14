package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Cross-product Cinematic Graphite tokens. These values mirror Trackbook's
 * CSS variables; platform components may change density, never semantics.
 */
object GraphiteTokens {
    val Canvas = CircleStyleTokens.Surface
    val CanvasSoft = Color(0xFF151719)
    val Surface = Color(0xFF1A1D20)
    val SurfaceStrong = Color(0xFF1D2023)
    val Border = CircleStyleTokens.Action.copy(alpha = 0.09f)
    val BorderStrong = CircleStyleTokens.Action.copy(alpha = 0.18f)
    val Ink = CircleStyleTokens.Action
    val Muted = CircleStyleTokens.ActionMuted
    val Faint = CircleStyleTokens.Faint
    // Generic actions are flat warm white. Sea Glass is semantic data colour,
    // never an automatic accent chosen merely because a control has an icon.
    val Primary = CircleStyleTokens.Action
    val PrimaryInk = CircleStyleTokens.Surface
    val PrimaryStrong = CircleStyleTokens.Action
    val Blue = CircleColorSchemes.SeaGlass.active
    val Orange = Color(0xFFE2AF32)
    val Red = Color(0xFFED6863)
    val Green = Color(0xFF63C375)
    // The step after Red on an altitude scale (below the hard deck), at Red's
    // OKLab lightness (0.68) so a thin stroke on OLED stays legible; the
    // altitude scheme's purple (0.39) is a dial-bar fill, too dark for a line.
    val Purple = Color(0xFF9C87D9)
}

object GraphiteMetrics {
    val RadiusSmall = 8.dp
    val Radius = 12.dp
    val RadiusLarge = 20.dp
    val ControlHeight = 48.dp
    val PageGutter = 20.dp
}
