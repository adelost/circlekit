package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/**
 * The OUTLINE icon set: the original stroke geometry (Lucide-derived, ISC)
 * thickened to 2.4 px. Selectable against the FILLED home-language set via
 * DEV → ICONS → STYLE; both sets share names 1:1 (IconCatalogTest pins it).
 */
object RingIconsOutline {
    private fun stroke(name: String, vararg paths: String): ImageVector =
        ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            paths.forEach { d ->
                addPath(
                    pathData = addPathNodes(d),
                    fill = null,
                    stroke = SolidColor(Color.White),
                    strokeLineWidth = 2.4f,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }.build()

    /** Direction arrow (rotate it to the bearing — arrows, never letters). */
    val Arrow: ImageVector by lazy { stroke("arrow", "M12 20V5", "M5 11l7 -7l7 7") }

    val Cloud: ImageVector by lazy {
        stroke("cloud", "M17.5 19H9a7 7 0 1 1 6.71 -9h1.79a4.5 4.5 0 1 1 0 9Z")
    }

    val Plane: ImageVector by lazy { stroke("plane", "M22 2L15 22L11 13L2 9Z", "M22 2L11 13") }

    val Gps: ImageVector by lazy {
        stroke(
            "gps",
            "M2 12h3", "M19 12h3", "M12 2v3", "M12 19v3",
            "M12 5a7 7 0 1 0 0.001 0Z", "M12 9a3 3 0 1 0 0.001 0Z",
        )
    }

    val Map: ImageVector by lazy {
        stroke(
            "map",
            "M14.1 5.6a2 2 0 0 0 1.8 0l3.7 -1.9a1 1 0 0 1 1.4 0.9v12.8a1 1 0 0 1 -0.6 0.9" +
                "l-4.5 2.3a2 2 0 0 1 -1.8 0l-4.2 -2.1a2 2 0 0 0 -1.8 0l-3.7 1.9" +
                "a1 1 0 0 1 -1.4 -0.9V6.6a1 1 0 0 1 0.6 -0.9l4.5 -2.3a2 2 0 0 1 1.8 0Z",
            "M15 5.8v15", "M9 3.2v15",
        )
    }

    val Mountain: ImageVector by lazy { stroke("mountain", "M8 3l4 8l5 -5l5 15H2L8 3Z") }

    val Sun: ImageVector by lazy {
        stroke(
            "sun",
            "M12 8a4 4 0 1 0 0.001 0Z",
            "M12 2v2", "M12 20v2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4",
            "M2 12h2", "M20 12h2", "M6.3 17.7l-1.4 1.4", "M19.1 4.9l-1.4 1.4",
        )
    }

    val Book: ImageVector by lazy {
        stroke(
            "book",
            "M12 7v14",
            "M3 18a1 1 0 0 1 -1 -1V4a1 1 0 0 1 1 -1h5a4 4 0 0 1 4 4a4 4 0 0 1 4 -4h5" +
                "a1 1 0 0 1 1 1v13a1 1 0 0 1 -1 1h-6a3 3 0 0 0 -3 3a3 3 0 0 0 -3 -3Z",
        )
    }

    val Wrench: ImageVector by lazy {
        stroke(
            "wrench",
            "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77 -3.77" +
                "a6 6 0 0 1 -7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1 -3 -3l6.91 -6.91" +
                "a6 6 0 0 1 7.94 -7.94l-3.76 3.76Z",
        )
    }

    val Sliders: ImageVector by lazy {
        stroke(
            "sliders",
            "M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3",
            "M2 14h4", "M10 8h4", "M18 16h4",
        )
    }

    val Ruler: ImageVector by lazy {
        stroke(
            "ruler",
            "M3 17.3L17.3 3a2.1 2.1 0 0 1 3 0l0.7 0.7a2.1 2.1 0 0 1 0 3L6.7 21H3Z",
            "M14 6l4 4", "M11 9l2 2", "M8 12l2 2", "M5 15l2 2",
        )
    }

    val Gear: ImageVector by lazy {
        stroke(
            "gear",
            "M9.75 2.26H14.25V4.17L15.12 4.47L15.95 4.87L17.3 3.52L20.48 6.7L19.13 8.05L19.53 8.88L19.83 9.75H21.74V14.25H19.83L19.53 15.12L19.13 15.95L20.48 17.3L17.3 20.48L15.95 19.13L15.12 19.53L14.25 19.83V21.74H9.75V19.83L8.88 19.53L8.05 19.13L6.7 20.48L3.52 17.3L4.87 15.95L4.47 15.12L4.17 14.25H2.26V9.75H4.17L4.47 8.88L4.87 8.05L3.52 6.7L6.7 3.52L8.05 4.87L8.88 4.47L9.75 4.17Z",
            "M12 8.6a3.4 3.4 0 1 0 0.001 0Z",
        )
    }

    val Chute: ImageVector by lazy {
        stroke("chute", "M3.5 11a8.5 8.5 0 0 1 17 0", "M3.5 11L12 21l8.5 -10", "M12 11v10")
    }

    val Activity: ImageVector by lazy {
        stroke(
            "activity",
            "M22 12h-2.5l-2.5 8l-5 -16l-2.5 8H2",
        )
    }

    val Eye: ImageVector by lazy {
        stroke("eye", "M2 12s3.5 -7 10 -7s10 7 10 7s-3.5 7 -10 7s-10 -7 -10 -7Z", "M12 9a3 3 0 1 0 0.001 0Z")
    }

    val EyeOff: ImageVector by lazy {
        stroke(
            "eye-off",
            "M3 3l18 18",
            "M10.6 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1 -3 4.1",
            "M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3.8 -0.7",
        )
    }

    val Speaker: ImageVector by lazy {
        stroke("speaker", "M11 5L6 9H2v6h4l5 4Z", "M15.5 8.5a5 5 0 0 1 0 7", "M18.5 5.5a9 9 0 0 1 0 13")
    }

    val Wifi: ImageVector by lazy {
        stroke(
            "wifi",
            "M2 8.82a15 15 0 0 1 20 0",
            "M5 12.86a10 10 0 0 1 14 0",
            "M8.5 16.43a5 5 0 0 1 7 0",
            "M12 20h0.01",
        )
    }

    val Refresh: ImageVector by lazy {
        stroke(
            "refresh",
            "M21 12a9 9 0 1 1 -9 -9c2.52 0 4.93 1 6.74 2.74L21 8",
            "M21 3v5h-5",
        )
    }

    val Check: ImageVector by lazy { stroke("check", "M20 6L9 17l-5 -5") }

    val Warning: ImageVector by lazy {
        stroke("warning", "M12 3L2 21h20Z", "M12 9v4", "M12 17h0.01")
    }

    /** Mirrors the filled "i": a stem and its dot, no enclosing circle. */
    val Info: ImageVector by lazy {
        stroke("info", "M12 9.6v9.4", "M12 5.6h0.01")
    }

    /** The provenance marker stays a silhouette in both styles: its face must survive at 11–18 px. */
    val Clown: ImageVector by lazy { RingIcons.Clown }

    val Trash: ImageVector by lazy {
        stroke("trash", "M3 6h18", "M8 6V4h8v2", "M6 6l1 15h10l1 -15", "M10 10v7", "M14 10v7")
    }

    val Target: ImageVector by lazy {
        stroke(
            "target",
            "M12 22a10 10 0 1 0 0 -20a10 10 0 0 0 0 20Z",
            "M12 18a6 6 0 1 0 0 -12a6 6 0 0 0 0 12Z",
            "M12 14a2 2 0 1 0 0 -4a2 2 0 0 0 0 4Z",
        )
    }

    val Gauge: ImageVector by lazy {
        stroke(
            "gauge",
            "M20.4 15a9 9 0 1 0 -16.8 0",
            "M12 12l4 -4",
            "M6.7 9l-1.4 -1.4", "M12 6V4", "M17.3 9l1.4 -1.4",
        )
    }

    val Bell: ImageVector by lazy {
        stroke(
            "bell",
            "M18 8a6 6 0 0 0 -12 0c0 7 -3 7 -3 9h18c0 -2 -3 -2 -3 -9Z",
            "M10 21h4",
        )
    }

    val Link: ImageVector by lazy {
        stroke(
            "link",
            "M10 13a5 5 0 0 0 7.1 0l2 -2a5 5 0 0 0 -7.1 -7.1l-1.1 1.1",
            "M14 11a5 5 0 0 0 -7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1 -1.1",
        )
    }

    val Vibrate: ImageVector by lazy {
        stroke(
            "vibrate",
            "M8 5a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2Z",
            "M4 8l-2 4l2 4", "M20 8l2 4l-2 4",
        )
    }

    val Download: ImageVector by lazy {
        stroke(
            "download",
            "M12 3v12", "M7 10l5 5l5 -5", "M5 21h14",
        )
    }

    val Layers: ImageVector by lazy {
        stroke(
            "layers",
            "M12 2L2 7l10 5l10 -5Z",
            "M2 12l10 5l10 -5", "M2 17l10 5l10 -5",
        )
    }

    /** Orthographic view/orbit control used by 3D data replays. */
    val Cube: ImageVector by lazy {
        stroke(
            "cube",
            "M12 2l9 5l-9 5l-9 -5Z",
            "M3 7v10l9 5l9 -5V7",
            "M12 12v10",
        )
    }

    val Palette: ImageVector by lazy {
        stroke(
            "palette",
            "M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0 -3H12a2 2 0 0 1 0 -4h4a5 5 0 0 0 5 -5a9 9 0 0 0 -9 -6Z",
            "M7.5 10h0.01", "M9.5 6.5h0.01", "M14.5 6.5h0.01", "M17 10h0.01",
        )
    }

    val Plus: ImageVector by lazy { stroke("plus", "M12 5v14", "M5 12h14") }
    val Minus: ImageVector by lazy { stroke("minus", "M5 12h14") }

    val Chart: ImageVector by lazy {
        stroke("chart", "M4 19V5", "M4 19h16", "M7 15l4 -5l3 2l5 -7")
    }

    val GroundTrack: ImageVector by lazy {
        stroke(
            "ground-track",
            "M5 16.8a2.2 2.2 0 1 0 0.001 0Z", "M19 5a2.2 2.2 0 1 0 0.001 0Z",
            "M6.8 15.5c2.7 -2.4 1.2 -5.8 4.5 -7.2c2.1 -0.9 3.7 0.1 5.8 -1.8",
        )
    }

    val SpatialPath: ImageVector by lazy {
        stroke(
            "spatial-path", "M3 18.5l9 3.5l9 -3.5",
            "M5 16.8a2 2 0 1 0 0.001 0Z", "M19 5a2 2 0 1 0 0.001 0Z",
            "M6.5 15.6c2.8 -1 1.9 -5.3 5.4 -6.2c2.4 -0.6 3.3 -2.4 5.3 -3.3",
        )
    }

    val SinkRate: ImageVector by lazy {
        stroke("sink-rate", "M12 3.5v13", "M7.5 12.5L12 17l4.5 -4.5", "M4 20.5h16")
    }

    val GpsPoints: ImageVector by lazy {
        stroke(
            "gps-points", "M5 17.5a2 2 0 1 0 0.001 0Z", "M9.5 12a1.8 1.8 0 1 0 0.001 0Z",
            "M14.5 14.5a1.8 1.8 0 1 0 0.001 0Z", "M19 6a2 2 0 1 0 0.001 0Z",
            "M6.5 16l1.7 -2.1", "M11.1 12.8l1.8 0.9", "M15.7 12.9l2 -4.9",
        )
    }

    val GpsBreak: ImageVector by lazy {
        stroke(
            "gps-break", "M4.5 18a1.8 1.8 0 1 0 0.001 0Z", "M19.5 6a1.8 1.8 0 1 0 0.001 0Z",
            "M6 16.7c1.8 -2 2.6 -3.4 4 -4.1", "M14 10.5c1.7 -0.8 2.4 -2 4 -3.2",
            "M10.8 8.8l2.8 2.8", "M13.6 8.8l-2.8 2.8",
        )
    }

    val TouchdownRun: ImageVector by lazy {
        stroke("touchdown-run", "M4 19.5h16", "M4.5 13.5h13", "M14 10l3.5 3.5L14 17")
    }

    val TouchdownSink: ImageVector by lazy {
        stroke("touchdown-sink", "M4 19.5h16", "M12 3.5v11.8", "M7.8 11.2l4.2 4.2l4.2 -4.2")
    }

    // Same plane-of-rotation geometry as the filled set: flat loop, tall loop,
    // round loop about the dot. Only the axis dot differs — a stroked ring
    // here, a fill there — because this set is stroke-only.
    val Yaw: ImageVector by lazy {
        stroke("yaw", "M19.0 9.6A8.6 4.2 0 1 0 19.8 13.8", "M16.3 14.5L19.8 13.8L19.2 17.3")
    }

    val Pitch: ImageVector by lazy {
        stroke("pitch", "M9.6 5.0A4.2 8.6 0 1 0 13.8 4.2", "M14.5 7.7L13.8 4.2L17.3 4.8")
    }

    val Roll: ImageVector by lazy {
        stroke(
            "roll", "M16.4 5.8A7.6 7.6 0 1 0 19.1 14.6", "M16.2 16.7L19.1 14.6L20.0 18.1",
            "M12 11.2a0.8 0.8 0 1 0 0.001 0Z",
        )
    }

    val RotationRate: ImageVector by lazy {
        stroke(
            "rotation-rate", "M16.6 6.1A6.8 6.8 0 1 0 20.0 12.0", "M18.0 15.0L20.0 12.0L22.0 15.0",
            "M2.6 8.6h2.2", "M2.6 12h2.0", "M3.4 15.4h1.8",
        )
    }

    val Clock: ImageVector by lazy {
        stroke("clock", "M12 22a10 10 0 1 0 0 -20a10 10 0 0 0 0 20Z", "M12 6v6l4 2")
    }

    val Wind: ImageVector by lazy {
        stroke("wind", "M3 8h10a3 3 0 1 0 -3 -3", "M3 12h15a3 3 0 1 1 -3 3", "M3 16h7")
    }

    val Flag: ImageVector by lazy {
        stroke("flag", "M5 21V4", "M5 5h10l-1 3l1 3H5")
    }

    val Moon: ImageVector by lazy {
        stroke("moon", "M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5A8.5 8.5 0 1 0 20.5 14.3Z")
    }

    val Calendar: ImageVector by lazy {
        stroke(
            "calendar",
            "M8 2v4", "M16 2v4", "M3 10h18",
            "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2V6a2 2 0 0 1 2 -2Z",
        )
    }

    val Star: ImageVector by lazy {
        stroke(
            "star",
            "M12 3l2.2 5.9l6.4 0.3l-5 4l1.7 6.1l-5.3 -3.5l-5.3 3.5l1.7 -6.1l-5 -4l6.4 -0.3Z",
        )
    }

    val CloudSun: ImageVector by lazy {
        stroke(
            "cloud-sun",
            "M12 3V2", "M5.6 5.6l-0.7 -0.7", "M18.4 5.6l0.7 -0.7", "M19 10h1",
            "M8.5 10a4 4 0 0 1 7.7 -1.5",
            "M17.5 21H8a5 5 0 1 1 4.8 -6.5h1.7a3.5 3.5 0 1 1 3 6.5Z",
        )
    }

    // Two-tone layers: the same 24x24 geometry as the combined glyphs
    // above, split so each part can carry its own tint when stacked.
    val CloudSunSun: ImageVector by lazy {
        stroke(
            "cloud-sun-sun",
            "M12 3V2", "M5.6 5.6l-0.7 -0.7", "M18.4 5.6l0.7 -0.7", "M19 10h1",
            "M8.5 10a4 4 0 0 1 7.7 -1.5",
        )
    }

    val CloudSunCloud: ImageVector by lazy {
        stroke("cloud-sun-cloud", "M17.5 21H8a5 5 0 1 1 4.8 -6.5h1.7a3.5 3.5 0 1 1 3 6.5Z")
    }

    val RainCloud: ImageVector by lazy {
        stroke("rain-cloud", "M17.5 15H8a5 5 0 1 1 4.8 -6.5h1.7a3.5 3.5 0 1 1 3 6.5Z")
    }

    val RainDrops: ImageVector by lazy {
        stroke("rain-drops", "M8 19l-1 2", "M13 19l-1 2", "M18 19l-1 2")
    }

    val StormCloud: ImageVector by lazy {
        stroke("storm-cloud", "M17.5 14H8a5 5 0 1 1 4.8 -6.5h1.7a3.5 3.5 0 1 1 3 6.5Z")
    }

    val StormBolt: ImageVector by lazy {
        stroke("storm-bolt", "M13 15l-3 5h3l-1 3l5 -6h-3l1 -2")
    }

    val Rain: ImageVector by lazy {
        stroke(
            "rain",
            "M17.5 15H8a5 5 0 1 1 4.8 -6.5h1.7a3.5 3.5 0 1 1 3 6.5Z",
            "M8 19l-1 2", "M13 19l-1 2", "M18 19l-1 2",
        )
    }

    val Snow: ImageVector by lazy {
        stroke(
            "snow",
            "M12 2v20", "M4.2 6.5l15.6 11", "M19.8 6.5l-15.6 11",
            "M9 4l3 2l3 -2", "M9 20l3 -2l3 2",
        )
    }

    val Storm: ImageVector by lazy {
        stroke(
            "storm",
            "M17.5 14H8a5 5 0 1 1 4.8 -6.5h1.7a3.5 3.5 0 1 1 3 6.5Z",
            "M13 15l-3 5h3l-1 3l5 -6h-3l1 -2",
        )
    }

    val Fog: ImageVector by lazy {
        stroke("fog", "M4 8h12", "M8 12h12", "M4 16h12", "M8 20h8")
    }

    val Thermometer: ImageVector by lazy {
        stroke("thermometer", "M14 14.8V5a2 2 0 0 0 -4 0v9.8a4 4 0 1 0 4 0Z", "M12 9v8")
    }

    val ChevronLeft: ImageVector by lazy { stroke("chevron-left", "M15 18l-6 -6l6 -6") }

    // ---- jump-tag glyphs (same stroke grammar, hand-drawn figures) ----

    /** Head-up sit-fly figure: head on top, arms up, knees bent. */
    val Freefly: ImageVector by lazy {
        stroke(
            "freefly",
            "M12 4.4m-1.9 0a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0",
            "M12 7v6",
            "M12 9.5L7.5 5.7",
            "M12 9.5l4.5 -3.8",
            "M12 13l-4 5.5",
            "M12 13l4 5.5",
        )
    }

    /** Inverted figure: head at the bottom, legs up in a V. */
    val HeadDown: ImageVector by lazy {
        stroke(
            "head-down",
            "M12 19.6m-1.9 0a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0",
            "M12 17v-6",
            "M12 14.5L7.5 18.3",
            "M12 14.5l4.5 3.8",
            "M12 11l-4 -5.5",
            "M12 11l4 -5.5",
        )
    }

    /** Belly arch seen from the side, head to the right. */
    val BellyArch: ImageVector by lazy {
        stroke(
            "belly-arch",
            "M3.5 15Q12 7.5 20.5 15",
            "M20.6 11.9m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0",
        )
    }

    /** Write/edit — also fronts the NOTE row. */
    val Pencil: ImageVector by lazy {
        stroke(
            "pencil",
            "M4.5 19.5l3.6 -0.9L19 7.7l-2.7 -2.7L5.4 15.9l-0.9 3.6Z",
            "M14.3 7l2.7 2.7",
        )
    }

    /** Rough ground line — the bumpy landing badge. */
    val Zigzag: ImageVector by lazy {
        stroke("zigzag", "M3 14.5l4.2 -4.5l4.3 4.5l4.3 -4.5l4.2 4.5")
    }

    /** Plain cross — the crash landing badge. */
    val Cross: ImageVector by lazy { stroke("cross", "M6 6l12 12", "M18 6L6 18") }
    val ChevronRight: ImageVector by lazy { stroke("chevron-right", "M9 18l6 -6l-6 -6") }
    val ChevronUp: ImageVector by lazy { stroke("chevron-up", "M6 15l6 -6l6 6") }
    val ChevronDown: ImageVector by lazy { stroke("chevron-down", "M6 9l6 6l6 -6") }
    val Home: ImageVector by lazy { stroke("home", "M4.5 10.2L12 4l7.5 6.2V19a1.5 1.5 0 0 1 -1.5 1.5h-3.5v-5h-5v5H6A1.5 1.5 0 0 1 4.5 19Z") }
    val Lock: ImageVector by lazy { stroke("lock", "M5.5 10.5h13a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-13a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1Z", "M8 10.5V7.5a4 4 0 0 1 8 0v3") }
    val Record: ImageVector by lazy { stroke("record", "M12 3.4a8.6 8.6 0 1 0 0.001 0Z", "M12 8.4a3.6 3.6 0 1 0 0.001 0Z") }
    val Stop: ImageVector by lazy { stroke("stop", "M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-11a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1Z") }
    val Grid: ImageVector by lazy { stroke("grid", "M4.5 4.5h15v15h-15Z", "M10 4.5v15", "M14 4.5v15", "M4.5 10h15", "M4.5 14h15") }
    val Watch: ImageVector by lazy { stroke("watch", "M12 6.4a5.6 5.6 0 1 0 0.001 0Z", "M9.5 6l0.5 -3.5h4L14.5 6", "M9.5 18l0.5 3.5h4l0.5 -3.5") }
    val Phone: ImageVector by lazy { stroke("phone", "M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1 -1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5 -1.5Z", "M10.5 18h3") }
    val Play: ImageVector by lazy { stroke("play", "M9 5.5L19.5 12L9 18.5Z") }
    val Pause: ImageVector by lazy { stroke("pause", "M8.2 5.5v13", "M15.8 5.5v13") }
}
