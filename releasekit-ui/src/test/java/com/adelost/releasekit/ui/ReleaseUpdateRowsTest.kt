package com.adelost.releasekit.ui

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.releasekit.UpdateState
import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class ReleaseUpdateRowsTest {
    @Test
    fun `up to date release keeps its localized publication row`() {
        val publishedAt = Instant.parse("2026-08-02T16:24:31.289Z").toEpochMilli()
        val rows = releaseUpdateRows(
            state = UpdateState.UpToDate("1.2.2", publishedAt),
            currentVersionName = "1.2.2",
            onCheck = {},
            onInstall = {},
            zoneId = ZoneId.of("Europe/Stockholm"),
            locale = Locale.US,
        )

        assertEquals(listOf("update", "update-published"), rows.map { it.key })
        assertEquals("v1.2.2 · UP TO DATE · TAP", rows.first().sub)
        assertEquals("PUBLISHED", rows.last().title)
        assertEquals("v1.2.2 · Aug 2, 2026, 6:24 PM", rows.last().sub)
    }

    @Test
    fun `known publication creates canonical update and localized publication rows`() {
        var checks = 0
        var installs = 0
        val rows = releaseUpdateRows(
            state = UpdateState.Available(
                "1.2.4",
                4_200_000L,
                publishedAtEpochMillis = Instant.parse("2026-08-02T05:33:20Z").toEpochMilli(),
            ),
            currentVersionName = "1.2.3",
            onCheck = { checks += 1 },
            onInstall = { installs += 1 },
            zoneId = ZoneId.of("America/New_York"),
            locale = Locale.US,
        )

        assertEquals(listOf("update", "update-published"), rows.map { it.key })
        assertEquals("UPDATE", rows.first().title)
        assertEquals("v1.2.4 AVAILABLE · TAP", rows.first().sub)
        assertSame(RingIcons.Download, rows.first().icon)
        rows.first().onTap?.invoke()
        assertEquals(0, checks)
        assertEquals(1, installs)
        assertEquals("PUBLISHED", rows.last().title)
        assertEquals("v1.2.4 · Aug 2, 2026, 1:33 AM", rows.last().sub)
        assertSame(RingIcons.Calendar, rows.last().icon)
        assertNull(rows.last().onTap)
    }

    @Test
    fun `one UTC instant localizes in a second zone and null omits the publication row`() {
        val publishedAt = Instant.parse("2026-08-02T05:33:20Z").toEpochMilli()
        val tokyo = releaseUpdateRows(
            state = UpdateState.Available("1.2.4", 4_200_000L, publishedAtEpochMillis = publishedAt),
            currentVersionName = "1.2.3",
            onCheck = {},
            onInstall = {},
            zoneId = ZoneId.of("Asia/Tokyo"),
            locale = Locale.US,
        )

        assertEquals("v1.2.4 · Aug 2, 2026, 2:33 PM", tokyo.last().sub)
        assertEquals(
            listOf("update"),
            releaseUpdateRows(
                state = UpdateState.Available("1.2.4", 4_200_000L),
                currentVersionName = "1.2.3",
                onCheck = {},
                onInstall = {},
            ).map { it.key },
        )
    }

    @Test
    fun `shared atom owns progress failure semantics and actual product overrides`() {
        var checks = 0
        val checking = releaseUpdateRows(
            state = UpdateState.Checking,
            currentVersionName = "1.2.3",
            onCheck = {},
            onInstall = {},
            updateKey = "update-state",
            updateTitle = "VERSION",
            hint = "Checks the product release source.",
        ).single()
        assertEquals("update-state", checking.key)
        assertEquals("VERSION", checking.title)
        assertEquals("Checks the product release source.", checking.hint)
        assertNull(checking.onTap)
        assertSame(CircleLabelProgress.Indeterminate, checking.labelProgress)

        val downloading = releaseUpdateRows(
            state = UpdateState.Downloading("1.2.4", 0.56f),
            currentVersionName = "1.2.3",
            onCheck = {},
            onInstall = {},
        ).single()
        val progress = downloading.labelProgress as? CircleLabelProgress.Determinate
        assertNotNull(progress)
        assertEquals(0.56f, progress?.fraction ?: 0f, 0f)

        val failed = releaseUpdateRows(
            state = UpdateState.Failed("network unavailable"),
            currentVersionName = "1.2.3",
            onCheck = { checks += 1 },
            onInstall = {},
        ).single()
        assertEquals(RingTokens.Broken, failed.semanticColor)
        assertNotNull(failed.onTap)
        failed.onTap?.invoke()
        assertEquals(1, checks)
    }
}
