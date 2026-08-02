package com.adelost.releasekit

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/** Release identity plus the source-owned absolute publication instant. */
data class ReleaseInfo(
    val versionName: String,
    val publishedAtEpochMillis: Long? = null,
)

/** Presentation-only strings. A null date label means that row is omitted. */
data class ReleaseInfoPresentation(
    val versionName: String,
    val publishedAtLabel: String?,
)

/**
 * Localizes a release instant only at the UI boundary.
 *
 * The update/data layers carry epoch milliseconds and never guess a timezone,
 * locale, build time or install time. Tests and non-default hosts inject their
 * own [zoneId] and [locale]; normal Phone/Wear hosts use the device values.
 */
fun releaseInfoPresentation(
    info: ReleaseInfo,
    zoneId: ZoneId = ZoneId.systemDefault(),
    locale: Locale = Locale.getDefault(),
): ReleaseInfoPresentation {
    val publishedAtLabel = info.publishedAtEpochMillis?.let { epochMillis ->
        DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT)
            .withLocale(locale)
            .format(Instant.ofEpochMilli(epochMillis).atZone(zoneId))
    }
    return ReleaseInfoPresentation(info.versionName, publishedAtLabel)
}
