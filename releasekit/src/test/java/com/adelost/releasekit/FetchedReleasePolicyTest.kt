package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Test

class FetchedReleasePolicyTest {
    private val product = ReleaseProductContract(
        id = "fixture",
        packageName = "io.v1d.fixture",
        versionForAsset = { _, _ -> null },
    )

    @Test
    fun `current release preserves the fetched publication identity`() {
        val publishedAt = 1_801_234_567_890L
        val state = fetchedReleaseState(
            fetched = candidate("1.2.2", publishedAt),
            product = product,
            currentVersionName = "1.2.2",
            currentVersionCode = 10,
            nowEpochMs = publishedAt + 1_000L,
        )

        assertEquals(UpdateState.UpToDate("1.2.2", publishedAt), state)
        assertEquals(ReleaseInfo("1.2.2", publishedAt), state.releaseInfo)
    }

    @Test
    fun `newer release remains available for the automatic download path`() {
        val publishedAt = 1_801_234_567_890L
        val state = fetchedReleaseState(
            fetched = candidate("1.2.3", publishedAt),
            product = product,
            currentVersionName = "1.2.2",
            currentVersionCode = 10,
            nowEpochMs = publishedAt + 1_000L,
        )

        assertEquals(
            UpdateState.Available("1.2.3", 4_200_000L, "New controls", publishedAt),
            state,
        )
    }

    private fun candidate(versionName: String, publishedAt: Long) = ReleaseCandidate(
        versionName = versionName,
        assetName = "fixture.apk",
        downloadUrl = "https://example.invalid/fixture.apk",
        sizeBytes = 4_200_000L,
        sha256 = "a".repeat(64),
        changelog = "New controls",
        publishedAtEpochMillis = publishedAt,
    )
}
