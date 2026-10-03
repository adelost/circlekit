// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM test/stored-acme.ts
// Generator SHA-256: fixture
package dev.acme.stored

import dev.acme.store.AcmeStore
import dev.acme.store.ChoiceValue
import dev.acme.store.FlagValue
import dev.acme.store.IntValue
import dev.acme.store.LongValue
import dev.acme.store.NumberValue
import dev.acme.store.StoredValue
import dev.acme.store.TextValue

/** Saved values with no settings row: each key, default and range as declared, read by the stores. */
object GeneratedAcmeStoredValues {
    val AcmeSound = FlagValue(id = "acme.sound", wireName = "soundOn", store = AcmeStore.ACME_SETTINGS, defaultValue = true)
    val AcmeCacheRadius = IntValue(id = "acme.cache-radius", wireName = "cacheRadiusM", store = AcmeStore.ACME_SETTINGS, defaultValue = 20000, min = 500, max = 30000, step = 10000)
    val AcmeScatter = LongValue(id = "acme.scatter", wireName = "scatterM", store = AcmeStore.ACME_SETTINGS, defaultValue = 250L, min = 0L, max = null)
    val AcmePickedDay = LongValue(id = "acme.picked-day", wireName = "pickedEpochDay", store = AcmeStore.ACME_SETTINGS, defaultValue = null, min = 0L, max = null)
    val AcmeAltitudeStep = NumberValue(id = "acme.altitude-step", wireName = "altitudeStepM", store = AcmeStore.ACME_SETTINGS, defaultValue = 0.5f, min = 0.1f, max = 1.0f, step = 0.1f)
    val AcmeNoise = NumberValue(id = "acme.noise", wireName = "noiseP95M", store = AcmeStore.ACME_SETTINGS, defaultValue = null, min = 0.0f, max = null, step = null)
    val AcmeGlide = NumberValue(id = "acme.glide", wireName = "glideRatio", store = AcmeStore.ACME_SETTINGS, defaultValue = 2.5f, min = null, max = 20.0f, step = null)
    val AcmeDropAltitude = NumberValue(id = "acme.drop-altitude", wireName = "dropAltitudeM", store = AcmeStore.ACME_SETTINGS, defaultValue = 4000.0f, min = null, max = null, step = null)
    val AcmeIconStyle = ChoiceValue(id = "acme.icon-style", wireName = "iconStyle", store = AcmeStore.ACME_SETTINGS, defaultValue = "FILLED", values = listOf("FILLED", "OUTLINE"))
    val AcmeVectorSource = TextValue(id = "acme.vector-source", wireName = "vectorSourceId", store = AcmeStore.ACME_SETTINGS, defaultValue = "tiles-main")

    val all: List<StoredValue> = listOf(AcmeSound, AcmeCacheRadius, AcmeScatter, AcmePickedDay, AcmeAltitudeStep, AcmeNoise, AcmeGlide, AcmeDropAltitude, AcmeIconStyle, AcmeVectorSource)
}
