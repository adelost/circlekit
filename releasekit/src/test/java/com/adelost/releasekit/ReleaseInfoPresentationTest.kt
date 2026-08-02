package com.adelost.releasekit

import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleaseInfoPresentationTest {
    @Test
    fun `one UTC instant localizes in the injected device zone`() {
        val info = ReleaseInfo("1.2.3", Instant.parse("2026-01-15T18:30:00Z").toEpochMilli())

        assertEquals(
            "Jan 15, 2026, 1:30 PM",
            releaseInfoPresentation(info, ZoneId.of("America/New_York"), Locale.US).publishedAtLabel,
        )
        assertEquals(
            "Jan 16, 2026, 3:30 AM",
            releaseInfoPresentation(info, ZoneId.of("Asia/Tokyo"), Locale.US).publishedAtLabel,
        )
    }

    @Test
    fun `DST transition is resolved by ZoneId rather than fixed offset math`() {
        val zone = ZoneId.of("America/New_York")
        val before = ReleaseInfo("1.2.3", Instant.parse("2026-03-08T06:30:00Z").toEpochMilli())
        val after = ReleaseInfo("1.2.3", Instant.parse("2026-03-08T07:30:00Z").toEpochMilli())

        assertEquals("Mar 8, 2026, 1:30 AM", releaseInfoPresentation(before, zone, Locale.US).publishedAtLabel)
        assertEquals("Mar 8, 2026, 3:30 AM", releaseInfoPresentation(after, zone, Locale.US).publishedAtLabel)
    }

    @Test
    fun `unknown publication time omits only the date row`() {
        val presentation = releaseInfoPresentation(
            ReleaseInfo("1.2.3", publishedAtEpochMillis = null),
            ZoneId.of("UTC"),
            Locale.US,
        )

        assertEquals("1.2.3", presentation.versionName)
        assertNull(presentation.publishedAtLabel)
    }
}
