pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "CircleKit"
include(
    ":bddkit",
    ":designkit",
    ":renderkit",
    ":ringkit",
    ":releasekit",
    ":releasekit-ui",
    ":servicekit",
    ":studio-debug-android",
    ":showcase-catalog",
    ":showcase-phone",
    ":showcase-wear",
)
