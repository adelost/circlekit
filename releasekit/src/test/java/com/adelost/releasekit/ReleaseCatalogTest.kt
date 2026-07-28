package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleaseCatalogTest {
    @Test
    fun `legacy phone and universal Android select only their own signed release assets`() {
        val releases = parseGitHubReleases(FIXTURE)

        assertEquals(
            ReleaseCandidate(
                versionName = "0.5.336",
                assetName = "app-release.apk",
                downloadUrl = "https://sky.v1d.io/downloads/skyvw-altimeter.apk",
                sizeBytes = 4_000_000,
                sha256 = WATCH_SHA,
            ),
            selectNewestCompatibleRelease(releases, SkyvwReleaseProducts.UNIVERSAL_ANDROID),
        )
        assertEquals(
            ReleaseCandidate(
                versionName = "0.2.2",
                assetName = "skyvw-mobile-v0.2.2.apk",
                downloadUrl = "https://sky.v1d.io/downloads/skyvw-mobile.apk",
                sizeBytes = 5_000_000,
                sha256 = PHONE_SHA,
            ),
            selectNewestCompatibleRelease(releases, SkyvwReleaseProducts.PHONE),
        )
    }

    @Test
    fun `missing digest or ambiguous generic APK is fail safe`() {
        val releases = parseGitHubReleases(
            """[{"tag_name":"v9.9.9","assets":[
                {"name":"mobile-release.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":4},
                {"name":"skyvw-mobile-v9.9.9.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":4}
            ]}]""",
        )

        assertNull(selectNewestCompatibleRelease(releases, SkyvwReleaseProducts.PHONE))
    }

    @Test
    fun `draft prerelease and oversized APK metadata are ignored`() {
        val sha = "d".repeat(64)
        val releases = parseGitHubReleases(
            """[
              {"tag_name":"mobile-draft","draft":true,"assets":[{"name":"skyvw-mobile-v9.0.0.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":4,"digest":"sha256:$sha"}]},
              {"tag_name":"mobile-rc","prerelease":true,"assets":[{"name":"skyvw-mobile-v8.0.0.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":4,"digest":"sha256:$sha"}]},
              {"tag_name":"mobile-huge","assets":[{"name":"skyvw-mobile-v7.0.0.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":${MAX_RELEASE_APK_BYTES + 1},"digest":"sha256:$sha"}]}
            ]""",
        )

        assertNull(selectNewestCompatibleRelease(releases, SkyvwReleaseProducts.PHONE))
    }

    @Test
    fun `malformed versions never become updates`() {
        assertNull(SemanticVersion.parse("newest"))
        assertNull(SemanticVersion.parse("0.2"))
        assertEquals(false, isStrictlyNewerVersion("newest", "0.2.1"))
        assertEquals(false, isStrictlyNewerVersion("0.2.1", "broken"))
    }

    private companion object {
        const val WATCH_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        const val PHONE_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        val FIXTURE = """[
          {"tag_name":"v0.5.336","assets":[
            {"name":"app-release.apk","url":"https://sky.v1d.io/downloads/skyvw-altimeter.apk","size":4000000,"digest":"sha256:$WATCH_SHA"},
            {"name":"skyvw-mobile-v0.2.2.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":5000000,"digest":"sha256:$PHONE_SHA"}
          ]},
          {"tag_name":"v0.5.335","assets":[
            {"name":"skyvw-mobile-v0.2.1.apk","url":"https://sky.v1d.io/downloads/skyvw-mobile.apk","size":4900000,"digest":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}
          ]}
        ]"""
    }
}
