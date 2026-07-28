package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReleaseSafetyTest {
    @Test
    fun `download URL policy permits only the exact public product route`() {
        assertTrue(
            ReleaseUrlPolicy.isAllowedAssetUrl(
                "https://sky.v1d.io/downloads/skyvw-mobile.apk",
                expectedUrl = "https://sky.v1d.io/downloads/skyvw-mobile.apk",
            ),
        )
        assertFalse(
            ReleaseUrlPolicy.isAllowedAssetUrl(
                "https://sky.v1d.io/downloads/skyvw-altimeter.apk",
                expectedUrl = "https://sky.v1d.io/downloads/skyvw-mobile.apk",
            ),
        )
        assertFalse(
            ReleaseUrlPolicy.isAllowedAssetUrl(
                "https://sky.v1d.io.evil.example/downloads/skyvw-mobile.apk",
                expectedUrl = "https://sky.v1d.io/downloads/skyvw-mobile.apk",
            ),
        )
    }

    @Test
    fun `prefix policy accepts product assets but rejects host and path escapes`() {
        val policy = HttpsPrefixAssetUrlPolicy(
            host = "link.v1d.io",
            pathPrefix = "/releases/agentmux-link/",
        )

        assertTrue(policy.allows("https://link.v1d.io/releases/agentmux-link/phone/app.apk"))
        assertFalse(policy.allows("https://link.v1d.io/releases/other/app.apk"))
        assertFalse(policy.allows("https://link.v1d.io.evil.example/releases/agentmux-link/app.apk"))
        assertFalse(policy.allows("http://link.v1d.io/releases/agentmux-link/app.apk"))
    }

    @Test
    fun `package signer version and package identity must all match`() {
        val installed = ApkIdentity("com.adelost.jump", "0.2.1", 4, setOf("SIGNER"))

        assertEquals(
            ApkCompatibility.Compatible,
            verifyApkCompatibility(
                installed = installed,
                archive = ApkIdentity("com.adelost.jump", "0.2.2", 5, setOf("SIGNER")),
                expectedVersionName = "0.2.2",
            ),
        )
        assertEquals(
            ApkCompatibility.Rejected("package mismatch"),
            verifyApkCompatibility(
                installed,
                ApkIdentity("evil.app", "0.2.2", 5, setOf("SIGNER")),
                "0.2.2",
            ),
        )
        assertEquals(
            ApkCompatibility.Rejected("signer mismatch"),
            verifyApkCompatibility(
                installed,
                ApkIdentity("com.adelost.jump", "0.2.2", 5, setOf("OTHER")),
                "0.2.2",
            ),
        )
        assertEquals(
            ApkCompatibility.Rejected("version is not newer"),
            verifyApkCompatibility(
                installed,
                ApkIdentity("com.adelost.jump", "0.2.2", 4, setOf("SIGNER")),
                "0.2.2",
            ),
        )
        assertEquals(
            ApkCompatibility.Rejected("version metadata mismatch"),
            verifyApkCompatibility(
                installed,
                ApkIdentity("com.adelost.jump", "0.2.3", 5, setOf("SIGNER")),
                "0.2.2",
            ),
        )
    }
}
