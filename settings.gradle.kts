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
    ":designkit",
    ":ringkit",
    ":releasekit",
    ":releasekit-ui",
    ":servicekit",
    ":showcase-catalog",
    ":showcase-phone",
    ":showcase-wear",
)
