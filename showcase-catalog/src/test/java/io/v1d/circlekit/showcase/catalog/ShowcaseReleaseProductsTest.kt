package io.v1d.circlekit.showcase.catalog

import com.adelost.releasekit.GitHubRelease
import com.adelost.releasekit.GitHubReleaseAsset
import com.adelost.releasekit.selectNewestCompatibleRelease
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ShowcaseReleaseProductsTest {
    private val digest = "sha256:${"a".repeat(64)}"
    private val publishedAt = 1_785_648_800_000L

    @Test
    fun `phone and wear select only their same-version signed release asset`() {
        val release = GitHubRelease(
            tagName = "v0.3.13",
            assets = listOf(
                asset("circlekit-showcase-phone-v0.3.13.apk"),
                asset("circlekit-showcase-wear-v0.3.13.apk"),
            ),
            publishedAtEpochMillis = publishedAt,
        )

        val phone = selectNewestCompatibleRelease(
            listOf(release),
            ShowcaseReleaseProducts.product(ShowcaseReleaseHost.PHONE),
        )
        val wear = selectNewestCompatibleRelease(
            listOf(release),
            ShowcaseReleaseProducts.product(ShowcaseReleaseHost.WEAR),
        )

        assertEquals("0.3.13", phone?.versionName)
        assertEquals(publishedAt, phone?.publishedAtEpochMillis)
        assertEquals("circlekit-showcase-phone-v0.3.13.apk", phone?.assetName)
        assertEquals("0.3.13", wear?.versionName)
        assertEquals(publishedAt, wear?.publishedAtEpochMillis)
        assertEquals("circlekit-showcase-wear-v0.3.13.apk", wear?.assetName)
    }

    @Test
    fun `host never accepts the other host apk`() {
        val wearOnly = GitHubRelease(
            tagName = "v0.3.13",
            assets = listOf(asset("circlekit-showcase-wear-v0.3.13.apk")),
        )

        assertNull(
            selectNewestCompatibleRelease(
                listOf(wearOnly),
                ShowcaseReleaseProducts.product(ShowcaseReleaseHost.PHONE),
            ),
        )
    }

    private fun asset(name: String) = GitHubReleaseAsset(
        name = name,
        apiUrl = "https://github.com/adelost/circlekit/releases/download/v0.3.13/$name",
        sizeBytes = 1_024,
        digest = digest,
    )
}
