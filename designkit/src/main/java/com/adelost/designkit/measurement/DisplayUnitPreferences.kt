package com.adelost.designkit.measurement

import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/** User-facing altitude convention. Domain values always remain metres. */
enum class AltitudeDisplayUnit(val optionLabel: String) {
    METRES("METRES"),
    FEET("FEET"),
}

/**
 * User-facing horizontal convention. A system is selected instead of a bare
 * metre/foot suffix so long distances can naturally graduate to km or miles.
 */
enum class DistanceDisplayUnit(val optionLabel: String) {
    METRIC("METRIC"),
    IMPERIAL("IMPERIAL"),
}

/** A value and suffix stay separate so hero components can size them independently. */
data class MeasurementText(val value: String, val unit: String) {
    fun spaced(): String = if (unit.isEmpty()) value else "$value $unit"
    fun compact(): String = value + unit
}

/**
 * The single display-only seam between SI domain data and UI strings.
 *
 * Altitude and horizontal distance are intentionally independent because a
 * host may combine imperial altitude with metric map distances. Every speed
 * remains SI (m/s), independent of those two display choices. This prevents
 * one view from mixing ft/s, mph and m/s while altitude and distance use
 * their selected conventions.
 */
data class DisplayUnitPreferences(
    val altitude: AltitudeDisplayUnit = AltitudeDisplayUnit.METRES,
    val distance: DistanceDisplayUnit = DistanceDisplayUnit.METRIC,
) {
    fun formatAltitude(metres: Float, decimals: Int = 0): MeasurementText = when (altitude) {
        AltitudeDisplayUnit.METRES -> MeasurementText(decimal(metres, decimals), "m")
        AltitudeDisplayUnit.FEET -> MeasurementText(decimal(metres * METRES_TO_FEET, decimals), "ft")
    }

    /** Compact long-range value: 1.7 km / 5.6 kft instead of five digits. */
    fun formatAltitudeCompact(metres: Float): MeasurementText = when (altitude) {
        AltitudeDisplayUnit.METRES -> if (abs(metres) >= METRES_PER_KILOMETRE) {
            MeasurementText(decimal(metres / METRES_PER_KILOMETRE, 1), "km")
        } else {
            formatAltitude(metres)
        }
        AltitudeDisplayUnit.FEET -> {
            val feet = metres * METRES_TO_FEET
            if (abs(feet) >= FEET_PER_KILOFOOT) {
                MeasurementText(decimal(feet / FEET_PER_KILOFOOT, 1), "kft")
            } else {
                MeasurementText(decimal(feet, 0), "ft")
            }
        }
    }

    /**
     * Primary altitude readout. Keep the measured value in ordinary units:
     * metric tenths while the value has at most three whole digits, then whole
     * metres. Feet are always whole because a tenth of a foot overstates the
     * barometer's physical resolution. Never coarsen either unit to ten-unit
     * steps or compact it to km/kft; responsive typography owns fitting.
     */
    fun formatDialAltitude(metres: Float): MeasurementText = when (altitude) {
        AltitudeDisplayUnit.METRES ->
            dialAltitude(metres, "m", allowTenths = true)
        AltitudeDisplayUnit.FEET -> {
            val feet = metres * METRES_TO_FEET
            dialAltitude(feet, "ft", allowTenths = false)
        }
    }

    /**
     * Horizontal distance, graduating to km/miles once the metre form gets long.
     *
     * [longFormDecimals] governs ONLY that graduated form. Null keeps the
     * adaptive ladder every existing caller renders today — one decimal from a
     * kilometre, none past ten — so passing nothing is byte-for-byte what it
     * always was. A host that wants a steadier reading, rather than one whose
     * precision drops as the number grows, states the decimals it wants.
     *
     * The metre/foot form takes no decimals at any setting: a tenth of a metre
     * is below what a horizontal fix resolves, and "850.00 m" would be four
     * digits of confidence nobody measured.
     */
    fun formatDistance(metres: Float, longFormDecimals: Int? = null): MeasurementText =
        when (distance) {
            DistanceDisplayUnit.METRIC -> when {
                abs(metres) >= 10f * METRES_PER_KILOMETRE -> MeasurementText(
                    decimal(metres / METRES_PER_KILOMETRE, longFormDecimals ?: 0),
                    "km",
                )
                abs(metres) >= METRES_PER_KILOMETRE -> MeasurementText(
                    decimal(metres / METRES_PER_KILOMETRE, longFormDecimals ?: 1),
                    "km",
                )
                else -> MeasurementText(metres.roundToInt().toString(), "m")
            }
            DistanceDisplayUnit.IMPERIAL -> {
                val feet = metres * METRES_TO_FEET
                when {
                    abs(metres) >= 10f * METRES_PER_MILE -> MeasurementText(
                        decimal(metres / METRES_PER_MILE, longFormDecimals ?: 0),
                        "mi",
                    )
                    abs(metres) >= METRES_PER_MILE -> MeasurementText(
                        decimal(metres / METRES_PER_MILE, longFormDecimals ?: 1),
                        "mi",
                    )
                    else -> MeasurementText(feet.roundToInt().toString(), "ft")
                }
            }
        }

    fun formatVerticalSpeed(metresPerSecond: Float, decimals: Int = 1): MeasurementText =
        formatSpeedSi(metresPerSecond, decimals)

    fun formatHorizontalSpeed(metresPerSecond: Float, decimals: Int = 1): MeasurementText =
        formatSpeedSi(metresPerSecond, decimals)

    /** The sole user-facing speed formatter: domain values and labels are SI. */
    private fun formatSpeedSi(metresPerSecond: Float, decimals: Int): MeasurementText =
        MeasurementText(decimal(metresPerSecond, decimals), "m/s")

    companion object {
        /** Invalid or future persisted names revert independently to safe legacy defaults. */
        fun fromStoredNames(altitude: String?, distance: String?): DisplayUnitPreferences =
            DisplayUnitPreferences(
                altitude = enumValueOrDefault(altitude, AltitudeDisplayUnit.METRES),
                distance = enumValueOrDefault(distance, DistanceDisplayUnit.METRIC),
            )

        private inline fun <reified T : Enum<T>> enumValueOrDefault(name: String?, fallback: T): T =
            name?.let { value -> enumValues<T>().firstOrNull { it.name == value } } ?: fallback
    }
}

private fun decimal(value: Float, places: Int): String {
    require(places >= 0) { "Decimal places cannot be negative" }
    return if (places == 0) value.roundToInt().toString()
    else String.format(Locale.US, "%.${places}f", value)
}

/**
 * A tenth is useful while the rounded readout still has at most three whole
 * digits. The rule is display-unit based and phase-free: descending through
 * 1,000 immediately restores the decimal instead of waiting for LANDED.
 */
private fun dialDecimalFits(value: Float): Boolean =
    (abs(value) * 10f).roundToInt() < DIAL_DECIMAL_THRESHOLD * 10

private fun dialAltitude(
    value: Float,
    unit: String,
    allowTenths: Boolean,
): MeasurementText =
    MeasurementText(
        value = if (allowTenths && dialDecimalFits(value)) {
            decimal(value, 1)
        } else {
            value.roundToInt().toString()
        },
        unit = unit,
    )

private const val METRES_TO_FEET = 3.280839895f
private const val METRES_PER_KILOMETRE = 1_000f
private const val FEET_PER_KILOFOOT = 1_000f
private const val METRES_PER_MILE = 1_609.344f
private const val DIAL_DECIMAL_THRESHOLD = 1_000
