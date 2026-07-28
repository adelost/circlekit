plugins {
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
}

group = "io.v1d.circlekit"
version = providers.gradleProperty("circlekitVersion").getOrElse("0.1.0")
