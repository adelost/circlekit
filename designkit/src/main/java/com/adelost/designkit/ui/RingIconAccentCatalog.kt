package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * One semantic home for RingIcons. Ordinary actions stay warm-white; product
 * or framework components opt into colour only when it carries meaning.
 */
/** THE enumerable icon registry: the ICONS gallery renders exactly this
 * list — an icon outside the catalog does not exist for product UI (Mattias 2026-07-21:
 * "man får bara använda ikoner från icons ... någon datadriven referens"). */
val RING_ICON_CATALOG: List<ImageVector> = PORTABLE_RING_ICON_CATALOG

/** DEV → ICONS → STYLE: the FILLED home-language set or the OUTLINE set. */
enum class CircleIconSetStyle { FILLED, OUTLINE }

val LocalCircleIconSetStyle = androidx.compose.runtime.staticCompositionLocalOf { CircleIconSetStyle.FILLED }

/** Style resolution by icon name. Vectors outside the catalog (frozen
 * Material baseline, HUD chrome) render themselves in both styles —
 * deliberate pass-through, not a fallback. */
fun circleIconVariant(icon: ImageVector, style: CircleIconSetStyle): ImageVector =
    if (style == CircleIconSetStyle.OUTLINE) RING_ICON_OUTLINE_BY_NAME[icon.name] ?: icon else icon

@Suppress("UNUSED_PARAMETER")
fun ringIconAccent(icon: ImageVector?): CircleAccent = CircleAccent.NEUTRAL

/** A composable glyph is a stack of vectors sharing the same 24x24 viewport. */
@Immutable
data class CircleIconLayer(
    val icon: ImageVector,
    val accent: CircleAccent,
)

/**
 * Declarative artwork plus semantic pigment. A one-layer style is a normal
 * icon; weather can stack independently coloured strokes without a new
 * renderer or a screen-local colour table.
 */
@Immutable
data class CircleIconStyle(
    val layers: List<CircleIconLayer>,
    val primaryAccent: CircleAccent = layers.last().accent,
) {
    init {
        require(layers.isNotEmpty()) { "An icon style needs at least one layer" }
    }
}

private fun singleStyle(icon: ImageVector, accent: CircleAccent) =
    CircleIconStyle(listOf(CircleIconLayer(icon, accent)))

/**
 * Resolves an icon through the catalog. A genuinely explicit semantic colour
 * deliberately collapses a composite icon to monochrome; the normal catalog
 * accent preserves all declared layers.
 */
fun ringIconStyle(
    icon: ImageVector,
    accentOverride: CircleAccent? = null,
): CircleIconStyle {
    val catalogAccent = ringIconAccent(icon)
    if (accentOverride != null && accentOverride != catalogAccent) {
        return singleStyle(icon, accentOverride)
    }
    return PORTABLE_COMPOSITE_ICON_STYLES[icon.name]
        ?: singleStyle(icon, accentOverride ?: catalogAccent)
}

/** Stable UI vocabulary at the weather/data boundary. */
enum class CircleWeatherSymbol { UNKNOWN, CLEAR, PARTLY_CLOUDY, CLOUDY, FOG, RAIN, SNOW, STORM }

/** Every weather surface consumes these same centrally coloured glyphs. */
fun circleWeatherIconStyle(symbol: CircleWeatherSymbol): CircleIconStyle = when (symbol) {
    CircleWeatherSymbol.UNKNOWN -> singleStyle(RingIcons.Cloud, CircleAccent.NEUTRAL)
    CircleWeatherSymbol.CLEAR -> singleStyle(RingIcons.Sun, CircleAccent.SUN)
    CircleWeatherSymbol.PARTLY_CLOUDY -> ringIconStyle(RingIcons.CloudSun)
    CircleWeatherSymbol.CLOUDY -> singleStyle(RingIcons.Cloud, CircleAccent.CLOUD)
    CircleWeatherSymbol.FOG -> singleStyle(RingIcons.Fog, CircleAccent.CLOUD)
    CircleWeatherSymbol.RAIN -> ringIconStyle(RingIcons.Rain)
    CircleWeatherSymbol.SNOW -> singleStyle(RingIcons.Snow, CircleAccent.COLD)
    CircleWeatherSymbol.STORM -> ringIconStyle(RingIcons.Storm)
}
