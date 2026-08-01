plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

group = "io.v1d.circlekit"
version = providers.gradleProperty("circlekitVersion").getOrElse("0.1.0")

val versionParts = version.toString().split('.').map(String::toInt)
require(versionParts.size == 3) { "circlekitVersion must be X.Y.Z" }
extra["showcaseVersionCode"] =
    versionParts[0] * 1_000_000 + versionParts[1] * 1_000 + versionParts[2]
