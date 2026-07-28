plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    id("maven-publish")
}

android {
    namespace = "com.adelost.releasekit"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    publishing {
        singleVariant("release")
    }
}

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                groupId = "io.v1d.circlekit"
                artifactId = "releasekit"
                version = rootProject.version.toString()
            }
        }
        repositories {
            maven {
                name = "circlekit"
                url = uri(rootProject.layout.buildDirectory.dir("maven").get().asFile)
            }
        }
    }
}

dependencies {
    // ReleaseProductContract.telemetryServiceId is a public ServiceId, so a
    // consumer declaring its own product must be able to name the type.
    api(project(":servicekit"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.org.json)
    testImplementation(libs.junit)
}
