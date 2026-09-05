// GENERATED from circlekit-assets/src/ring-icon-assets.ts - do not edit.
package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/** Filled Ring geometry. Product semantics stay in portable ProductSpec data. */
object RingIcons {
    private fun glyph(name: String, paths: ImageVector.Builder.() -> Unit): ImageVector = ImageVector.Builder(
        name = name, defaultWidth = 24.dp, defaultHeight = 24.dp,
        viewportWidth = 24f, viewportHeight = 24f,
    ).apply(paths).build()

    private fun ImageVector.Builder.fill(data: String, fillType: PathFillType) {
        addPath(
            pathData = addPathNodes(data),
            pathFillType = fillType,
            fill = SolidColor(Color.White),
        )
    }

    private fun ImageVector.Builder.stroke(data: String, width: Float) {
        addPath(
            pathData = addPathNodes(data), fill = null, stroke = SolidColor(Color.White),
            strokeLineWidth = width, strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
        )
    }

    val Data: ImageVector by lazy { glyph("data") { fill("M4 6C4 3.8 7.6 2.5 12 2.5S20 3.8 20 6S16.4 9.5 12 9.5S4 8.2 4 6ZM4 9C6 10.5 9 11.3 12 11.3S18 10.5 20 9V12.6C20 14.6 16.4 16 12 16S4 14.6 4 12.6ZM4 15.7C6 17.2 9 18 12 18S18 17.2 20 15.7V19.2C20 21 16.4 22 12 22S4 21 4 19.2Z", PathFillType.NonZero) } }
    val Arrow: ImageVector by lazy { glyph("arrow") { stroke("M12 20V5", 3.2f); stroke("M5 11l7 -7l7 7", 3.2f) } }
    val Cloud: ImageVector by lazy { glyph("cloud") { fill("M7.6 18h9.3a3.6 3.6 0 0 0 0.6 -7.2a5.1 5.1 0 0 0 -9.9 -1.2A3.9 3.9 0 0 0 7.6 18Z", PathFillType.NonZero) } }
    val Plane: ImageVector by lazy { glyph("plane") { fill("M21 15.2v-2.4l-8 -4.8V3.4a1.4 1.4 0 0 0 -2.8 0V8l-8 4.8v2.4l8 -2.4v4.6l-2.4 1.8v1.8l3.8 -1.1l3.8 1.1v-1.8L13 17.4v-4.6Z", PathFillType.NonZero) } }
    val Gps: ImageVector by lazy { glyph("gps") { fill("M12 9.8a2.2 2.2 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M2.5 12h3", 3f); stroke("M18.5 12h3", 3f); stroke("M12 2.5v3", 3f); stroke("M12 18.5v3", 3f); stroke("M12 5.2a6.8 6.8 0 1 0 0.001 0Z", 3f) } }
    val Map: ImageVector by lazy { glyph("map") { fill("M4.7 5.3L9 3.5l6 2l4.2 -1.7a1 1 0 0 1 1.3 0.9v12.9a1.5 1.5 0 0 1 -1 1.4L15 20.5l-6 -2l-4.2 1.7a1 1 0 0 1 -1.3 -0.9V6.7a1.5 1.5 0 0 1 1.2 -1.4ZM8.4 5.2h1.2v12.6H8.4ZM14.4 6.4h1.2v12.4h-1.4Z", PathFillType.EvenOdd) } }
    val Mountain: ImageVector by lazy { glyph("mountain") { fill("M3 19L9.2 7l3.4 6.2L15 10l6 9Z", PathFillType.NonZero) } }
    val Sun: ImageVector by lazy { glyph("sun") { fill("M12 7.4a4.6 4.6 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M12 3v2.4", 2.8f); stroke("M12 18.6V21", 2.8f); stroke("M3 12h2.4", 2.8f); stroke("M18.6 12H21", 2.8f); stroke("M5.7 5.7l1.7 1.7", 2.8f); stroke("M16.6 16.6l1.7 1.7", 2.8f); stroke("M18.3 5.7l-1.7 1.7", 2.8f); stroke("M7.4 16.6l-1.7 1.7", 2.8f) } }
    val Book: ImageVector by lazy { glyph("book") { fill("M12 5.2C9.6 3.8 6.5 3.7 4 4.9a1.8 1.8 0 0 0 -1 1.6v10.9c0 1 1.1 1.7 2 1.3c2.3 -0.9 4.9 -0.8 7 0.4c2.1 -1.2 4.7 -1.3 7 -0.4c0.9 0.4 2 -0.3 2 -1.3V6.5a1.8 1.8 0 0 0 -1 -1.6c-2.5 -1.2 -5.6 -1.1 -8 0.3ZM11.4 5.4h1.2v13.4h-1.2Z", PathFillType.EvenOdd) } }
    val Wrench: ImageVector by lazy { glyph("wrench") { fill("M15.4 5.6a4.4 4.4 0 0 0 -5.8 5.6L4 16.8a2.1 2.1 0 0 0 3 3l5.6 -5.6a4.4 4.4 0 0 0 5.6 -5.8l-3 3l-2.6 -2.6Z", PathFillType.NonZero) } }
    val Sliders: ImageVector by lazy { glyph("sliders") { fill("M9.5 5.3a2.2 2.2 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M15 9.8a2.2 2.2 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M7.5 14.3a2.2 2.2 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M4 7.5h16", 2.8f); stroke("M4 12h16", 2.8f); stroke("M4 16.5h16", 2.8f) } }
    val Ruler: ImageVector by lazy { glyph("ruler") { fill("M3 9.5h18a1 1 0 0 1 1 1V16a1 1 0 0 1 -1 1H3a1 1 0 0 1 -1 -1v-5.5a1 1 0 0 1 1 -1ZM7 9.9h1.3v3H7ZM11.4 9.9h1.3v3h-1.3ZM15.8 9.9h1.3v3h-1.3Z", PathFillType.EvenOdd) } }
    val Gear: ImageVector by lazy { glyph("gear") { fill("M9.75 2.26H14.25V4.17L15.12 4.47L15.95 4.87L17.3 3.52L20.48 6.7L19.13 8.05L19.53 8.88L19.83 9.75H21.74V14.25H19.83L19.53 15.12L19.13 15.95L20.48 17.3L17.3 20.48L15.95 19.13L15.12 19.53L14.25 19.83V21.74H9.75V19.83L8.88 19.53L8.05 19.13L6.7 20.48L3.52 17.3L4.87 15.95L4.47 15.12L4.17 14.25H2.26V9.75H4.17L4.47 8.88L4.87 8.05L3.52 6.7L6.7 3.52L8.05 4.87L8.88 4.47L9.75 4.17ZM12 8.6a3.4 3.4 0 1 0 0.001 0Z", PathFillType.EvenOdd) } }
    val Chute: ImageVector by lazy { glyph("chute") { fill("M12 3a9 9 0 0 0 -9 8.6a0.9 0.9 0 0 0 0.9 0.9h16.2a0.9 0.9 0 0 0 0.9 -0.9A9 9 0 0 0 12 3Z", PathFillType.NonZero); fill("M12 18.4a1.7 1.7 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M5.5 13.5l6.5 6l6.5 -6", 2.2f) } }
    val Activity: ImageVector by lazy { glyph("activity") { fill("M3.5 20v-3l5.5 -7l3.4 3l5.6 -7.5l2.5 1.9V20Z", PathFillType.NonZero) } }
    val Eye: ImageVector by lazy { glyph("eye") { fill("M12 5.5C7 5.5 3.3 9.1 2 12c1.3 2.9 5 6.5 10 6.5S20.7 14.9 22 12c-1.3 -2.9 -5 -6.5 -10 -6.5ZM12 8.8a3.2 3.2 0 1 0 0.001 0Z", PathFillType.EvenOdd); fill("M12 10.3a1.7 1.7 0 1 0 0.001 0Z", PathFillType.EvenOdd) } }
    val EyeOff: ImageVector by lazy { glyph("eye-off") { fill("M2.6 12L5.2 9.2L8.4 7L12 6.2L15.6 7L18.8 9.2L21.4 12L18.8 14.8L15.6 17L12 17.8L8.4 17L5.2 14.8ZM14.5 12A2.5 2.5 0 1 0 9.5 12A2.5 2.5 0 1 0 14.5 12Z", PathFillType.EvenOdd); fill("M4.8 20.9L19.2 3.1L20.6 4.3L6.2 22.1Z", PathFillType.NonZero) } }
    val Speaker: ImageVector by lazy { glyph("speaker") { fill("M4 9.5h3.5L13 5v14l-5.5 -4.5H4Z", PathFillType.NonZero); stroke("M16 9a4.2 4.2 0 0 1 0 6", 2.4f); stroke("M18.6 6.6a8 8 0 0 1 0 10.8", 2.4f) } }
    val Wifi: ImageVector by lazy { glyph("wifi") { fill("M12 17.8a1.9 1.9 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M2.5 9.3a14.5 14.5 0 0 1 19 0", 3f); stroke("M5.5 13a10 10 0 0 1 13 0", 3f); stroke("M8.7 16.6a5 5 0 0 1 6.6 0", 3f) } }
    val Refresh: ImageVector by lazy { glyph("refresh") { fill("M20.8 3.2v5.2h-5.2Z", PathFillType.NonZero); stroke("M19.5 12a7.5 7.5 0 1 1 -2.2 -5.3", 3f) } }
    val Check: ImageVector by lazy { glyph("check") { stroke("M20 6L9 17l-5 -5", 3.2f) } }
    val Warning: ImageVector by lazy { glyph("warning") { fill("M12 3.2a1.8 1.8 0 0 1 1.6 0.9l8 13.8a1.8 1.8 0 0 1 -1.6 2.7H4a1.8 1.8 0 0 1 -1.6 -2.7l8 -13.8A1.8 1.8 0 0 1 12 3.2ZM11.2 9h1.6v5h-1.6ZM11.05 16.2a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0Z", PathFillType.EvenOdd) } }
    val Info: ImageVector by lazy { glyph("info") { fill("M10.6 9h2.8v10h-2.8ZM10.25 5.6a1.75 1.75 0 1 0 3.5 0a1.75 1.75 0 1 0 -3.5 0Z", PathFillType.NonZero) } }
    val Clown: ImageVector by lazy { glyph("clown") { fill("M5.3 5.4a3 3 0 1 0 0.001 0ZM9 4a3 3 0 1 0 0.001 0ZM15 4a3 3 0 1 0 0.001 0ZM18.7 5.4a3 3 0 1 0 0.001 0ZM4.6 10a3 3 0 1 0 0.001 0ZM19.4 10a3 3 0 1 0 0.001 0Z", PathFillType.EvenOdd); fill("M12 4.5C7.8 4.5 5.5 7.7 5.5 12.1C5.5 17 8.1 20.5 12 20.5s6.5 -3.5 6.5 -8.4C18.5 7.7 16.2 4.5 12 4.5ZM8.8 8.9a1.15 1.15 0 1 0 0.001 0ZM15.2 8.9a1.15 1.15 0 1 0 0.001 0ZM12 10.2a2.05 2.05 0 1 0 0.001 0ZM7.8 14.3C8.7 16.4 10.1 17.4 12 17.4s3.3 -1 4.2 -3.1c-1.4 0.8 -2.8 1.1 -4.2 1.1s-2.8 -0.3 -4.2 -1.1Z", PathFillType.EvenOdd); fill("M12 10.9a1.35 1.35 0 1 0 0.001 0Z", PathFillType.EvenOdd) } }
    val Trash: ImageVector by lazy { glyph("trash") { fill("M5.5 7.5h13l-1 12.2a1.8 1.8 0 0 1 -1.8 1.6H8.3a1.8 1.8 0 0 1 -1.8 -1.6ZM9.4 10.8h1.3v6.4H9.4ZM13.3 10.8h1.3v6.4h-1.3Z", PathFillType.EvenOdd); stroke("M4 7.5h16", 2.2f); stroke("M9.5 7.5V5.6a1.1 1.1 0 0 1 1.1 -1.1h2.8a1.1 1.1 0 0 1 1.1 1.1v1.9", 2.2f) } }
    val Target: ImageVector by lazy { glyph("target") { fill("M12 10.4a1.6 1.6 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M12 4a8 8 0 1 0 0.001 0Z", 2.6f); stroke("M12 7.8a4.2 4.2 0 1 0 0.001 0Z", 2.6f) } }
    val Gauge: ImageVector by lazy { glyph("gauge") { fill("M12 6A9.5 9.5 0 0 0 2.5 15.5a2 2 0 0 0 2 2h15a2 2 0 0 0 2 -2A9.5 9.5 0 0 0 12 6ZM10.9 16.4l4.8 -5.7l1.1 0.9l-4.8 5.7Z", PathFillType.EvenOdd) } }
    val Bell: ImageVector by lazy { glyph("bell") { fill("M12 3.5a5.6 5.6 0 0 1 5.6 5.6c0 3.8 1.4 5.4 2.4 6.4H4c1 -1 2.4 -2.6 2.4 -6.4A5.6 5.6 0 0 1 12 3.5Z", PathFillType.NonZero); fill("M9.8 17.5a2.3 2.3 0 0 0 4.4 0Z", PathFillType.NonZero) } }
    val Link: ImageVector by lazy { glyph("link") { fill("M4.2 9.0L12.6 9.0L12.6 15.0L4.2 15.0ZM6.2 10.8L10.6 10.8L10.6 13.2L6.2 13.2Z", PathFillType.EvenOdd); fill("M11.4 9.0L19.8 9.0L19.8 15.0L11.4 15.0ZM13.4 10.8L17.8 10.8L17.8 13.2L13.4 13.2Z", PathFillType.EvenOdd) } }
    val Vibrate: ImageVector by lazy { glyph("vibrate") { fill("M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1 -1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5 -1.5ZM10.4 17.6h3.2v1.1h-3.2Z", PathFillType.EvenOdd); stroke("M3.5 9v6", 2.4f); stroke("M20.5 9v6", 2.4f) } }
    val Download: ImageVector by lazy { glyph("download") { fill("M10.2 3.5h3.6v6h2.8L12 15.5L7.4 9.5h2.8Z", PathFillType.NonZero); stroke("M4.5 19.5h15", 2.8f) } }
    val Layers: ImageVector by lazy { glyph("layers") { fill("M12 3l9 4.5l-9 4.5l-9 -4.5Z", PathFillType.NonZero); stroke("M4.5 12.5L12 16.2l7.5 -3.7", 2.6f); stroke("M4.5 16.5L12 20.2l7.5 -3.7", 2.6f) } }
    val Cube: ImageVector by lazy { glyph("cube") { fill("M12 2.4L20.6 7.2L20.6 16.8L12 21.6L3.4 16.8L3.4 7.2ZM12.3 11.5L4.2 7.2L3.6 8.2L11.7 12.5ZM12.3 12.5L20.4 8.2L19.8 7.2L11.7 11.5ZM11.4 12.6L11.4 21.4L12.6 21.4L12.6 12.6Z", PathFillType.EvenOdd) } }
    val Palette: ImageVector by lazy { glyph("palette") { fill("M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0 -3H12a2 2 0 0 1 0 -4h4a5 5 0 0 0 5 -5a9 9 0 0 0 -9 -6ZM7.5 8.7a1.3 1.3 0 1 0 0.001 0ZM11.2 5.5a1.3 1.3 0 1 0 0.001 0ZM15.3 7.1a1.3 1.3 0 1 0 0.001 0ZM6 12.2a1.3 1.3 0 1 0 0.001 0Z", PathFillType.EvenOdd) } }
    val Plus: ImageVector by lazy { glyph("plus") { stroke("M12 5v14", 3.2f); stroke("M5 12h14", 3.2f) } }
    val Minus: ImageVector by lazy { glyph("minus") { stroke("M5 12h14", 3.2f) } }
    val Chart: ImageVector by lazy { glyph("chart") { fill("M4 13h3.6v7H4Z", PathFillType.NonZero); fill("M10.2 8h3.6v12h-3.6Z", PathFillType.NonZero); fill("M16.4 4.5H20V20h-3.6Z", PathFillType.NonZero) } }
    val GroundTrack: ImageVector by lazy { glyph("ground-track") { fill("M5 16.8a2.2 2.2 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M19 5a2.2 2.2 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M6.8 15.5c2.7 -2.4 1.2 -5.8 4.5 -7.2c2.1 -0.9 3.7 0.1 5.8 -1.8", 2.8f) } }
    val SpatialPath: ImageVector by lazy { glyph("spatial-path") { fill("M5 16.8a2 2 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M19 5a2 2 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M3 18.5l9 3.5l9 -3.5", 2.6f); stroke("M6.5 15.6c2.8 -1 1.9 -5.3 5.4 -6.2c2.4 -0.6 3.3 -2.4 5.3 -3.3", 2.6f) } }
    val SinkRate: ImageVector by lazy { glyph("sink-rate") { stroke("M12 3.5v13", 2.8f); stroke("M7.5 12.5L12 17l4.5 -4.5", 2.8f); stroke("M4 20.5h16", 2.8f) } }
    val GpsPoints: ImageVector by lazy { glyph("gps-points") { fill("M5 17.5a2 2 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M9.5 12a1.8 1.8 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M14.5 14.5a1.8 1.8 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M19 6a2 2 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M6.5 16l1.7 -2.1", 2.2f); stroke("M11.1 12.8l1.8 0.9", 2.2f); stroke("M15.7 12.9l2 -4.9", 2.2f) } }
    val GpsBreak: ImageVector by lazy { glyph("gps-break") { fill("M4.5 18a1.8 1.8 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M19.5 6a1.8 1.8 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M6 16.7c1.8 -2 2.6 -3.4 4 -4.1", 2.7f); stroke("M14 10.5c1.7 -0.8 2.4 -2 4 -3.2", 2.7f); stroke("M10.8 8.8l2.8 2.8", 2.7f); stroke("M13.6 8.8l-2.8 2.8", 2.7f) } }
    val TouchdownRun: ImageVector by lazy { glyph("touchdown-run") { stroke("M4 19.5h16", 2.8f); stroke("M4.5 13.5h13", 2.8f); stroke("M14 10l3.5 3.5L14 17", 2.8f) } }
    val TouchdownSink: ImageVector by lazy { glyph("touchdown-sink") { stroke("M4 19.5h16", 2.8f); stroke("M12 3.5v11.8", 2.8f); stroke("M7.8 11.2l4.2 4.2l4.2 -4.2", 2.8f) } }
    val Yaw: ImageVector by lazy { glyph("yaw") { stroke("M19.0 9.6A8.6 4.2 0 1 0 19.8 13.8", 2.5f); stroke("M16.3 14.5L19.8 13.8L19.2 17.3", 2.5f) } }
    val Pitch: ImageVector by lazy { glyph("pitch") { stroke("M9.6 5.0A4.2 8.6 0 1 0 13.8 4.2", 2.5f); stroke("M14.5 7.7L13.8 4.2L17.3 4.8", 2.5f) } }
    val Roll: ImageVector by lazy { glyph("roll") { fill("M12 10.4a1.6 1.6 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M16.4 5.8A7.6 7.6 0 1 0 19.1 14.6", 2.5f); stroke("M16.2 16.7L19.1 14.6L20.0 18.1", 2.5f) } }
    val RotationRate: ImageVector by lazy { glyph("rotation-rate") { stroke("M2.6 8.6h2.2", 2.5f); stroke("M2.6 12h2.0", 2.5f); stroke("M3.4 15.4h1.8", 2.5f); stroke("M16.6 6.1A6.8 6.8 0 1 0 20.0 12.0", 2.5f); stroke("M18.0 15.0L20.0 12.0L22.0 15.0", 2.5f) } }
    val Clock: ImageVector by lazy { glyph("clock") { fill("M12 2.5a9.5 9.5 0 1 0 0.001 0ZM11.2 6.5h1.6v6.2h-1.6ZM11.5 11.4l4.2 2.5l-0.8 1.4l-4.2 -2.5Z", PathFillType.EvenOdd) } }
    val Wind: ImageVector by lazy { glyph("wind") { stroke("M3 8.5h10.5a2.6 2.6 0 1 0 -2.6 -2.6", 2.8f); stroke("M3 13h15a2.6 2.6 0 1 1 -2.6 2.6", 2.8f); stroke("M3 17.5h8", 2.8f) } }
    val Flag: ImageVector by lazy { glyph("flag") { fill("M6 4.5c2.4 -1.3 4.8 -1.3 7.2 0c1.8 1 3.6 1.1 5.3 0.4v8c-1.7 0.7 -3.5 0.6 -5.3 -0.4c-2.4 -1.3 -4.8 -1.3 -7.2 0Z", PathFillType.NonZero); stroke("M6 21V4", 2.8f) } }
    val Moon: ImageVector by lazy { glyph("moon") { fill("M19.5 14.5A8.3 8.3 0 0 1 9.5 4.5A8.6 8.6 0 1 0 19.5 14.5Z", PathFillType.NonZero) } }
    val Calendar: ImageVector by lazy { glyph("calendar") { fill("M4 7.5h16V19a1.6 1.6 0 0 1 -1.6 1.6H5.6A1.6 1.6 0 0 1 4 19ZM7.4 11.2h2.4v1.6H7.4ZM13.6 11.2H16v1.6h-2.4ZM7.4 15h2.4v1.6H7.4ZM13.6 15H16v1.6h-2.4Z", PathFillType.EvenOdd); stroke("M8 3.5v4", 2.4f); stroke("M16 3.5v4", 2.4f) } }
    val Star: ImageVector by lazy { glyph("star") { fill("M12 3.5l2.6 5.6l6.1 0.7l-4.5 4.2l1.2 6l-5.4 -3l-5.4 3l1.2 -6l-4.5 -4.2l6.1 -0.7Z", PathFillType.NonZero) } }
    val CloudSun: ImageVector by lazy { glyph("cloud-sun") { fill("M8.6 4.6a3.4 3.4 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M8.3 19h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 19Z", PathFillType.NonZero); stroke("M8.6 2.4v1.2", 2.2f); stroke("M3.5 8h1.2", 2.2f); stroke("M4.7 4.1l0.9 0.9", 2.2f); stroke("M12.5 4.1l-0.9 0.9", 2.2f) } }
    val CloudSunSun: ImageVector by lazy { glyph("cloud-sun-sun") { fill("M8.6 4.6a3.4 3.4 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M8.6 2.4v1.2", 2.2f); stroke("M3.5 8h1.2", 2.2f); stroke("M4.7 4.1l0.9 0.9", 2.2f); stroke("M12.5 4.1l-0.9 0.9", 2.2f) } }
    val CloudSunCloud: ImageVector by lazy { glyph("cloud-sun-cloud") { fill("M8.3 19h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 19Z", PathFillType.NonZero) } }
    val RainCloud: ImageVector by lazy { glyph("rain-cloud") { fill("M8.3 15h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 15Z", PathFillType.NonZero) } }
    val RainDrops: ImageVector by lazy { glyph("rain-drops") { fill("M7 13.5c1.6 0 2.8 -1.3 2.8 -2.9C9.8 8.9 7 5 7 5s-2.8 3.9 -2.8 5.6C4.2 12.2 5.4 13.5 7 13.5Z", PathFillType.NonZero); fill("M16 19.5c1.9 0 3.4 -1.5 3.4 -3.4c0 -2 -3.4 -6.6 -3.4 -6.6s-3.4 4.6 -3.4 6.6c0 1.9 1.5 3.4 3.4 3.4Z", PathFillType.NonZero) } }
    val StormCloud: ImageVector by lazy { glyph("storm-cloud") { fill("M8.3 15h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 15Z", PathFillType.NonZero) } }
    val StormBolt: ImageVector by lazy { glyph("storm-bolt") { fill("M13.6 14.8l-4.2 5.4h2.7l-1.2 3.8l4.6 -5.5h-2.7Z", PathFillType.NonZero) } }
    val Rain: ImageVector by lazy { glyph("rain") { fill("M8.3 15h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 15Z", PathFillType.NonZero); stroke("M8 18l-1 2.8", 2.4f); stroke("M13 18l-1 2.8", 2.4f); stroke("M18 18l-1 2.8", 2.4f) } }
    val Snow: ImageVector by lazy { glyph("snow") { fill("M14.3 13.3L12 14.7L9.7 13.3L9.7 10.7L12 9.3L14.3 10.7ZM14.6 13.2L22.2 12.6L23.1 12L22.2 11.4L14.6 10.8ZM12.2 14.9L16.6 21.1L17.6 21.6L17.6 20.6L14.4 13.6ZM9.6 13.6L6.4 20.6L6.4 21.6L7.4 21.1L11.8 14.9ZM9.4 10.8L1.8 11.4L0.9 12L1.8 12.6L9.4 13.2ZM11.8 9.1L7.4 2.9L6.4 2.4L6.4 3.4L9.6 10.4ZM14.4 10.4L17.6 3.4L17.6 2.4L16.6 2.9L12.2 9.1Z", PathFillType.EvenOdd) } }
    val Storm: ImageVector by lazy { glyph("storm") { fill("M8.3 14h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 14Z", PathFillType.NonZero); fill("M13.6 14.8l-4.2 5.4h2.7l-1.2 3.8l4.6 -5.5h-2.7Z", PathFillType.NonZero) } }
    val Fog: ImageVector by lazy { glyph("fog") { fill("M8.3 14h8.6a3.4 3.4 0 0 0 0.6 -6.8a4.9 4.9 0 0 0 -9.5 -1.1A3.7 3.7 0 0 0 8.3 14Z", PathFillType.NonZero); stroke("M5 17.5h13", 2.6f); stroke("M7.5 21h9", 2.6f) } }
    val Thermometer: ImageVector by lazy { glyph("thermometer") { fill("M10.2 4.5a2.3 2.3 0 0 1 4.6 0v8.2a4.7 4.7 0 1 1 -4.6 0ZM11.4 6h1.2v7.2h-1.2Z", PathFillType.EvenOdd) } }
    val ChevronLeft: ImageVector by lazy { glyph("chevron-left") { stroke("M15 18l-6 -6l6 -6", 3.2f) } }
    val Freefly: ImageVector by lazy { glyph("freefly") { fill("M12 4.4m-2.1 0a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0", PathFillType.NonZero); stroke("M12 7v6", 2.8f); stroke("M12 9.5L7.5 5.7", 2.8f); stroke("M12 9.5l4.5 -3.8", 2.8f); stroke("M12 13l-4 5.5", 2.8f); stroke("M12 13l4 5.5", 2.8f) } }
    val HeadDown: ImageVector by lazy { glyph("head-down") { fill("M12 19.6m-2.1 0a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0", PathFillType.NonZero); stroke("M12 17v-6", 2.8f); stroke("M12 14.5L7.5 18.3", 2.8f); stroke("M12 14.5l4.5 3.8", 2.8f); stroke("M12 11l-4 -5.5", 2.8f); stroke("M12 11l4 -5.5", 2.8f) } }
    val BellyArch: ImageVector by lazy { glyph("belly-arch") { fill("M20.6 11.9m-1.8 0a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0", PathFillType.NonZero); stroke("M3.5 15Q12 7.5 20.5 15", 3f) } }
    val Pencil: ImageVector by lazy { glyph("pencil") { fill("M14.5 4.3l5.2 5.2L8.6 20.6l-5.8 1.4l1.4 -5.8ZM12.9 6.6l4.5 4.5l-0.9 0.9l-4.5 -4.5Z", PathFillType.EvenOdd) } }
    val Zigzag: ImageVector by lazy { glyph("zigzag") { stroke("M3 14.5l4.2 -4.5l4.3 4.5l4.3 -4.5l4.2 4.5", 3.2f) } }
    val Cross: ImageVector by lazy { glyph("cross") { stroke("M6 6l12 12", 3.2f); stroke("M18 6L6 18", 3.2f) } }
    val ChevronRight: ImageVector by lazy { glyph("chevron-right") { stroke("M9 18l6 -6l-6 -6", 3.2f) } }
    val ChevronUp: ImageVector by lazy { glyph("chevron-up") { stroke("M6 15l6 -6l6 6", 3.2f) } }
    val ChevronDown: ImageVector by lazy { glyph("chevron-down") { stroke("M6 9l6 6l6 -6", 3.2f) } }
    val Home: ImageVector by lazy { glyph("home") { fill("M12 3.2l8.5 7V19a1.5 1.5 0 0 1 -1.5 1.5h-4.5v-5.5h-5V20.5H5A1.5 1.5 0 0 1 3.5 19v-8.8Z", PathFillType.NonZero) } }
    val Lock: ImageVector by lazy { glyph("lock") { fill("M5.5 10.5h13a1.2 1.2 0 0 1 1.2 1.2v7.6a1.2 1.2 0 0 1 -1.2 1.2h-13a1.2 1.2 0 0 1 -1.2 -1.2v-7.6a1.2 1.2 0 0 1 1.2 -1.2ZM11.2 13.4h1.6v3.2h-1.6Z", PathFillType.EvenOdd); stroke("M8 10.5V7.5a4 4 0 0 1 8 0v3", 2.4f) } }
    val Record: ImageVector by lazy { glyph("record") { fill("M12 7.4a4.6 4.6 0 1 0 0.001 0Z", PathFillType.NonZero); stroke("M12 3.4a8.6 8.6 0 1 0 0.001 0Z", 2.8f) } }
    val Stop: ImageVector by lazy { glyph("stop") { fill("M6.5 6.5h11a1 1 0 0 1 1 1v9a1 1 0 0 1 -1 1h-11a1 1 0 0 1 -1 -1v-9a1 1 0 0 1 1 -1Z", PathFillType.NonZero) } }
    val Grid: ImageVector by lazy { glyph("grid") { fill("M4.5 4.5h15a1 1 0 0 1 1 1v13a1 1 0 0 1 -1 1h-15a1 1 0 0 1 -1 -1v-13a1 1 0 0 1 1 -1ZM9.4 4.9h1.1v14.2H9.4ZM13.5 4.9h1.1v14.2h-1.1ZM4.9 9.4h14.2v1.1H4.9ZM4.9 13.5h14.2v1.1H4.9Z", PathFillType.EvenOdd) } }
    val Watch: ImageVector by lazy { glyph("watch") { fill("M12 6.4a5.6 5.6 0 1 0 0.001 0Z", PathFillType.NonZero); fill("M9 2.5h6l-0.6 3.2h-4.8Z", PathFillType.NonZero); fill("M9 21.5h6l-0.6 -3.2h-4.8Z", PathFillType.NonZero) } }
    val Play: ImageVector by lazy { glyph("play") { fill("M8.2 5.1a1 1 0 0 1 1.5 -0.9l10.2 6.9a1 1 0 0 1 0 1.8L9.7 19.8a1 1 0 0 1 -1.5 -0.9Z", PathFillType.NonZero) } }
    val Pause: ImageVector by lazy { glyph("pause") { fill("M6.8 5h3.4a0.6 0.6 0 0 1 0.6 0.6v12.8a0.6 0.6 0 0 1 -0.6 0.6H6.8a0.6 0.6 0 0 1 -0.6 -0.6V5.6a0.6 0.6 0 0 1 0.6 -0.6Z", PathFillType.NonZero); fill("M13.8 5h3.4a0.6 0.6 0 0 1 0.6 0.6v12.8a0.6 0.6 0 0 1 -0.6 0.6h-3.4a0.6 0.6 0 0 1 -0.6 -0.6V5.6a0.6 0.6 0 0 1 0.6 -0.6Z", PathFillType.NonZero) } }
    val Phone: ImageVector by lazy { glyph("phone") { fill("M8.5 3.5h7A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1 -1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5a1.5 1.5 0 0 1 1.5 -1.5ZM10.4 17.6h3.2v1.1h-3.2Z", PathFillType.EvenOdd) } }
}
