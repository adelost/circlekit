package com.adelost.releasekit

import java.net.URI

fun interface AssetUrlPolicy {
    fun allows(url: String): Boolean
}

/** Closed union for a source whose public asset performs one known CDN hop. */
class AnyOfAssetUrlPolicy(
    private vararg val policies: AssetUrlPolicy,
) : AssetUrlPolicy {
    init {
        require(policies.isNotEmpty())
    }

    override fun allows(url: String): Boolean = policies.any { it.allows(url) }
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

/** HTTPS host fence used only for digest-pinned release CDNs with opaque paths. */
class HttpsHostAssetUrlPolicy(
    private vararg val hosts: String,
) : AssetUrlPolicy {
    private val expected = hosts.map(String::lowercase).toSet()

    init {
        require(expected.isNotEmpty() && expected.none(String::isBlank))
    }

    override fun allows(url: String): Boolean {
        val uri = ReleaseUrlPolicy.safeHttpsUri(url) ?: return false
        return uri.host.lowercase() in expected && uri.rawFragment == null
    }
}

object RejectAssetUrls : AssetUrlPolicy {
    override fun allows(url: String): Boolean = false
}

object ReleaseUrlPolicy {
    fun isAllowedAssetUrl(url: String, expectedUrl: String): Boolean {
        return ExactAssetUrlPolicy(expectedUrl).allows(url)
    }

    /**
     * Where a `Location` header actually points, or null when the fence
     * refuses it.
     *
     * A redirect is the one place an asset URL changes after the policy has
     * already approved it, and `Location` may be relative — so resolution and
     * re-approval have to happen together. Keeping them in one pure function
     * means the hop is decided by the same policy as the initial URL, and can
     * be proven without opening a socket.
     */
    fun resolvedRedirectTarget(
        currentUrl: String,
        location: String?,
        policy: AssetUrlPolicy,
    ): String? {
        if (location.isNullOrBlank()) return null
        val resolved = runCatching { URI(currentUrl).resolve(location).toString() }.getOrNull()
            ?: return null
        return resolved.takeIf(policy::allows)
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
