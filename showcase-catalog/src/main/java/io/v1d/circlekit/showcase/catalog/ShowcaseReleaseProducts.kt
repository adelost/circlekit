package io.v1d.circlekit.showcase.catalog

import com.adelost.releasekit.AnyOfAssetUrlPolicy
import com.adelost.releasekit.HttpsHostAssetUrlPolicy
import com.adelost.releasekit.HttpsPrefixAssetUrlPolicy
import com.adelost.releasekit.ReleaseProductContract

enum class ShowcaseReleaseHost(val assetToken: String, val packageName: String) {
    PHONE("phone", "io.v1d.circlekit.showcase.phone"),
    WEAR("wear", "io.v1d.circlekit.showcase.wear"),
}

object ShowcaseReleaseProducts {
    const val FEED_URL = "https://api.github.com/repos/adelost/circlekit/releases"

    fun product(host: ShowcaseReleaseHost): ReleaseProductContract = ReleaseProductContract(
        id = "circlekit-showcase-${host.assetToken}",
        packageName = host.packageName,
        releaseFeedUrl = FEED_URL,
        assetUrlPolicy = AnyOfAssetUrlPolicy(
            HttpsPrefixAssetUrlPolicy("github.com", "/adelost/circlekit/releases/download/"),
            HttpsHostAssetUrlPolicy("release-assets.githubusercontent.com"),
        ),
        versionForAsset = { releaseTag, assetName ->
            val version = releaseTag.removePrefix("v")
            version.takeIf { assetName == "circlekit-showcase-${host.assetToken}-v$version.apk" }
        },
    )
}
