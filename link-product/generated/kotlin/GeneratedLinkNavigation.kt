// GENERATED FILE. DO NOT EDIT.
// Generator SHA-256: afd8c121f2bb11f40512bf3c24bf2c9ed9a6bdebc98d973f29eb8a43cbe77ae3
package io.v1d.link.generated

enum class GeneratedLinkPageRef(val wireId: String) {
    POSITION("POSITION"),
}

enum class GeneratedLinkPageRestore { ROOT, PROCESS }
enum class GeneratedLinkPageBack { PREVIOUS, CONSUME, SYSTEM }
enum class GeneratedLinkNavigationActionKind { ROUTE, EVENT }

data class GeneratedLinkRouteIntent(val target: GeneratedLinkPageRef)
data class GeneratedLinkPageSemantics(
    val back: GeneratedLinkPageBack,
    val guardContractRef: String?,
)
data class GeneratedLinkNavigationArtifact(
    val entry: GeneratedLinkPageRef,
    val pages: Map<GeneratedLinkPageRef, GeneratedLinkPageRestore>,
)
data class GeneratedLinkNavigationAction(
    val id: String,
    val kind: GeneratedLinkNavigationActionKind,
    val sourcePortRef: String,
    val targetPortRef: String,
    val contractRef: String,
)
data class GeneratedLinkNavigationActionGroup(
    val componentInstanceRef: String,
    val pageRefs: Set<GeneratedLinkPageRef>,
    val artifactRefs: Set<String>,
    val actions: List<GeneratedLinkNavigationAction>,
)

object GeneratedLinkNavigation {
    const val id: String = "link.navigation"
    const val activePagePortRef: String = "navigation.service.activePage"
    const val pageHostPortRef: String = "page.host.activePage"
    val pageSemantics: Map<GeneratedLinkPageRef, GeneratedLinkPageSemantics> = mapOf(
        GeneratedLinkPageRef.POSITION to GeneratedLinkPageSemantics(GeneratedLinkPageBack.SYSTEM, null),
    )
    val artifacts: Map<String, GeneratedLinkNavigationArtifact> = mapOf(
        "link-portable" to GeneratedLinkNavigationArtifact(
            entry = GeneratedLinkPageRef.POSITION,
            pages = mapOf(
            GeneratedLinkPageRef.POSITION to GeneratedLinkPageRestore.ROOT,
            ),
        ),
    )
    val actionGroups: List<GeneratedLinkNavigationActionGroup> = listOf(

    )
}
