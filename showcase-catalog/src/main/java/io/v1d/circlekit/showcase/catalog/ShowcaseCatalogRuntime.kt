package io.v1d.circlekit.showcase.catalog

/** The native final presentation backed by the generated Product IR catalog. */
object ShowcaseCatalogRuntime {
    fun find(caseId: ShowcaseCaseId): ShowcaseCase? = ShowcaseManifest.find(caseId)

    fun find(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId): Pair<ShowcaseCase, ShowcaseScenario>? =
        ShowcaseManifest.find(caseId, scenarioId)

    fun screensFor(profileId: String): List<String> = ShowcaseManifest.screensFor(profileId)

    fun componentIds(profileId: String, screenId: String): List<String> =
        ShowcaseManifest.componentIds(profileId, screenId)
}
