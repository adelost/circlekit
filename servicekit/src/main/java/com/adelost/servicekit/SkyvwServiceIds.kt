package com.adelost.servicekit

/** Product-wide ids: one spelling across scheduler, HTTP clients and UI catalog. */
object SkyvwServiceIds {
    val WEATHER = ServiceId("weather")
    val AIRCRAFT = ServiceId("traffic")
    val AIRPORT_PRESSURE = ServiceId("airport-pressure")
    val CLOUDS = ServiceId("clouds")
    val MAP_OBJECTS = ServiceId("map-objects")
    val AVIATION_TARGETS = ServiceId("aviation-targets")
    val MAP_TILES = ServiceId("map-tiles")
    val JUMP_WEATHER = ServiceId("jump-weather")
    val TERRAIN = ServiceId("terrain")
    val GROUND_REFERENCES = ServiceId("ground-references")
    val TRACKBOOK = ServiceId("trackbook")
    val WATCH_ACCOUNT = ServiceId("watch-account")
    val UPDATES = ServiceId("updates")

    /** Complete product catalog. App declarations must match this set exactly. */
    val ALL = listOf(
        WEATHER,
        JUMP_WEATHER,
        AIRPORT_PRESSURE,
        AIRCRAFT,
        CLOUDS,
        MAP_OBJECTS,
        AVIATION_TARGETS,
        MAP_TILES,
        TERRAIN,
        GROUND_REFERENCES,
        TRACKBOOK,
        WATCH_ACCOUNT,
        UPDATES,
    )
}
