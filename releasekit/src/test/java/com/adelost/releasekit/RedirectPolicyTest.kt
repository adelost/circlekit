package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * A redirect is the one place an approved asset URL changes underneath the
 * fence, so every hop is re-approved by the same policy as the initial URL.
 */
class RedirectPolicyTest {
    @Test
    fun `closed union admits github release and its known digest pinned cdn only`() {
        val policy = AnyOfAssetUrlPolicy(
            HttpsPrefixAssetUrlPolicy("github.com", "/adelost/circlekit/releases/download/"),
            HttpsHostAssetUrlPolicy("release-assets.githubusercontent.com"),
        )

        assertTrue(policy.allows("https://github.com/adelost/circlekit/releases/download/v0.3.13/app.apk"))
        assertTrue(policy.allows("https://release-assets.githubusercontent.com/github-production-release-asset/1/app.apk"))
        assertFalse(policy.allows("http://release-assets.githubusercontent.com/app.apk"))
        assertFalse(policy.allows("https://github.com/other/repo/releases/download/v1/app.apk"))
    }
    private val linkPolicy = HttpsPrefixAssetUrlPolicy(
        host = "link.v1d.io",
        pathPrefix = "/downloads/",
    )
    private val circlePolicy = ExactAssetUrlPolicy("https://sky.v1d.io/downloads/circle-altimeter.apk")

    @Test
    fun `a relative redirect resolves against the current url and stays fenced`() {
        assertEquals(
            "https://link.v1d.io/downloads/v2/link.apk",
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = "v2/link.apk",
                policy = linkPolicy,
            ),
        )
    }

    @Test
    fun `a relative redirect that climbs out of the path prefix is refused`() {
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = "../payloads/link.apk",
                policy = linkPolicy,
            ),
        )
    }

    @Test
    fun `a redirect to a hostile host is refused even with the expected path`() {
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = "https://link.v1d.io.evil.example/downloads/link.apk",
                policy = linkPolicy,
            ),
        )
    }

    @Test
    fun `a redirect that downgrades to plain http is refused`() {
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = "http://link.v1d.io/downloads/link.apk",
                policy = linkPolicy,
            ),
        )
    }

    @Test
    fun `an absent or blank location ends the redirect chain`() {
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = null,
                policy = linkPolicy,
            ),
        )
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = "   ",
                policy = linkPolicy,
            ),
        )
    }

    @Test
    fun `Circle's exact pin admits no redirect at all, not even same-host`() {
        // The exact policy is the whole point of Circle's fence: one pinned
        // route, so any hop away from it — however plausible — is refused.
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://sky.v1d.io/downloads/circle-altimeter.apk",
                location = "https://sky.v1d.io/downloads/circle-altimeter-v1.apk",
                policy = circlePolicy,
            ),
        )
    }

    @Test
    fun `a product without a download url refuses every redirect`() {
        assertNull(
            ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = "https://link.v1d.io/downloads/link.apk",
                location = "https://link.v1d.io/downloads/v2/link.apk",
                policy = RejectAssetUrls,
            ),
        )
    }
}
