package com.adelost.releasekit

import com.adelost.servicekit.ServiceId
import org.json.JSONArray
import org.json.JSONObject

/** Strict dotted version used by release selection. Unknown formats fail closed. */
data class SemanticVersion(
    val major: Int,
    val minor: Int,
    val patch: Int,
) : Comparable<SemanticVersion> {
    override fun compareTo(other: SemanticVersion): Int =
        compareValuesBy(this, other, SemanticVersion::major, SemanticVersion::minor, SemanticVersion::patch)

    override fun toString(): String = "$major.$minor.$patch"

    companion object {
        private val PATTERN = Regex("""^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$""")

        fun parse(value: String?): SemanticVersion? {
            val match = value?.let(PATTERN::matchEntire) ?: return null
            return runCatching {
                SemanticVersion(
                    major = match.groupValues[1].toInt(),
                    minor = match.groupValues[2].toInt(),
                    patch = match.groupValues[3].toInt(),
                )
            }.getOrNull()
        }
    }
}

fun isStrictlyNewerVersion(remote: String, local: String): Boolean {
    val remoteVersion = SemanticVersion.parse(remote) ?: return false
    val localVersion = SemanticVersion.parse(local) ?: return false
    return remoteVersion > localVersion
}

/** One app identity and its unambiguous APK naming contract. */
class ReleaseProductContract(
    val id: String,
    val packageName: String,
    val releaseFeedUrl: String? = null,
    val publicDownloadUrl: String? = null,
    val userAgent: String = "circlekit-release/$id",
    val cacheFileName: String = "circlekit-$id-update.apk",
    val telemetryServiceId: ServiceId = ServiceId("$id.updates"),
    val assetUrlPolicy: AssetUrlPolicy = publicDownloadUrl
        ?.let(::ExactAssetUrlPolicy)
        ?: RejectAssetUrls,
    private val candidateIsNewer: (
        candidate: ReleaseCandidate,
        currentVersionName: String,
        currentVersionCode: Int,
    ) -> Boolean = { candidate, currentName, _ ->
        isStrictlyNewerVersion(candidate.versionName, currentName)
    },
    private val versionForAsset: (releaseTag: String, assetName: String) -> String?,
) {
    internal fun versionFor(releaseTag: String, assetName: String): String? =
        versionForAsset(releaseTag, assetName)?.takeIf { SemanticVersion.parse(it) != null }

    /**
     * Public because a product declares this rule and should be able to prove
     * what it declared. A consumer that can only test its own copy of the
     * predicate has tested nothing.
     */
    fun isNewer(
        candidate: ReleaseCandidate,
        currentVersionName: String,
        currentVersionCode: Int,
    ): Boolean = candidateIsNewer(candidate, currentVersionName, currentVersionCode)
}

// Product identities live with their product. A catalog here would name a
// consumer's package inside the shared library, which is the end of reuse and
// the exact thing ReleaseProductContract exists to inject.

data class GitHubReleaseAsset(
    val name: String,
    val apiUrl: String,
    val sizeBytes: Long,
    val digest: String?,
)

data class GitHubRelease(
    val tagName: String,
    val assets: List<GitHubReleaseAsset>,
)

const val MAX_RELEASE_APK_BYTES: Long = 150L * 1024L * 1024L

data class ReleaseCandidate(
    val versionName: String,
    val assetName: String,
    val downloadUrl: String,
    val sizeBytes: Long,
    val sha256: String,
    val versionCode: Int? = null,
    val validUntilEpochMs: Long? = null,
    val changelog: String = "",
)

/**
 * Whether signed metadata has run out at [nowEpochMs].
 *
 * The instant named by `validUntilEpochMs` counts as already expired: a
 * deadline that still admits its own boundary leaves one tick during which a
 * revoked release installs. A source that publishes no deadline (Circle's
 * GitHub feed) never expires — absence of a claim is not a stale claim.
 */
fun ReleaseCandidate.isExpiredAt(nowEpochMs: Long): Boolean =
    validUntilEpochMs?.let { it <= nowEpochMs } == true

/** Parse is deliberately total: malformed remote metadata becomes an empty, non-blocking catalog. */
fun parseGitHubReleases(body: String): List<GitHubRelease> = runCatching {
    val array = JSONArray(body)
    buildList {
        for (releaseIndex in 0 until array.length()) {
            val release = array.optJSONObject(releaseIndex) ?: continue
            if (release.optBoolean("draft", false) || release.optBoolean("prerelease", false)) continue
            val tagName = release.optString("tag_name").takeIf(String::isNotBlank) ?: continue
            val assetsJson = release.optJSONArray("assets") ?: JSONArray()
            val assets = buildList {
                for (assetIndex in 0 until assetsJson.length()) {
                    val asset = assetsJson.optJSONObject(assetIndex) ?: continue
                    val name = asset.optString("name").takeIf(String::isNotBlank) ?: continue
                    val apiUrl = asset.optString("url").takeIf(String::isNotBlank)
                        ?: asset.optString("browser_download_url").takeIf(String::isNotBlank)
                        ?: continue
                    add(
                        GitHubReleaseAsset(
                            name = name,
                            apiUrl = apiUrl,
                            sizeBytes = asset.optLong("size", 0L),
                            digest = asset.optString("digest").takeIf(String::isNotBlank),
                        ),
                    )
                }
            }
            add(GitHubRelease(tagName, assets))
        }
    }
}.getOrDefault(emptyList())

fun selectNewestCompatibleRelease(
    releases: List<GitHubRelease>,
    product: ReleaseProductContract,
): ReleaseCandidate? = releases
    .flatMap { release ->
        release.assets.mapNotNull { asset -> releaseCandidate(release, asset, product) }
    }
    .maxByOrNull { requireNotNull(SemanticVersion.parse(it.versionName)) }

private fun releaseCandidate(
    release: GitHubRelease,
    asset: GitHubReleaseAsset,
    product: ReleaseProductContract,
): ReleaseCandidate? {
    val versionName = product.versionFor(release.tagName, asset.name) ?: return null
    val sha256 = normalizedSha256(asset.digest) ?: return null
    if (asset.sizeBytes !in 1..MAX_RELEASE_APK_BYTES) return null
    if (!product.assetUrlPolicy.allows(asset.apiUrl)) return null
    return ReleaseCandidate(versionName, asset.name, asset.apiUrl, asset.sizeBytes, sha256)
}

fun normalizedSha256(digest: String?): String? {
    val value = digest?.removePrefix("sha256:")?.lowercase() ?: return null
    return value.takeIf { it.matches(Regex("""^[0-9a-f]{64}$""")) }
}
