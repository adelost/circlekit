plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    id("maven-publish")
}

android {
    namespace = "com.adelost.designkit"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
    }

    sourceSets {
        // Row 215: the press probe is compiled into BOTH kits' unit tests from one file. ringkit's
        // test source set names this same directory, so the second caller cannot drift from the
        // first. It is not a published source set and never reaches the AAR.
        getByName("test") { java.srcDir("src/testHarness/java") }
    }

    testOptions {
        // A press is a gesture on a real composition, so the JVM cases mount one. Robolectric draws
        // it only with the merged resources.
        unitTests.isIncludeAndroidResources = true
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
                artifactId = "designkit"
                version = rootProject.version.toString()
            }
        }
        repositories {
            maven {
                name = "circlekit"
                url = uri(
                    providers.gradleProperty("circlekitPublishDir").orNull
                        ?: rootProject.layout.buildDirectory.dir("maven").get().asFile,
                )
            }
        }
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.foundation)

    testImplementation(libs.junit)
    // Row 225: whether a control draws the wait it keeps is a fact about a mounted control, not
    // about a function. These run that control on the JVM, for every product at once, so nobody has
    // to spend minutes of emulator to learn whether a button obeys.
    testImplementation(libs.robolectric)
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.androidx.wear.compose.material)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}
