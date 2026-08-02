package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReleaseCatalogTest {
    @Test
    fun `public browser URL wins over token-oriented API URL`() {
        val releases = parseGitHubReleases(
            """[{"tag_name":"v1.2.3","assets":[{"name":"app-v1.2.3.apk","url":"https://api.github.com/repos/a/b/releases/assets/1","browser_download_url":"https://github.com/a/b/releases/download/v1.2.3/app-v1.2.3.apk","size":10,"digest":"sha256:${"a".repeat(64)}"}]}]""",
        )

        assertEquals(
            "https://github.com/a/b/releases/download/v1.2.3/app-v1.2.3.apk",
            releases.single().assets.single().apiUrl,
        )
    }
    // Product identities belong to products, so the selection mechanism is
    // exercised through fixtures declared here. Reaching into a consumer's
    // catalog would have made this test fail whenever that consumer renamed
    // an asset — a fact about Circle, not about selectNewestCompatibleRelease.
    @Test
    fun `two products select only their own signed release assets`() {
        val releases = parseGitHubReleases(FIXTURE)

        assertEquals(
            ReleaseCandidate(
                versionName = "0.5.336",
                assetName = "app-release.apk",
                downloadUrl = "https://sky.v1d.io/downloads/circle-altimeter.apk",
                sizeBytes = 4_000_000,
                sha256 = WATCH_SHA,
            ),
            selectNewestCompatibleRelease(releases, UNIVERSAL),
        )
        assertEquals(
            ReleaseCandidate(
                versionName = "0.2.2",
                assetName = "circle-mobile-v0.2.2.apk",
                downloadUrl = "https://sky.v1d.io/downloads/circle-mobile.apk",
                sizeBytes = 5_000_000,
                sha256 = PHONE_SHA,
            ),
            selectNewestCompatibleRelease(releases, LEGACY_PHONE),
        )
    }

    @Test
    fun `missing digest or ambiguous generic APK is fail safe`() {
        val releases = parseGitHubReleases(
            """[{"tag_name":"v9.9.9","assets":[
                {"name":"mobile-release.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":4},
                {"name":"circle-mobile-v9.9.9.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":4}
            ]}]""",
        )

        assertNull(selectNewestCompatibleRelease(releases, LEGACY_PHONE))
    }

    @Test
    fun `draft prerelease and oversized APK metadata are ignored`() {
        val sha = "d".repeat(64)
        val releases = parseGitHubReleases(
            """[
              {"tag_name":"mobile-draft","draft":true,"assets":[{"name":"circle-mobile-v9.0.0.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":4,"digest":"sha256:$sha"}]},
              {"tag_name":"mobile-rc","prerelease":true,"assets":[{"name":"circle-mobile-v8.0.0.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":4,"digest":"sha256:$sha"}]},
              {"tag_name":"mobile-huge","assets":[{"name":"circle-mobile-v7.0.0.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":${MAX_RELEASE_APK_BYTES + 1},"digest":"sha256:$sha"}]}
            ]""",
        )

        assertNull(selectNewestCompatibleRelease(releases, LEGACY_PHONE))
    }

    @Test
    fun `malformed versions never become updates`() {
        assertNull(SemanticVersion.parse("newest"))
        assertNull(SemanticVersion.parse("0.2"))
        assertEquals(false, isStrictlyNewerVersion("newest", "0.2.1"))
        assertEquals(false, isStrictlyNewerVersion("0.2.1", "broken"))
    }

    private companion object {
        private const val ORIGIN = "https://sky.v1d.io"
        private val VERSIONED_WEAR = Regex("""^(?:circle-altimeter|skydive-altimeter)-v(\d+\.\d+\.\d+)\.apk$""")
        private val VERSIONED_PHONE = Regex("""^(?:circle-mobile|mobile-release)-v(\d+\.\d+\.\d+)\.apk$""")

        val UNIVERSAL = ReleaseProductContract(
            id = "universal-android",
            packageName = "com.example.universal",
            publicDownloadUrl = "$ORIGIN/downloads/circle-altimeter.apk",
        ) { releaseTag, assetName ->
            when {
                assetName == "app-release.apk" -> releaseTag.removePrefix("v")
                else -> VERSIONED_WEAR.matchEntire(assetName)?.groupValues?.get(1)
            }
        }

        val LEGACY_PHONE = ReleaseProductContract(
            id = "phone",
            packageName = "com.example.phone",
            publicDownloadUrl = "$ORIGIN/downloads/circle-mobile.apk",
        ) { _, assetName -> VERSIONED_PHONE.matchEntire(assetName)?.groupValues?.get(1) }

        const val WATCH_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        const val PHONE_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        val FIXTURE = """[
          {"tag_name":"v0.5.336","assets":[
            {"name":"app-release.apk","url":"https://sky.v1d.io/downloads/circle-altimeter.apk","size":4000000,"digest":"sha256:$WATCH_SHA"},
            {"name":"circle-mobile-v0.2.2.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":5000000,"digest":"sha256:$PHONE_SHA"}
          ]},
          {"tag_name":"v0.5.335","assets":[
            {"name":"circle-mobile-v0.2.1.apk","url":"https://sky.v1d.io/downloads/circle-mobile.apk","size":4900000,"digest":"sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}
          ]}
        ]"""
    }
}
