package com.adelost.releasekit

import java.net.URI

fun interface AssetUrlPolicy {
    fun allows(url: String): Boolean
}

class ExactAssetUrlPolicy(expectedUrl: String) : AssetUrlPolicy {
    private val expected = ReleaseUrlPolicy.safeHttpsUri(expectedUrl)

    override fun allows(url: String): Boolean =
        expected != null && ReleaseUrlPolicy.safeHttpsUri(url) == expected
}

class HttpsPrefixAssetUrlPolicy(
    host: String,
    pathPrefix: String,
) : AssetUrlPolicy {
    private val expectedHost = host.lowercase()
    private val expectedPrefix = pathPrefix.takeIf { it.startsWith("/") && it.endsWith("/") }

    override fun allows(url: String): Boolean {
        val uri = ReleaseUrlPolicy.safeHttpsUri(url) ?: return false
        return expectedPrefix != null &&
            uri.host.lowercase() == expectedHost &&
            uri.rawPath.startsWith(expectedPrefix) &&
            uri.rawFragment == null
    }
}

object RejectAssetUrls : AssetUrlPolicy {
    override fun allows(url: String): Boolean = false
}

object ReleaseUrlPolicy {
    fun isAllowedAssetUrl(url: String, expectedUrl: String): Boolean {
        return ExactAssetUrlPolicy(expectedUrl).allows(url)
    }

    internal fun safeHttpsUri(url: String): URI? = runCatching { URI(url) }.getOrNull()?.takeIf {
        it.scheme.equals("https", ignoreCase = true) &&
            !it.host.isNullOrBlank() &&
            it.userInfo == null &&
            (it.port == -1 || it.port == 443)
    }
}

data class ApkIdentity(
    val packageName: String,
    val versionName: String,
    val versionCode: Long,
    val signerSha256: Set<String>,
)

sealed interface ApkCompatibility {
    data object Compatible : ApkCompatibility
    data class Rejected(val reason: String) : ApkCompatibility
}

fun verifyApkCompatibility(
    installed: ApkIdentity,
    archive: ApkIdentity,
    expectedVersionName: String,
): ApkCompatibility = when {
    archive.packageName != installed.packageName -> ApkCompatibility.Rejected("package mismatch")
    archive.versionName != expectedVersionName -> ApkCompatibility.Rejected("version metadata mismatch")
    archive.versionCode <= installed.versionCode -> ApkCompatibility.Rejected("version is not newer")
    installed.signerSha256.isEmpty() || archive.signerSha256.isEmpty() ||
        installed.signerSha256 != archive.signerSha256 -> ApkCompatibility.Rejected("signer mismatch")
    else -> ApkCompatibility.Compatible
}
