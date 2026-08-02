package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdatePolicyTest {
    @Test
    fun `installing and downloading states block duplicate actions`() {
        val installing = UpdateState.Installing("0.5.337", "/cache/update.apk")
        assertFalse(canCheckForUpdates(installing))
        assertFalse(canStartUpdateInstall(installing))
        assertEquals("Installing…", installActionLabel(installing))

        val downloading = UpdateState.Downloading("0.5.337", 0.5f)
        assertFalse(canCheckForUpdates(downloading))
        assertFalse(canStartUpdateInstall(downloading))
        assertEquals("Downloading…", installActionLabel(downloading))
    }

    @Test
    fun `verified ready and failed handoff remain explicitly retryable`() {
        assertTrue(canStartUpdateInstall(UpdateState.ReadyToInstall("0.5.337", "/cache/update.apk")))
        val failed = UpdateState.InstallFailed("0.5.337", "/cache/update.apk", "install blocked")
        assertTrue(canStartUpdateInstall(failed))
        assertEquals("Retry install", installActionLabel(failed))
    }

    @Test
    fun `an install tap claims installing before the apk is re-verified`() {
        val publishedAt = 1_801_234_567_890L
        val ready = UpdateState.ReadyToInstall(
            "0.5.441",
            "/cache/update.apk",
            6_154_512L,
            "New controls",
            publishedAt,
        )
        assertEquals(
            UpdateState.Installing(
                "0.5.441",
                "/cache/update.apk",
                6_154_512L,
                changelog = "New controls",
                publishedAtEpochMillis = publishedAt,
            ),
            installClaimState(ready),
        )

        val failed = UpdateState.InstallFailed(
            "0.5.441",
            "/cache/update.apk",
            "install blocked",
            6_154_512L,
            "New controls",
            publishedAt,
        )
        assertEquals(
            UpdateState.Installing(
                "0.5.441",
                "/cache/update.apk",
                6_154_512L,
                changelog = "New controls",
                publishedAtEpochMillis = publishedAt,
            ),
            installClaimState(failed),
        )
        assertEquals("New controls", updateTargetChangelog(installClaimState(ready)!!))
        assertEquals(ReleaseInfo("0.5.441", publishedAt), updateTargetReleaseInfo(installClaimState(ready)!!))
    }

    @Test
    fun `every release-bearing state preserves shared display metadata`() {
        val version = "0.5.441"
        val size = 6_154_512L
        val changelog = "New controls"
        val publishedAt = 1_801_234_567_890L
        val states = listOf(
            UpdateState.Available(version, size, changelog, publishedAt),
            UpdateState.Downloading(version, 0.5f, size, changelog, publishedAt),
            UpdateState.ReadyToInstall(version, "/cache/update.apk", size, changelog, publishedAt),
            UpdateState.Installing(
                version,
                "/cache/update.apk",
                size,
                changelog = changelog,
                publishedAtEpochMillis = publishedAt,
            ),
            UpdateState.InstallFailed(
                version,
                "/cache/update.apk",
                "blocked",
                size,
                changelog,
                publishedAt,
            ),
        )

        states.forEach { state ->
            assertEquals(ReleaseInfo(version, publishedAt), updateTargetReleaseInfo(state))
            assertEquals(size, updateTargetSizeBytes(state))
            assertEquals(changelog, updateTargetChangelog(state))
        }
    }

    @Test
    fun `states with nothing downloaded claim no install`() {
        assertNull(installClaimState(UpdateState.Available("0.5.441", 6_154_512L)))
        assertNull(installClaimState(UpdateState.Downloading("0.5.441", 0.5f)))
        assertNull(installClaimState(UpdateState.Installing("0.5.441", "/cache/update.apk")))
        assertNull(installClaimState(UpdateState.UpToDate))
    }

    @Test
    fun `version overview exposes installed latest distance and size`() {
        val overview = updateVersionOverview(
            currentVersionName = "0.5.335",
            currentVersionCode = 554,
            state = UpdateState.ReadyToInstall("0.5.337", "/cache/update.apk", 4_200_000L),
        )
        assertEquals("v0.5.335 · 554", overview.installedLabel)
        assertEquals("v0.5.337", overview.latestLabel)
        assertEquals("2 patches behind · 4.2 MB", overview.gapLabel)
    }

    @Test
    fun `up to date overview names the installed version as latest`() {
        val overview = updateVersionOverview("0.2.3", 6, UpdateState.UpToDate)
        assertEquals("v0.2.3", overview.latestLabel)
        assertNull(overview.gapLabel)
    }

    @Test
    fun `unknown malformed or non-new versions never become update gaps`() {
        assertNull(updateGapLabel("0.5.336", "broken"))
        assertNull(updateGapLabel("0.5.336", "0.5.336"))
        assertEquals("Update available", updateGapLabel("0.5.336", "0.6.0"))
    }

    @Test
    fun `install preflight requires enough temporary storage`() {
        val apkSize = 42L * 1024L * 1024L
        assertEquals(
            "Not enough storage · free 83 MB",
            installStorageFailureLabel(apkSize, 80L * 1024L * 1024L),
        )
        assertNull(installStorageFailureLabel(apkSize, 160L * 1024L * 1024L))
        assertNull(installStorageFailureLabel(apkSize, null))
    }
}
