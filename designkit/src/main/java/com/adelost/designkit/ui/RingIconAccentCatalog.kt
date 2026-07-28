package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * One semantic home for RingIcons. Rows may override a colour when live state
 * is more important, but ordinary menus get a recognizable colour without
 * screen-specific conditionals.
 */
internal val ICON_ACCENTS: Map<String, CircleAccent> = buildMap {
    register(CircleAccent.SUN, "sun", "cloud-sun", "cloud-sun-sun")
    register(CircleAccent.CLOUD, "cloud", "cloud-sun-cloud", "fog", "rain-cloud", "storm-cloud")
    register(CircleAccent.RAIN, "rain", "rain-drops", "wind", "sink-rate", "touchdown-sink")
    register(CircleAccent.COLD, "snow", "mountain", "moon", "thermometer")
    register(CircleAccent.DANGER, "storm", "storm-bolt", "cross", "trash", "record", "stop")
    register(
        CircleAccent.POSITIVE,
        "gps", "gps-points", "target", "activity", "chart", "download", "plus", "calendar",
        "ruler", "check", "touchdown-run",
    )
    register(
        CircleAccent.CAUTION,
        "gauge", "bell", "wrench", "minus", "zigzag", "warning", "gps-break", "rotation-rate",
    )
    register(CircleAccent.ACHIEVEMENT, "book", "flag", "star", "pitch")
    register(
        CircleAccent.VIOLET,
        "sliders", "gear", "vibrate", "layers", "cube", "palette", "clock", "pencil",
        "watch", "phone", "spatial-path", "roll",
    )
    register(
        CircleAccent.SKY,
        "map", "plane", "chute", "arrow", "eye", "eye-off", "speaker", "wifi", "refresh", "link",
        "home", "grid", "ground-track", "yaw",
    )
    register(
        CircleAccent.NEUTRAL,
        "freefly", "head-down", "belly-arch", "lock",
        "chevron-left", "chevron-right", "chevron-up", "chevron-down",
        "play", "pause",
    )
}

private fun MutableMap<String, CircleAccent>.register(accent: CircleAccent, vararg names: String) {
    names.forEach { name ->
        check(put(name, accent) == null) { "Ring icon '$name' has more than one semantic accent" }
    }
}

/** THE enumerable icon registry: the ICONS gallery renders exactly this
 * list, and IconCatalogTest pins it 1:1 against [ICON_ACCENTS] — an icon
 * outside the catalog does not exist for product UI (Mattias 2026-07-21:
 * "man får bara använda ikoner från icons ... någon datadriven referens"). */
val RING_ICON_CATALOG: List<ImageVector> = listOf(
    RingIcons.Sun, RingIcons.CloudSun, RingIcons.CloudSunSun, RingIcons.CloudSunCloud,
    RingIcons.Cloud, RingIcons.Fog, RingIcons.RainCloud, RingIcons.StormCloud,
    RingIcons.Rain, RingIcons.RainDrops, RingIcons.Wind,
    RingIcons.Snow, RingIcons.Mountain, RingIcons.Moon, RingIcons.Thermometer,
    RingIcons.Storm, RingIcons.StormBolt, RingIcons.Cross, RingIcons.Trash,
    RingIcons.Gps, RingIcons.Target, RingIcons.Activity, RingIcons.Chart,
    RingIcons.GroundTrack, RingIcons.SpatialPath, RingIcons.SinkRate,
    RingIcons.GpsPoints, RingIcons.GpsBreak,
    RingIcons.TouchdownRun, RingIcons.TouchdownSink,
    RingIcons.Yaw, RingIcons.Pitch, RingIcons.Roll, RingIcons.RotationRate,
    RingIcons.Download, RingIcons.Plus, RingIcons.Calendar, RingIcons.Ruler, RingIcons.Check,
    RingIcons.Gauge, RingIcons.Bell, RingIcons.Wrench, RingIcons.Minus,
    RingIcons.Zigzag, RingIcons.Warning,
    RingIcons.Book, RingIcons.Flag, RingIcons.Star,
    RingIcons.Sliders, RingIcons.Gear, RingIcons.Vibrate, RingIcons.Layers,
    RingIcons.Cube, RingIcons.Palette, RingIcons.Clock, RingIcons.Pencil,
    RingIcons.Map, RingIcons.Plane, RingIcons.Chute, RingIcons.Arrow,
    RingIcons.Eye, RingIcons.EyeOff, RingIcons.Speaker, RingIcons.Wifi,
    RingIcons.Refresh, RingIcons.Link,
    RingIcons.Freefly, RingIcons.HeadDown, RingIcons.BellyArch,
    RingIcons.ChevronLeft, RingIcons.ChevronRight, RingIcons.ChevronUp, RingIcons.ChevronDown,
    RingIcons.Home, RingIcons.Lock, RingIcons.Record, RingIcons.Stop,
    RingIcons.Grid, RingIcons.Watch, RingIcons.Phone,
    RingIcons.Play, RingIcons.Pause,
)

