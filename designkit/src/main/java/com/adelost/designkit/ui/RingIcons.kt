package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/**
 * The Circle icon set in the HOME LANGUAGE (Mattias 2026-07-21: "Jag vill ha
 * allting i hemspråket"): filled silhouettes in the icon's semantic accent,
 * real holes (EvenOdd subpaths) only where recognition needs them, and pure
 * line motifs as thick 2.6 px strokes. One tint per vector — duotone comes
 * from the layer system in RingIconAccentCatalog, never from painted-over
 * detail. A few line glyphs remain derived from Lucide paths (ISC).
 *
 * Source of truth: docs/qa/2026-07-21-icon-weight-samples/ + the generator
 * that emits both this file and its visual proof from identical path data.
 */
object RingIcons {
    private fun glyph(
        name: String,
        fills: List<String> = emptyList(),
        strokes: List<String> = emptyList(),
        strokeWidth: Float = 2.6f,
        evenOdd: Boolean = false,
    ): ImageVector =
        ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        ).apply {
            fills.forEach { d ->
                addPath(
                    pathData = addPathNodes(d),
                    pathFillType = if (evenOdd) PathFillType.EvenOdd else PathFillType.NonZero,
                    fill = SolidColor(Color.White),
                )
            }
            strokes.forEach { d ->
                addPath(
                    pathData = addPathNodes(d),
                    fill = null,
                    stroke = SolidColor(Color.White),
                    strokeLineWidth = strokeWidth,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round,
                )
            }
        }.build()


    /** Direction arrow (rotate it to the bearing — arrows, never letters). */
    val Arrow: ImageVector by lazy {
        glyph("arrow", strokes = listOf("M12 20V5", "M5 11l7 -7l7 7"), strokeWidth = 3.2f)
    }

    val Cloud: ImageVector by lazy {
        glyph("cloud", fills = listOf("M7.6 18h9.3a3.6 3.6 0 0 0 0.6 -7.2a5.1 5.1 0 0 0 -9.9 -1.2A3.9 3.9 0 0 0 7.6 18Z"))
    }

    val Plane: ImageVector by lazy {
        glyph("plane", fills = listOf("M21 15.2v-2.4l-8 -4.8V3.4a1.4 1.4 0 0 0 -2.8 0V8l-8 4.8v2.4l8 -2.4v4.6l-2.4 1.8v1.8l3.8 -1.1l3.8 1.1v-1.8L13 17.4v-4.6Z"))
    }

    val Gps: ImageVector by lazy {
        glyph("gps", fills = listOf("M12 9.8a2.2 2.2 0 1 0 0.001 0Z"), strokes = listOf("M2.5 12h3", "M18.5 12h3", "M12 2.5v3", "M12 18.5v3", "M12 5.2a6.8 6.8 0 1 0 0.001 0Z"), strokeWidth = 3.0f)
    }

    val Map: ImageVector by lazy {
        glyph("map", fills = listOf("M4.7 5.3L9 3.5l6 2l4.2 -1.7a1 1 0 0 1 1.3 0.9v12.9a1.5 1.5 0 0 1 -1 1.4L15 20.5l-6 -2l-4.2 1.7a1 1 0 0 1 -1.3 -0.9V6.7a1.5 1.5 0 0 1 1.2 -1.4ZM8.4 5.2h1.2v12.6H8.4ZM14.4 6.4h1.2v12.4h-1.4Z"), evenOdd = true)
    }

    val Mountain: ImageVector by lazy {
        glyph("mountain", fills = listOf("M3 19L9.2 7l3.4 6.2L15 10l6 9Z"))
    }

    val Sun: ImageVector by lazy {
        glyph("sun", fills = listOf("M12 7.4a4.6 4.6 0 1 0 0.001 0Z"), strokes = listOf("M12 3v2.4", "M12 18.6V21", "M3 12h2.4", "M18.6 12H21", "M5.7 5.7l1.7 1.7", "M16.6 16.6l1.7 1.7", "M18.3 5.7l-1.7 1.7", "M7.4 16.6l-1.7 1.7"), strokeWidth = 2.8f)
    }

    val Book: ImageVector by lazy {
        glyph("book", fills = listOf("M12 5.2C9.6 3.8 6.5 3.7 4 4.9a1.8 1.8 0 0 0 -1 1.6v10.9c0 1 1.1 1.7 2 1.3c2.3 -0.9 4.9 -0.8 7 0.4c2.1 -1.2 4.7 -1.3 7 -0.4c0.9 0.4 2 -0.3 2 -1.3V6.5a1.8 1.8 0 0 0 -1 -1.6c-2.5 -1.2 -5.6 -1.1 -8 0.3ZM11.4 5.4h1.2v13.4h-1.2Z"), evenOdd = true)
    }

    val Wrench: ImageVector by lazy {
        glyph("wrench", fills = listOf("M15.4 5.6a4.4 4.4 0 0 0 -5.8 5.6L4 16.8a2.1 2.1 0 0 0 3 3l5.6 -5.6a4.4 4.4 0 0 0 5.6 -5.8l-3 3l-2.6 -2.6Z"))
    }

    val Sliders: ImageVector by lazy {
        glyph("sliders", fills = listOf("M9.5 5.3a2.2 2.2 0 1 0 0.001 0Z", "M15 9.8a2.2 2.2 0 1 0 0.001 0Z", "M7.5 14.3a2.2 2.2 0 1 0 0.001 0Z"), strokes = listOf("M4 7.5h16", "M4 12h16", "M4 16.5h16"), strokeWidth = 2.8f)
    }

    val Ruler: ImageVector by lazy {
        glyph("ruler", fills = listOf("M3 9.5h18a1 1 0 0 1 1 1V16a1 1 0 0 1 -1 1H3a1 1 0 0 1 -1 -1v-5.5a1 1 0 0 1 1 -1ZM7 9.9h1.3v3H7ZM11.4 9.9h1.3v3h-1.3ZM15.8 9.9h1.3v3h-1.3Z"), evenOdd = true)
    }

    /** Eight-tooth cog generated with exact 45-degree rotational symmetry. */
    val Gear: ImageVector by lazy {
        glyph("gear", fills = listOf("M9.75 2.26H14.25V4.17L15.12 4.47L15.95 4.87L17.3 3.52L20.48 6.7L19.13 8.05L19.53 8.88L19.83 9.75H21.74V14.25H19.83L19.53 15.12L19.13 15.95L20.48 17.3L17.3 20.48L15.95 19.13L15.12 19.53L14.25 19.83V21.74H9.75V19.83L8.88 19.53L8.05 19.13L6.7 20.48L3.52 17.3L4.87 15.95L4.47 15.12L4.17 14.25H2.26V9.75H4.17L4.47 8.88L4.87 8.05L3.52 6.7L6.7 3.52L8.05 4.87L8.88 4.47L9.75 4.17ZM12 8.6a3.4 3.4 0 1 0 0.001 0Z"), evenOdd = true)
    }

    val Chute: ImageVector by lazy {
        glyph("chute", fills = listOf("M12 3a9 9 0 0 0 -9 8.6a0.9 0.9 0 0 0 0.9 0.9h16.2a0.9 0.9 0 0 0 0.9 -0.9A9 9 0 0 0 12 3Z", "M12 18.4a1.7 1.7 0 1 0 0.001 0Z"), strokes = listOf("M5.5 13.5l6.5 6l6.5 -6"), strokeWidth = 2.2f)
    }

    val Activity: ImageVector by lazy {
        glyph("activity", fills = listOf("M3.5 20v-3l5.5 -7l3.4 3l5.6 -7.5l2.5 1.9V20Z"))
    }

    val Eye: ImageVector by lazy {
        glyph("eye", fills = listOf("M12 5.5C7 5.5 3.3 9.1 2 12c1.3 2.9 5 6.5 10 6.5S20.7 14.9 22 12c-1.3 -2.9 -5 -6.5 -10 -6.5ZM12 8.8a3.2 3.2 0 1 0 0.001 0Z", "M12 10.3a1.7 1.7 0 1 0 0.001 0Z"), evenOdd = true)
    }

    val EyeOff: ImageVector by lazy {
        glyph("eye-off", strokes = listOf("M2 12s3.5 -7 10 -7s10 7 10 7s-3.5 7 -10 7s-10 -7 -10 -7Z", "M4.5 19.5l15 -15"), strokeWidth = 3.0f)
    }

    val Speaker: ImageVector by lazy {
        glyph("speaker", fills = listOf("M4 9.5h3.5L13 5v14l-5.5 -4.5H4Z"), strokes = listOf("M16 9a4.2 4.2 0 0 1 0 6", "M18.6 6.6a8 8 0 0 1 0 10.8"), strokeWidth = 2.4f)
    }

    val Wifi: ImageVector by lazy {
        glyph("wifi", fills = listOf("M12 17.8a1.9 1.9 0 1 0 0.001 0Z"), strokes = listOf("M2.5 9.3a14.5 14.5 0 0 1 19 0", "M5.5 13a10 10 0 0 1 13 0", "M8.7 16.6a5 5 0 0 1 6.6 0"), strokeWidth = 3.0f)
    }

    val Refresh: ImageVector by lazy {
        glyph("refresh", fills = listOf("M20.8 3.2v5.2h-5.2Z"), strokes = listOf("M19.5 12a7.5 7.5 0 1 1 -2.2 -5.3"), strokeWidth = 3.0f)
    }

    val Check: ImageVector by lazy {
        glyph("check", strokes = listOf("M20 6L9 17l-5 -5"), strokeWidth = 3.2f)
    }

    val Warning: ImageVector by lazy {
        glyph("warning", fills = listOf("M12 3.2a1.8 1.8 0 0 1 1.6 0.9l8 13.8a1.8 1.8 0 0 1 -1.6 2.7H4a1.8 1.8 0 0 1 -1.6 -2.7l8 -13.8A1.8 1.8 0 0 1 12 3.2ZM11.2 9h1.6v5h-1.6ZM11.05 16.2a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0Z"), evenOdd = true)
    }

    val Trash: ImageVector by lazy {
        glyph("trash", fills = listOf("M5.5 7.5h13l-1 12.2a1.8 1.8 0 0 1 -1.8 1.6H8.3a1.8 1.8 0 0 1 -1.8 -1.6ZM9.4 10.8h1.3v6.4H9.4ZM13.3 10.8h1.3v6.4h-1.3Z"), strokes = listOf("M4 7.5h16", "M9.5 7.5V5.6a1.1 1.1 0 0 1 1.1 -1.1h2.8a1.1 1.1 0 0 1 1.1 1.1v1.9"), strokeWidth = 2.2f, evenOdd = true)
    }

    val Target: ImageVector by lazy {
        glyph("target", fills = listOf("M12 10.4a1.6 1.6 0 1 0 0.001 0Z"), strokes = listOf("M12 4a8 8 0 1 0 0.001 0Z", "M12 7.8a4.2 4.2 0 1 0 0.001 0Z"))
    }

    val Gauge: ImageVector by lazy {
        glyph("gauge", fills = listOf("M12 6A9.5 9.5 0 0 0 2.5 15.5a2 2 0 0 0 2 2h15a2 2 0 0 0 2 -2A9.5 9.5 0 0 0 12 6ZM10.9 16.4l4.8 -5.7l1.1 0.9l-4.8 5.7Z"), evenOdd = true)
    }

    val Bell: ImageVector by lazy {
        glyph("bell", fills = listOf("M12 3.5a5.6 5.6 0 0 1 5.6 5.6c0 3.8 1.4 5.4 2.4 6.4H4c1 -1 2.4 -2.6 2.4 -6.4A5.6 5.6 0 0 1 12 3.5Z", "M9.8 17.5a2.3 2.3 0 0 0 4.4 0Z"))
    }

    val Link: ImageVector by lazy {
        glyph("link", strokes = listOf("M10 13a5 5 0 0 0 7.1 0l2 -2a5 5 0 0 0 -7.1 -7.1l-1.1 1.1", "M14 11a5 5 0 0 0 -7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1 -1.1"))
    }

    val Vibrate: ImageVector by lazy {
        glyph("vibrate", fills = listOf("M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1 -1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5 -1.5ZM10.4 17.6h3.2v1.1h-3.2Z"), strokes = listOf("M3.5 9v6", "M20.5 9v6"), strokeWidth = 2.4f, evenOdd = true)
    }

    val Download: ImageVector by lazy {
        glyph("download", fills = listOf("M10.2 3.5h3.6v6h2.8L12 15.5L7.4 9.5h2.8Z"), strokes = listOf("M4.5 19.5h15"), strokeWidth = 2.8f)
    }

    val Layers: ImageVector by lazy {
        glyph("layers", fills = listOf("M12 3l9 4.5l-9 4.5l-9 -4.5Z"), strokes = listOf("M4.5 12.5L12 16.2l7.5 -3.7", "M4.5 16.5L12 20.2l7.5 -3.7"))
    }

    /** Orthographic view/orbit control used by 3D data replays. */
    val Cube: ImageVector by lazy {
        glyph("cube", strokes = listOf("M12 2l9 5l-9 5l-9 -5Z", "M3 7v10l9 5l9 -5V7", "M12 12v10"), strokeWidth = 3.0f)
    }

    val Palette: ImageVector by lazy {
        glyph("palette", fills = listOf("M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0 -3H12a2 2 0 0 1 0 -4h4a5 5 0 0 0 5 -5a9 9 0 0 0 -9 -6ZM7.5 8.7a1.3 1.3 0 1 0 0.001 0ZM11.2 5.5a1.3 1.3 0 1 0 0.001 0ZM15.3 7.1a1.3 1.3 0 1 0 0.001 0ZM6 12.2a1.3 1.3 0 1 0 0.001 0Z"), evenOdd = true)
    }

    val Plus: ImageVector by lazy {
        glyph("plus", strokes = listOf("M12 5v14", "M5 12h14"), strokeWidth = 3.2f)
    }

    val Minus: ImageVector by lazy {
        glyph("minus", strokes = listOf("M5 12h14"), strokeWidth = 3.2f)
    }

    val Chart: ImageVector by lazy {
        glyph("chart", fills = listOf("M4 13h3.6v7H4Z", "M10.2 8h3.6v12h-3.6Z", "M16.4 4.5H20V20h-3.6Z"))
    }

    /** A route seen from above: start, curved ground trace and destination. */
    val GroundTrack: ImageVector by lazy {
        glyph("ground-track", fills = listOf("M5 16.8a2.2 2.2 0 1 0 0.001 0Z", "M19 5a2.2 2.2 0 1 0 0.001 0Z"), strokes = listOf("M6.8 15.5c2.7 -2.4 1.2 -5.8 4.5 -7.2c2.1 -0.9 3.7 0.1 5.8 -1.8"), strokeWidth = 2.8f)
    }

    /** A rising three-dimensional trace above its ground plane. */
    val SpatialPath: ImageVector by lazy {
        glyph("spatial-path", fills = listOf("M5 16.8a2 2 0 1 0 0.001 0Z", "M19 5a2 2 0 1 0 0.001 0Z"), strokes = listOf("M3 18.5l9 3.5l9 -3.5", "M6.5 15.6c2.8 -1 1.9 -5.3 5.4 -6.2c2.4 -0.6 3.3 -2.4 5.3 -3.3"))
    }

    /** Vertical descent rate toward the ground datum. */
    val SinkRate: ImageVector by lazy {
        glyph("sink-rate", strokes = listOf("M12 3.5v13", "M7.5 12.5L12 17l4.5 -4.5", "M4 20.5h16"), strokeWidth = 2.8f)
    }

    /** A saved GPS trace represented by distinct measured fixes. */
    val GpsPoints: ImageVector by lazy {
        glyph("gps-points", fills = listOf("M5 17.5a2 2 0 1 0 0.001 0Z", "M9.5 12a1.8 1.8 0 1 0 0.001 0Z", "M14.5 14.5a1.8 1.8 0 1 0 0.001 0Z", "M19 6a2 2 0 1 0 0.001 0Z"), strokes = listOf("M6.5 16l1.7 -2.1", "M11.1 12.8l1.8 0.9", "M15.7 12.9l2 -4.9"), strokeWidth = 2.2f)
    }

    /** A measured GPS trace with an explicit discontinuity. */
    val GpsBreak: ImageVector by lazy {
        glyph("gps-break", fills = listOf("M4.5 18a1.8 1.8 0 1 0 0.001 0Z", "M19.5 6a1.8 1.8 0 1 0 0.001 0Z"), strokes = listOf("M6 16.7c1.8 -2 2.6 -3.4 4 -4.1", "M14 10.5c1.7 -0.8 2.4 -2 4 -3.2", "M10.8 8.8l2.8 2.8", "M13.6 8.8l-2.8 2.8"), strokeWidth = 2.7f)
    }

    /** Horizontal speed across the landing datum. */
    val TouchdownRun: ImageVector by lazy {
        glyph("touchdown-run", strokes = listOf("M4 19.5h16", "M4.5 13.5h13", "M14 10l3.5 3.5L14 17"), strokeWidth = 2.8f)
    }

    /** Vertical sink into the landing datum. */
    val TouchdownSink: ImageVector by lazy {
        glyph("touchdown-sink", strokes = listOf("M4 19.5h16", "M12 3.5v11.8", "M7.8 11.2l4.2 4.2l4.2 -4.2"), strokeWidth = 2.8f)
    }

    /** Rotation in the horizontal plane: a flat loop seen in perspective. */
    val Yaw: ImageVector by lazy {
        glyph("yaw", strokes = listOf("M19.0 9.6A8.6 4.2 0 1 0 19.8 13.8", "M16.3 14.5L19.8 13.8L19.2 17.3"), strokeWidth = 2.5f)
    }

    /** Rotation in the vertical plane: a tall loop seen from the side. */
    val Pitch: ImageVector by lazy {
        glyph("pitch", strokes = listOf("M9.6 5.0A4.2 8.6 0 1 0 13.8 4.2", "M14.5 7.7L13.8 4.2L17.3 4.8"), strokeWidth = 2.5f)
    }

    /** Rotation about the axis pointing at the viewer: a round loop about that point. */
    val Roll: ImageVector by lazy {
        glyph("roll", fills = listOf("M12 10.4a1.6 1.6 0 1 0 0.001 0Z"), strokes = listOf("M16.4 5.8A7.6 7.6 0 1 0 19.1 14.6", "M16.2 16.7L19.1 14.6L20.0 18.1"), strokeWidth = 2.5f)
    }

    /** Rotation SPEED, not an axis: an orbit arrow with motion ticks. */
    val RotationRate: ImageVector by lazy {
        glyph("rotation-rate", strokes = listOf("M2.6 8.6h2.2", "M2.6 12h2.0", "M3.4 15.4h1.8", "M16.6 6.1A6.8 6.8 0 1 0 20.0 12.0", "M18.0 15.0L20.0 12.0L22.0 15.0"), strokeWidth = 2.5f)
    }

    val Clock: ImageVector by lazy {
        glyph("clock", fills = listOf("M12 2.5a9.5 9.5 0 1 0 0.001 0ZM11.2 6.5h1.6v6.2h-1.6ZM11.5 11.4l4.2 2.5l-0.8 1.4l-4.2 -2.5Z"), evenOdd = true)
    }

    val Wind: ImageVector by lazy {
        glyph("wind", strokes = listOf("M3 8.5h10.5a2.6 2.6 0 1 0 -2.6 -2.6", "M3 13h15a2.6 2.6 0 1 1 -2.6 2.6", "M3 17.5h8"), strokeWidth = 2.8f)
    }

    val Flag: ImageVector by lazy {
        glyph("flag", fills = listOf("M6 4.5c2.4 -1.3 4.8 -1.3 7.2 0c1.8 1 3.6 1.1 5.3 0.4v8c-1.7 0.7 -3.5 0.6 -5.3 -0.4c-2.4 -1.3 -4.8 -1.3 -7.2 0Z"), strokes = listOf("M6 21V4"), strokeWidth = 2.8f)
    }

    val Moon: ImageVector by lazy {
        glyph("moon", fills = listOf("M19.5 14.5A8.3 8.3 0 0 1 9.5 4.5A8.6 8.6 0 1 0 19.5 14.5Z"))
    }

    val Calendar: ImageVector by lazy {
        glyph("calendar", fills = listOf("M4 7.5h16V19a1.6 1.6 0 0 1 -1.6 1.6H5.6A1.6 1.6 0 0 1 4 19ZM7.4 11.2h2.4v1.6H7.4ZM13.6 11.2H16v1.6h-2.4ZM7.4 15h2.4v1.6H7.4ZM13.6 15H16v1.6h-2.4Z"), strokes = listOf("M8 3.5v4", "M16 3.5v4"), strokeWidth = 2.4f, evenOdd = true)
    }

    val Star: ImageVector by lazy {
        glyph("star", fills = listOf("M12 3.5l2.6 5.6l6.1 0.7l-4.5 4.2l1.2 6l-5.4 -3l-5.4 3l1.2 -6l-4.5 -4.2l6.1 -0.7Z"))
    }

    val CloudSun: ImageVector by lazy {
        glyph("cloud-sun", fills = listOf("M8.6 4.6a3.4 3.4 0 1 0 0.001 0Z", "M8.3 19h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 19Z"), strokes = listOf("M8.6 2.4v1.2", "M3.5 8h1.2", "M4.7 4.1l0.9 0.9", "M12.5 4.1l-0.9 0.9"), strokeWidth = 2.2f)
    }

    /** Two-tone layers: same geometry as the combined glyph, split so each part carries its own tint when stacked. */
    val CloudSunSun: ImageVector by lazy {
        glyph("cloud-sun-sun", fills = listOf("M8.6 4.6a3.4 3.4 0 1 0 0.001 0Z"), strokes = listOf("M8.6 2.4v1.2", "M3.5 8h1.2", "M4.7 4.1l0.9 0.9", "M12.5 4.1l-0.9 0.9"), strokeWidth = 2.2f)
    }

    val CloudSunCloud: ImageVector by lazy {
        glyph("cloud-sun-cloud", fills = listOf("M8.3 19h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 19Z"))
    }

    val RainCloud: ImageVector by lazy {
        glyph("rain-cloud", fills = listOf("M8.3 15h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 15Z"))
    }

    val RainDrops: ImageVector by lazy {
        glyph("rain-drops", fills = listOf("M7 13.5c1.6 0 2.8 -1.3 2.8 -2.9C9.8 8.9 7 5 7 5s-2.8 3.9 -2.8 5.6C4.2 12.2 5.4 13.5 7 13.5Z", "M16 19.5c1.9 0 3.4 -1.5 3.4 -3.4c0 -2 -3.4 -6.6 -3.4 -6.6s-3.4 4.6 -3.4 6.6c0 1.9 1.5 3.4 3.4 3.4Z"))
    }

    val StormCloud: ImageVector by lazy {
        glyph("storm-cloud", fills = listOf("M8.3 15h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 15Z"))
    }

    val StormBolt: ImageVector by lazy {
        glyph("storm-bolt", fills = listOf("M13.6 14.8l-4.2 5.4h2.7l-1.2 3.8l4.6 -5.5h-2.7Z"))
    }

    val Rain: ImageVector by lazy {
        glyph("rain", fills = listOf("M8.3 15h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 15Z"), strokes = listOf("M8 18l-1 2.8", "M13 18l-1 2.8", "M18 18l-1 2.8"), strokeWidth = 2.4f)
    }

    val Snow: ImageVector by lazy {
        glyph("snow", strokes = listOf("M12 2.5v19", "M4.2 6.7l15.6 10.6", "M19.8 6.7L4.2 17.3", "M9.3 4.2l2.7 1.8l2.7 -1.8", "M9.3 19.8l2.7 -1.8l2.7 1.8"), strokeWidth = 2.8f)
    }

    val Storm: ImageVector by lazy {
        glyph("storm", fills = listOf("M8.3 14h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 14Z", "M13.6 14.8l-4.2 5.4h2.7l-1.2 3.8l4.6 -5.5h-2.7Z"))
    }

    val Fog: ImageVector by lazy {
        glyph("fog", fills = listOf("M8.3 14h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 14Z"), strokes = listOf("M5 17.5h13", "M7.5 21h9"))
    }

    val Thermometer: ImageVector by lazy {
        glyph("thermometer", fills = listOf("M10.2 4.5a2.3 2.3 0 0 1 4.6 0v8.2a4.7 4.7 0 1 1 -4.6 0ZM11.4 6h1.2v7.2h-1.2Z"), evenOdd = true)
    }

    val ChevronLeft: ImageVector by lazy {
        glyph("chevron-left", strokes = listOf("M15 18l-6 -6l6 -6"), strokeWidth = 3.2f)
    }

    /** Head-up sit-fly figure: head on top, arms up, knees bent. */
    val Freefly: ImageVector by lazy {
        glyph("freefly", fills = listOf("M12 4.4m-2.1 0a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0"), strokes = listOf("M12 7v6", "M12 9.5L7.5 5.7", "M12 9.5l4.5 -3.8", "M12 13l-4 5.5", "M12 13l4 5.5"), strokeWidth = 2.8f)
    }

    /** Inverted figure: head at the bottom, legs up in a V. */
    val HeadDown: ImageVector by lazy {
        glyph("head-down", fills = listOf("M12 19.6m-2.1 0a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0"), strokes = listOf("M12 17v-6", "M12 14.5L7.5 18.3", "M12 14.5l4.5 3.8", "M12 11l-4 -5.5", "M12 11l4 -5.5"), strokeWidth = 2.8f)
    }

    /** Belly arch seen from the side, head to the right. */
    val BellyArch: ImageVector by lazy {
        glyph("belly-arch", fills = listOf("M20.6 11.9m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0"), strokes = listOf("M3.5 15Q12 7.5 20.5 15"), strokeWidth = 3.0f)
    }

    /** Write/edit — also fronts the NOTE row. */
    val Pencil: ImageVector by lazy {
        glyph("pencil", fills = listOf("M14.5 4.3l5.2 5.2L8.6 20.6l-5.8 1.4l1.4 -5.8ZM12.9 6.6l4.5 4.5l-0.9 0.9l-4.5 -4.5Z"), evenOdd = true)
    }

    /** Rough ground line — the bumpy landing badge. */
    val Zigzag: ImageVector by lazy {
        glyph("zigzag", strokes = listOf("M3 14.5l4.2 -4.5l4.3 4.5l4.3 -4.5l4.2 4.5"), strokeWidth = 3.2f)
    }

    /** Plain cross — the crash landing badge. */
    val Cross: ImageVector by lazy {
        glyph("cross", strokes = listOf("M6 6l12 12", "M18 6L6 18"), strokeWidth = 3.2f)
    }

    val ChevronRight: ImageVector by lazy {
        glyph("chevron-right", strokes = listOf("M9 18l6 -6l-6 -6"), strokeWidth = 3.2f)
    }

    val ChevronUp: ImageVector by lazy {
        glyph("chevron-up", strokes = listOf("M6 15l6 -6l6 6"), strokeWidth = 3.2f)
    }

    val ChevronDown: ImageVector by lazy {
        glyph("chevron-down", strokes = listOf("M6 9l6 6l6 -6"), strokeWidth = 3.2f)
    }

    val Home: ImageVector by lazy {
        glyph("home", fills = listOf("M12 3.2l8.5 7V19a1.5 1.5 0 0 1 -1.5 1.5h-4.5v-5.5h-5V20.5H5A1.5 1.5 0 0 1 3.5 19v-8.8Z"))
    }

    val Lock: ImageVector by lazy {
        glyph("lock", fills = listOf("M5.5 10.5h13a1.2 1.2 0 0 1 1.2 1.2v7.6a1.2 1.2 0 0 1 -1.2 1.2h-13a1.2 1.2 0 0 1 -1.2 -1.2v-7.6a1.2 1.2 0 0 1 1.2 -1.2ZM11.2 13.4h1.6v3.2h-1.6Z"), strokes = listOf("M8 10.5V7.5a4 4 0 0 1 8 0v3"), strokeWidth = 2.4f, evenOdd = true)
    }

    val Record: ImageVector by lazy {
        glyph("record", fills = listOf("M12 7.4a4.6 4.6 0 1 0 0.001 0Z"), strokes = listOf("M12 3.4a8.6 8.6 0 1 0 0.001 0Z"), strokeWidth = 2.8f)
    }

    val Stop: ImageVector by lazy {
        glyph("stop", fills = listOf("M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-11a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1Z"))
    }

    val Grid: ImageVector by lazy {
        glyph("grid", fills = listOf("M4.5 4.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1 -1 1h-15a1 1 0 0 1 -1 -1v-13a1 1 0 0 1 1 -1ZM9.4 4.9h1.1v14.2H9.4ZM13.5 4.9h1.1v14.2h-1.1ZM4.9 9.4h14.2v1.1H4.9ZM4.9 13.5h14.2v1.1H4.9Z"), evenOdd = true)
    }

    val Watch: ImageVector by lazy {
        glyph("watch", fills = listOf("M12 6.4a5.6 5.6 0 1 0 0.001 0Z", "M9 2.5h6l-0.6 3.2h-4.8Z", "M9 21.5h6l-0.6 -3.2h-4.8Z"))
    }

    val Play: ImageVector by lazy {
        glyph("play", fills = listOf("M8.2 5.1a1 1 0 0 1 1.5 -0.9l10.2 6.9a1 1 0 0 1 0 1.8L9.7 19.8a1 1 0 0 1 -1.5 -0.9Z"))
    }

    val Pause: ImageVector by lazy {
        glyph("pause", fills = listOf("M6.8 5h3.4a0.6 0.6 0 0 1 0.6 0.6v12.8a0.6 0.6 0 0 1 -0.6 0.6H6.8a0.6 0.6 0 0 1 -0.6 -0.6V5.6a0.6 0.6 0 0 1 0.6 -0.6Z", "M13.8 5h3.4a0.6 0.6 0 0 1 0.6 0.6v12.8a0.6 0.6 0 0 1 -0.6 0.6h-3.4a0.6 0.6 0 0 1 -0.6 -0.6V5.6a0.6 0.6 0 0 1 0.6 -0.6Z"))
    }

    val Phone: ImageVector by lazy {
        glyph("phone", fills = listOf("M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1 -1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5 -1.5ZM10.4 17.6h3.2v1.1h-3.2Z"), evenOdd = true)
    }
}

