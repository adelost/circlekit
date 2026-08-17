package com.adelost.designkit.ui

import androidx.compose.ui.graphics.vector.ImageVector

/** Name-keyed lookup used by the FILLED/OUTLINE style switch. */
val RING_ICON_OUTLINE_BY_NAME: Map<String, ImageVector> by lazy {
    listOf(
        RingIconsOutline.Arrow, RingIconsOutline.Cloud, RingIconsOutline.Plane, RingIconsOutline.Gps,
        RingIconsOutline.Map, RingIconsOutline.Mountain, RingIconsOutline.Sun, RingIconsOutline.Book,
        RingIconsOutline.Wrench, RingIconsOutline.Sliders, RingIconsOutline.Ruler, RingIconsOutline.Gear,
        RingIconsOutline.Chute, RingIconsOutline.Activity, RingIconsOutline.Eye, RingIconsOutline.EyeOff,
        RingIconsOutline.Speaker, RingIconsOutline.Wifi, RingIconsOutline.Refresh, RingIconsOutline.Check,
        RingIconsOutline.Warning, RingIconsOutline.Clown, RingIconsOutline.Trash, RingIconsOutline.Target, RingIconsOutline.Gauge,
        RingIconsOutline.Bell, RingIconsOutline.Link, RingIconsOutline.Vibrate, RingIconsOutline.Download,
        RingIconsOutline.Layers, RingIconsOutline.Cube, RingIconsOutline.Palette, RingIconsOutline.Plus,
        RingIconsOutline.Minus, RingIconsOutline.Chart, RingIconsOutline.GroundTrack,
        RingIconsOutline.SpatialPath, RingIconsOutline.SinkRate, RingIconsOutline.GpsPoints,
        RingIconsOutline.GpsBreak, RingIconsOutline.TouchdownRun, RingIconsOutline.TouchdownSink,
        RingIconsOutline.Yaw, RingIconsOutline.Pitch, RingIconsOutline.Roll, RingIconsOutline.RotationRate,
        RingIconsOutline.Clock, RingIconsOutline.Wind, RingIconsOutline.Flag, RingIconsOutline.Moon,
        RingIconsOutline.Calendar, RingIconsOutline.Star, RingIconsOutline.CloudSun,
        RingIconsOutline.CloudSunSun, RingIconsOutline.CloudSunCloud, RingIconsOutline.RainCloud,
        RingIconsOutline.RainDrops, RingIconsOutline.StormCloud, RingIconsOutline.StormBolt,
        RingIconsOutline.Rain, RingIconsOutline.Snow, RingIconsOutline.Storm, RingIconsOutline.Fog,
        RingIconsOutline.Thermometer, RingIconsOutline.ChevronLeft, RingIconsOutline.Freefly,
        RingIconsOutline.HeadDown, RingIconsOutline.BellyArch, RingIconsOutline.Pencil,
        RingIconsOutline.Info,
        RingIconsOutline.Zigzag, RingIconsOutline.Cross, RingIconsOutline.ChevronRight,
        RingIconsOutline.ChevronUp, RingIconsOutline.ChevronDown, RingIconsOutline.Home,
        RingIconsOutline.Lock, RingIconsOutline.Record, RingIconsOutline.Stop, RingIconsOutline.Grid,
        RingIconsOutline.Watch, RingIconsOutline.Phone, RingIconsOutline.Play, RingIconsOutline.Pause,
    ).associateBy { requireNotNull(it.name) }
}