/** DEV → ICONS → STYLE: the FILLED home-language set or the OUTLINE set. */
enum class CircleIconSetStyle { FILLED, OUTLINE }

val LocalCircleIconSetStyle = androidx.compose.runtime.staticCompositionLocalOf { CircleIconSetStyle.FILLED }

/** Style resolution by icon name. Vectors outside the catalog (frozen
 * Material baseline, HUD chrome) render themselves in both styles —
 * deliberate pass-through, not a fallback. */
fun circleIconVariant(icon: ImageVector, style: CircleIconSetStyle): ImageVector =
    if (style == CircleIconSetStyle.OUTLINE) RING_ICON_OUTLINE_BY_NAME[icon.name] ?: icon else icon

fun ringIconAccent(icon: ImageVector?): CircleAccent =
    icon?.name?.let(ICON_ACCENTS::get) ?: CircleAccent.NEUTRAL

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

private val COMPOSITE_ICON_STYLES: Map<String, CircleIconStyle> by lazy {
    mapOf(
        RingIcons.CloudSun.name to CircleIconStyle(
            listOf(
                CircleIconLayer(RingIcons.CloudSunSun, CircleAccent.SUN),
                CircleIconLayer(RingIcons.CloudSunCloud, CircleAccent.CLOUD),
            ),
            primaryAccent = CircleAccent.SUN,
        ),
        RingIcons.Rain.name to CircleIconStyle(
            listOf(
                CircleIconLayer(RingIcons.RainCloud, CircleAccent.CLOUD),
                CircleIconLayer(RingIcons.RainDrops, CircleAccent.RAIN),
            ),
        ),
        RingIcons.Storm.name to CircleIconStyle(
            listOf(
                CircleIconLayer(RingIcons.StormCloud, CircleAccent.CLOUD),
                CircleIconLayer(RingIcons.StormBolt, CircleAccent.DANGER),
            ),
        ),
    )
}

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
    return COMPOSITE_ICON_STYLES[icon.name] ?: singleStyle(icon, accentOverride ?: catalogAccent)
}

/** Stable UI vocabulary at the weather/data boundary. */
enum class CircleWeatherSymbol { UNKNOWN, CLEAR, PARTLY_CLOUDY, CLOUDY, FOG, RAIN, SNOW, STORM }

/** Every weather surface consumes these same centrally coloured glyphs. */
fun circleWeatherIconStyle(symbol: CircleWeatherSymbol): CircleIconStyle = when (symbol) {
    CircleWeatherSymbol.UNKNOWN -> singleStyle(RingIcons.Cloud, CircleAccent.NEUTRAL)
    CircleWeatherSymbol.CLEAR -> ringIconStyle(RingIcons.Sun)
    CircleWeatherSymbol.PARTLY_CLOUDY -> ringIconStyle(RingIcons.CloudSun)
    CircleWeatherSymbol.CLOUDY -> ringIconStyle(RingIcons.Cloud)
    CircleWeatherSymbol.FOG -> ringIconStyle(RingIcons.Fog)
    CircleWeatherSymbol.RAIN -> ringIconStyle(RingIcons.Rain)
    CircleWeatherSymbol.SNOW -> ringIconStyle(RingIcons.Snow)
    CircleWeatherSymbol.STORM -> ringIconStyle(RingIcons.Storm)
}
