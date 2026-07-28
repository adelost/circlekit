package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * User-selectable accent families. The enum name is the persisted contract;
 * [optionLabel] is presentation only.
 *
 * The selected family colours interaction, progress and active contours.
 * Altitude colours may vary only through the curated palette below: their
 * semantic hues and ordering remain stable while chroma/lightness change.
 */
enum class CircleColorTheme(
    val optionLabel: String,
    val shortLabel: String,
    val character: String,
) {
    SEA_GLASS("SEA GLASS", "SEA", "BALANCED"),
    /** Persisted name retained from 0.5.562; presentation is the functional profile. */
    CYAN("FLAT CYAN", "FLAT", "CLEAN"),
    STEEL("MUTED", "MUTED", "QUIET"),
    VIOLET("HIGH CONTRAST", "CONTRAST", "SUNLIGHT"),
}

/**
 * One Material-style tonal family generated in OKLCH. Every role keeps a
 * common hue while lightness and chroma change monotonically, avoiding the
 * muddy midpoints produced by RGB alpha ladders.
 */
data class CircleColorScheme(
    val theme: CircleColorTheme,
    val highlight: Color,
    val active: Color,
    val supporting: Color,
    val container: Color,
    val subdued: Color,
    val altitude: CircleAltitudeColorScheme,
)

/**
 * Curated variants of the dial's established semantic hues. Themes may tune
 * lightness/chroma, never swap meaning: sky stays blue, time stays green,
 * break-off amber, pull red and hard deck purple.
 */
data class CircleAltitudeColorScheme(
    val blue: Color,
    val blueActive: Color,
    val green: Color,
    val greenActive: Color,
    val amber: Color,
    val amberActive: Color,
    val red: Color,
    val redActive: Color,
    val purple: Color,
    val purpleActive: Color,
    val approach: Color,
)

object CircleColorSchemes {
    val SeaGlass = CircleColorScheme(
        theme = CircleColorTheme.SEA_GLASS,
        highlight = Color(0xFFA2D7D2), // OKLCH 84% .055 190°
        active = Color(0xFF79B8B4),    // OKLCH 74% .065 190°
        supporting = Color(0xFF689693),
        container = Color(0xFF213E3C),
        subdued = Color(0xFF52706D),
        altitude = CircleAltitudeColorScheme(
            blue = Color(0xFF2F6F92),
            blueActive = Color(0xFF38BDF8),
            green = Color(0xFF34C36B),
            greenActive = Color(0xFF34C36B),
            amber = Color(0xFF836829),
            amberActive = Color(0xFFF4C542),
            red = Color(0xFF7F3336),
            redActive = Color(0xFFEF5350),
            purple = Color(0xFF473A6A),
            purpleActive = Color(0xFFC084FC),
            approach = Color.White,
        ),
    )
    val Cyan = CircleColorScheme(
        theme = CircleColorTheme.CYAN,
        highlight = Color(0xFFA4DCE8), // wider lightness steps, no gradients
        active = Color(0xFF70BDCF),
        supporting = Color(0xFF5D96A3),
        container = Color(0xFF17383F),
        subdued = Color(0xFF496B73),
        altitude = CircleAltitudeColorScheme(
            blue = Color(0xFF2C759A),
            blueActive = Color(0xFF45C4F4),
            green = Color(0xFF39B96D),
            greenActive = Color(0xFF56D783),
            amber = Color(0xFF9C792B),
            amberActive = Color(0xFFF1C648),
            red = Color(0xFF943C40),
            redActive = Color(0xFFF16462),
            purple = Color(0xFF55447A),
            purpleActive = Color(0xFFB99BE7),
            approach = Color.White,
        ),
    )
    val Steel = CircleColorScheme(
        theme = CircleColorTheme.STEEL,
        highlight = Color(0xFFB5CBC8), // low-chroma blue-green
        active = Color(0xFF8EA8A5),
        supporting = Color(0xFF748A88),
        container = Color(0xFF293938),
        subdued = Color(0xFF596A68),
        altitude = CircleAltitudeColorScheme(
            blue = Color(0xFF3E6577),
            blueActive = Color(0xFF6FA7BE),
            green = Color(0xFF3D6950),
            greenActive = Color(0xFF71A887),
            amber = Color(0xFF6C6242),
            amberActive = Color(0xFFB2A36A),
            red = Color(0xFF67474A),
            redActive = Color(0xFFB47C7F),
            purple = Color(0xFF514A64),
            purpleActive = Color(0xFF8F84A7),
            approach = Color(0xFFD1D5D4),
        ),
    )
    val Violet = CircleColorScheme(
        theme = CircleColorTheme.VIOLET,
        highlight = Color(0xFFC3FFF7), // maximal OLED/sunlight separation
        active = Color(0xFF83E6D9),
        supporting = Color(0xFF76BFB6),
        container = Color(0xFF123D38),
        subdued = Color(0xFF4F7975),
        altitude = CircleAltitudeColorScheme(
            blue = Color(0xFF174B65),
            blueActive = Color(0xFF3BD5FF),
            green = Color(0xFF145E37),
            greenActive = Color(0xFF4BE883),
            amber = Color(0xFF654A08),
            amberActive = Color(0xFFFFD84A),
            red = Color(0xFF651E24),
            redActive = Color(0xFFFF6668),
            purple = Color(0xFF372052),
            purpleActive = Color(0xFFD4A4FF),
            approach = Color.White,
        ),
    )

    val all: List<CircleColorScheme> = listOf(SeaGlass, Cyan, Steel, Violet)
    val default: CircleColorScheme = SeaGlass

    fun resolve(theme: CircleColorTheme): CircleColorScheme =
        all.first { it.theme == theme }
}

val LocalCircleColorScheme = staticCompositionLocalOf { CircleColorSchemes.default }

@Composable
fun CircleColorSchemeProvider(
    theme: CircleColorTheme,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(
        LocalCircleColorScheme provides CircleColorSchemes.resolve(theme),
        content = content,
    )
}

/** The selected product accent at the same loudness ladder as semantic icons. */
@Composable
fun circleBrandColor(
    strength: CircleAccentStrength = CircleAccentStrength.ACTIVE,
): Color = when (strength) {
    CircleAccentStrength.ACTIVE -> LocalCircleColorScheme.current.active
    CircleAccentStrength.SUPPORTING -> LocalCircleColorScheme.current.supporting
    CircleAccentStrength.INACTIVE -> LocalCircleColorScheme.current.subdued
}
