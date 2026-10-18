package com.adelost.designkit.ui

/** Content identity comes from the producer, never a renderer parsing its display string. */
sealed interface CircleTextContent { val text: String }

fun CircleTextContent.isNotBlank(): Boolean = text.isNotBlank()

data class CircleWords(override val text: String) : CircleTextContent

sealed interface CircleTextValue : CircleTextContent

/** A formatted count, date, time or unitless value. */
data class CircleNumerals(override val text: String) : CircleTextValue

/** The formatter supplies the value and unit separately. */
data class CircleMeasurement(val value: String, val unit: String?) : CircleTextValue {
    constructor(reading: com.adelost.designkit.measurement.MeasurementText) : this(reading.value, reading.unit)
    override val text: String get() = value + (unit?.takeIf(String::isNotBlank)?.let { " $it" } ?: "")
}
