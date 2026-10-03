// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM test/stored-acme.ts
// Generator SHA-256: fixture
package dev.acme.stored

import dev.acme.store.KeyValueStore
import dev.acme.ui.IconStyle

/** What the 'acme-settings' store saves, as fields; a native state class implements them by delegating to [GeneratedAcmeSettingsStored]. */
interface GeneratedAcmeSettingsStoredFields {
    val soundEnabled: Boolean
    val cacheRadiusM: Int
    val scatterM: Long
    val pickedEpochDay: Long?
    val lastSyncEpochMs: Long?
    val altitudeStepM: Float
    val noiseP95M: Float?
    val offsetM: Float?
    val glideRatio: Float
    val dropAltitudeM: Float
    val iconStyle: IconStyle
    val vectorSourceId: String
}

/** What the 'acme-settings' store saves: each field under its declared key, with its declared default and range. */
data class GeneratedAcmeSettingsStored(
    override val soundEnabled: Boolean = true,
    override val cacheRadiusM: Int = 20000,
    override val scatterM: Long = 250L,
    override val pickedEpochDay: Long? = null,
    override val lastSyncEpochMs: Long? = null,
    override val altitudeStepM: Float = 0.5f,
    override val noiseP95M: Float? = null,
    override val offsetM: Float? = null,
    override val glideRatio: Float = 2.5f,
    override val dropAltitudeM: Float = 4000.0f,
    override val iconStyle: IconStyle = IconStyle.FILLED,
    override val vectorSourceId: String = "tiles-main",
) : GeneratedAcmeSettingsStoredFields {
    /** Every field under its key: a ranged value clamped, an absent optional as null. */
    fun writeTo(changes: MutableMap<String, Any?>) {
        changes["soundOn"] = this.soundEnabled
        changes["cacheRadiusM"] = this.cacheRadiusM.coerceIn(500, 30000)
        changes["scatterM"] = this.scatterM.coerceAtLeast(0L)
        changes["pickedEpochDay"] = this.pickedEpochDay
        changes["lastSyncEpochMs"] = this.lastSyncEpochMs
        changes["altitudeStepM"] = this.altitudeStepM.coerceIn(0.1f, 1.0f)
        changes["noiseP95M"] = this.noiseP95M
        changes["offsetM"] = this.offsetM
        changes["glideRatio"] = this.glideRatio.coerceAtMost(20.0f)
        changes["dropAltitudeM"] = this.dropAltitudeM
        changes["iconStyle"] = this.iconStyle.name
        changes["vectorSourceId"] = this.vectorSourceId
    }

    companion object {
        /** Every field from its key: missing is the default, a ranged value is clamped, an optional out of bounds is absent. */
        fun read(values: KeyValueStore): GeneratedAcmeSettingsStored = GeneratedAcmeSettingsStored(
            soundEnabled = values.boolean("soundOn", true),
            cacheRadiusM = values.int("cacheRadiusM", 20000).coerceIn(500, 30000),
            scatterM = values.long("scatterM", 250L).coerceAtLeast(0L),
            pickedEpochDay = values.long("pickedEpochDay", Long.MIN_VALUE).takeIf { it != Long.MIN_VALUE && it >= 0L },
            lastSyncEpochMs = values.long("lastSyncEpochMs", Long.MIN_VALUE).takeIf { it != Long.MIN_VALUE },
            altitudeStepM = values.float("altitudeStepM", 0.5f).coerceIn(0.1f, 1.0f),
            noiseP95M = values.float("noiseP95M", Float.NaN).takeIf { it.isFinite() && it >= 0.0f },
            offsetM = values.float("offsetM", Float.NaN).takeIf { it.isFinite() },
            glideRatio = values.float("glideRatio", 2.5f).coerceAtMost(20.0f),
            dropAltitudeM = values.float("dropAltitudeM", 4000.0f),
            iconStyle = values.string("iconStyle")?.let { s -> IconStyle.entries.firstOrNull { it.name == s } }
                ?: IconStyle.FILLED,
            vectorSourceId = values.string("vectorSourceId") ?: "tiles-main",
        )
    }
}

/** Kotlin refuses a native enum whose entries differ from the declared choices. */
private fun declaredIconStyle(value: IconStyle): Unit = when (value) { IconStyle.FILLED, IconStyle.OUTLINE -> Unit }
