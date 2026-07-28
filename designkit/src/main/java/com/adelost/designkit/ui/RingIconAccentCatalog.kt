package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * One semantic home for RingIcons. Rows may override a colour when live state
 * is more important, but ordinary menus get a recognizable colour without
 * screen-specific conditionals.
 */
internal val ICON_ACCENTS: Map<String, SkyvwAccent> = buildMap {
    register(SkyvwAccent.SUN, "sun", "cloud-sun", "cloud-sun-sun")
    register(SkyvwAccent.CLOUD, "cloud", "cloud-sun-cloud", "fog", "rain-cloud", "storm-cloud")
    register(SkyvwAccent.RAIN, "rain", "rain-drops", "wind", "sink-rate", "touchdown-sink")
    register(SkyvwAccent.COLD, "snow", "mountain", "moon", "thermometer")
    register(SkyvwAccent.DANGER, "storm", "storm-bolt", "cross", "trash", "record", "stop")
    register(
        SkyvwAccent.POSITIVE,
        "gps", "gps-points", "target", "activity", "chart", "download", "plus", "calendar",
        "ruler", "check", "touchdown-run",
    )
    register(
        SkyvwAccent.CAUTION,
        "gauge", "bell", "wrench", "minus", "zigzag", "warning", "gps-break", "rotation-rate",
    )
    register(SkyvwAccent.ACHIEVEMENT, "book", "flag", "star", "pitch")
    register(
        SkyvwAccent.VIOLET,
        "sliders", "gear", "vibrate", "layers", "cube", "palette", "clock", "pencil",
        "watch", "phone", "spatial-path", "roll",
    )
    register(
        SkyvwAccent.SKY,
        "map", "plane", "chute", "arrow", "eye", "eye-off", "speaker", "wifi", "refresh", "link",
        "home", "grid", "ground-track", "yaw",
    )
    register(
        SkyvwAccent.NEUTRAL,
        "freefly", "head-down", "belly-arch", "lock",
        "chevron-left", "chevron-right", "chevron-up", "chevron-down",
        "play", "pause",
    )
}

private fun MutableMap<String, SkyvwAccent>.register(accent: SkyvwAccent, vararg names: String) {
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
enum class SkyvwIconSetStyle { FILLED, OUTLINE }

val LocalSkyvwIconSetStyle = androidx.compose.runtime.staticCompositionLocalOf { SkyvwIconSetStyle.FILLED }

/** Style resolution by icon name. Vectors outside the catalog (frozen
 * Material baseline, HUD chrome) render themselves in both styles —
 * deliberate pass-through, not a fallback. */
fun skyvwIconVariant(icon: ImageVector, style: SkyvwIconSetStyle): ImageVector =
    if (style == SkyvwIconSetStyle.OUTLINE) RING_ICON_OUTLINE_BY_NAME[icon.name] ?: icon else icon

fun ringIconAccent(icon: ImageVector?): SkyvwAccent =
    icon?.name?.let(ICON_ACCENTS::get) ?: SkyvwAccent.NEUTRAL

/** A composable glyph is a stack of vectors sharing the same 24x24 viewport. */
@Immutable
data class SkyvwIconLayer(
    val icon: ImageVector,
    val accent: SkyvwAccent,
)

/**
 * Declarative artwork plus semantic pigment. A one-layer style is a normal
 * icon; weather can stack independently coloured strokes without a new
 * renderer or a screen-local colour table.
 */
@Immutable
data class SkyvwIconStyle(
    val layers: List<SkyvwIconLayer>,
    val primaryAccent: SkyvwAccent = layers.last().accent,
) {
    init {
        require(layers.isNotEmpty()) { "An icon style needs at least one layer" }
    }
}

private fun singleStyle(icon: ImageVector, accent: SkyvwAccent) =
    SkyvwIconStyle(listOf(SkyvwIconLayer(icon, accent)))

private val COMPOSITE_ICON_STYLES: Map<String, SkyvwIconStyle> by lazy {
    mapOf(
        RingIcons.CloudSun.name to SkyvwIconStyle(
            listOf(
                SkyvwIconLayer(RingIcons.CloudSunSun, SkyvwAccent.SUN),
                SkyvwIconLayer(RingIcons.CloudSunCloud, SkyvwAccent.CLOUD),
            ),
            primaryAccent = SkyvwAccent.SUN,
        ),
        RingIcons.Rain.name to SkyvwIconStyle(
            listOf(
                SkyvwIconLayer(RingIcons.RainCloud, SkyvwAccent.CLOUD),
                SkyvwIconLayer(RingIcons.RainDrops, SkyvwAccent.RAIN),
            ),
        ),
        RingIcons.Storm.name to SkyvwIconStyle(
            listOf(
                SkyvwIconLayer(RingIcons.StormCloud, SkyvwAccent.CLOUD),
                SkyvwIconLayer(RingIcons.StormBolt, SkyvwAccent.DANGER),
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
    accentOverride: SkyvwAccent? = null,
): SkyvwIconStyle {
    val catalogAccent = ringIconAccent(icon)
    if (accentOverride != null && accentOverride != catalogAccent) {
        return singleStyle(icon, accentOverride)
    }
    return COMPOSITE_ICON_STYLES[icon.name] ?: singleStyle(icon, accentOverride ?: catalogAccent)
}

/** Stable UI vocabulary at the weather/data boundary. */
enum class SkyvwWeatherSymbol { UNKNOWN, CLEAR, PARTLY_CLOUDY, CLOUDY, FOG, RAIN, SNOW, STORM }

/** Every weather surface consumes these same centrally coloured glyphs. */
fun skyvwWeatherIconStyle(symbol: SkyvwWeatherSymbol): SkyvwIconStyle = when (symbol) {
    SkyvwWeatherSymbol.UNKNOWN -> singleStyle(RingIcons.Cloud, SkyvwAccent.NEUTRAL)
    SkyvwWeatherSymbol.CLEAR -> ringIconStyle(RingIcons.Sun)
    SkyvwWeatherSymbol.PARTLY_CLOUDY -> ringIconStyle(RingIcons.CloudSun)
    SkyvwWeatherSymbol.CLOUDY -> ringIconStyle(RingIcons.Cloud)
    SkyvwWeatherSymbol.FOG -> ringIconStyle(RingIcons.Fog)
    SkyvwWeatherSymbol.RAIN -> ringIconStyle(RingIcons.Rain)
    SkyvwWeatherSymbol.SNOW -> ringIconStyle(RingIcons.Snow)
    SkyvwWeatherSymbol.STORM -> ringIconStyle(RingIcons.Storm)
}
