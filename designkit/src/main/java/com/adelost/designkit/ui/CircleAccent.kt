package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * The product-wide colour vocabulary for icons and thin strokes.
 *
 * Catalogs describe meaning with this enum; shared atoms resolve the actual
 * pigment through the [CircleAccentPalette] in scope. This keeps Watch and Phone
 * identical and keeps raw colours out of navigation/presentation data.
 * Surfaces remain OLED black.
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
    PLACE,
    SOUND,
}

/** Shape carries state; strength only changes how loudly the colour speaks. */
enum class CircleAccentStrength { ACTIVE, SUPPORTING, INACTIVE }

/**
 * The pigment of every accent, as tones. A product supplies its own from its palette
 * ([CircleAccentPaletteProvider]), so its colours are written once, in its declaration; [Default] is the house
 * style's (circlekit-assets/src/circle-style.ts `CIRCLEKIT_ACCENTS`).
 */
@Immutable
class CircleAccentPalette(private val tones: Map<CircleAccent, CircleTones>) {
    init {
        val missing = CircleAccent.entries.filterNot(tones::containsKey)
        require(missing.isEmpty()) { "an accent palette colours every accent; missing $missing" }
    }

    fun tones(accent: CircleAccent): CircleTones = tones.getValue(accent)

    /** ACTIVE is the strong tone, SUPPORTING an icon disc's edge, INACTIVE the dimmed tone. */
    fun color(accent: CircleAccent, strength: CircleAccentStrength = CircleAccentStrength.ACTIVE): Color {
        val tones = tones(accent)
        return when (strength) {
            CircleAccentStrength.ACTIVE -> tones.strong
            CircleAccentStrength.SUPPORTING -> tones.edge
            CircleAccentStrength.INACTIVE -> tones.dim
        }
    }

    companion object {
        val Default = CircleAccentPalette(CIRCLE_ACCENT_DEFAULT_TONES)
    }
}

val LocalCircleAccentPalette = staticCompositionLocalOf { CircleAccentPalette.Default }

/** Colours every accent below with [palette]: the product's own declaration, not the kit's defaults. */
@Composable
fun CircleAccentPaletteProvider(palette: CircleAccentPalette, content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalCircleAccentPalette provides palette, content = content)
}

/** The tones of [accent] in the palette in scope. */
@Composable
fun circleAccentTones(accent: CircleAccent): CircleTones = LocalCircleAccentPalette.current.tones(accent)

/** [accent] at [strength] in the palette in scope. */
@Composable
fun circleAccentColor(
    accent: CircleAccent,
    strength: CircleAccentStrength = CircleAccentStrength.ACTIVE,
): Color = LocalCircleAccentPalette.current.color(accent, strength)
