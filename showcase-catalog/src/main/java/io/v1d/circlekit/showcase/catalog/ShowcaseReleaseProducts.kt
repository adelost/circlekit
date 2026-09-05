package io.v1d.circlekit.showcase.catalog

import com.adelost.releasekit.AnyOfAssetUrlPolicy
import com.adelost.releasekit.HttpsHostAssetUrlPolicy
import com.adelost.releasekit.HttpsPrefixAssetUrlPolicy
import com.adelost.releasekit.ReleaseProductContract

enum class ShowcaseReleaseHost(val artifact: ShowcaseArtifactProfile, val packageName: String) {
    PHONE(ShowcaseArtifactProfile.PHONE_FULL_UI, "io.v1d.circlekit.showcase.phone"),
    WEAR(ShowcaseArtifactProfile.WEAR_FULL_UI, "io.v1d.circlekit.showcase.wear"),
}

object ShowcaseReleaseProducts {
    const val FEED_URL = "https://api.github.com/repos/${ShowcaseManifest.RELEASE_REPOSITORY}/releases"

    fun product(host: ShowcaseReleaseHost): ReleaseProductContract {
        val assetPrefix = ShowcaseManifest.releaseAssetPrefixes.getValue(host.artifact)
        return ReleaseProductContract(
        id = assetPrefix,
        packageName = host.packageName,
        releaseFeedUrl = FEED_URL,
        assetUrlPolicy = AnyOfAssetUrlPolicy(
            HttpsPrefixAssetUrlPolicy("github.com", "/${ShowcaseManifest.RELEASE_REPOSITORY}/releases/download/"),
            HttpsHostAssetUrlPolicy("release-assets.githubusercontent.com"),
        ),
        versionForAsset = { releaseTag, assetName ->
            val version = releaseTag.removePrefix("v")
            version.takeIf { assetName == "$assetPrefix-v$version.apk" }
        },
    )
    }
}
