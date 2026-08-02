plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

android {
    namespace = "io.v1d.circlekit.showcase.phone"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.v1d.circlekit.showcase.phone"
        minSdk = 26
        targetSdk = 35
        versionCode = rootProject.extra["showcasePhoneVersionCode"] as Int
        versionName = rootProject.version.toString()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    buildTypes {
        release {
            // A stable low-authority lab signer makes the standalone APK
            // installable without granting it any product signing authority.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    implementation(project(":showcase-catalog"))
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.core.ktx)
}
