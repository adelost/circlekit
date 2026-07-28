package com.adelost.releasekit

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Expiry is what stops a revoked release from installing off the cache days
 * later, so the predicate is pinned at its boundary rather than inferred.
 */
class ReleaseExpiryTest {
    private val now = 1_700_000_000_000L

    private fun candidate(validUntilEpochMs: Long?) = ReleaseCandidate(
        versionName = "1.2.3",
        assetName = "link.apk",
        downloadUrl = "https://link.v1d.io/downloads/link.apk",
        sizeBytes = 4_096L,
        sha256 = "a".repeat(64),
        versionCode = 123,
        validUntilEpochMs = validUntilEpochMs,
    )

    @Test
    fun `metadata is expired at the very instant it names`() {
        // Fail closed on the boundary: admitting it leaves one tick in which a
        // withdrawn release is still installable.
        assertTrue(candidate(now).isExpiredAt(now))
    }

    @Test
    fun `metadata one millisecond in the future is still valid`() {
        assertFalse(candidate(now + 1).isExpiredAt(now))
    }

    @Test
    fun `metadata already past its deadline is expired`() {
        assertTrue(candidate(now - 1).isExpiredAt(now))
    }

    @Test
    fun `a source that publishes no deadline never expires`() {
        // Circle's GitHub feed carries no expiry. Absence of a claim must not
        // be read as a stale claim, or its updates would never install.
        assertFalse(candidate(null).isExpiredAt(now))
        assertFalse(candidate(null).isExpiredAt(Long.MAX_VALUE))
    }

    @Test
    fun `cached ready metadata keeps the deadline it was stored with`() {
        // The cache round-trip is where expiry is easiest to silently drop:
        // ReadyUpdateMetadata is what UpdateController rebuilds a candidate
        // from before it re-checks expiry ahead of installer handoff.
        val stored = ReadyUpdateMetadata(
            versionName = "1.2.3",
            versionCode = 123,
            assetName = "link.apk",
            apkPath = "/data/user/0/io.agentmux.link/cache/link-update.apk",
            sizeBytes = 4_096L,
            sha256 = "a".repeat(64),
            validUntilEpochMs = now - 1,
        )
        val restored = candidate(stored.validUntilEpochMs)
        assertTrue(restored.isExpiredAt(now))
    }
}
