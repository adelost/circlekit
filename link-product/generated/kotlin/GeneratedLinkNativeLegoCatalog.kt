// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM the portable native-Lego domain catalog
// Product declarations SHA-256: d083b2858d52e7a91425fb709af5ace3cfb9a3ae2745b92226778b50c767d501
package io.v1d.link.generated
internal object GeneratedLinkNativeLegoCatalog {
    val PortIds = GeneratedLinkNativeLegoPortIds

    object FiniteValueIds {
        data object LINK_NAVIGATION_PAGE : GeneratedFiniteValueId { override val value = "link.navigation.page" }
    }

    val finiteValues: List<GeneratedFiniteValueDeclaration> = listOf(
        GeneratedFiniteValueDeclaration(FiniteValueIds.LINK_NAVIGATION_PAGE, setOf("POSITION")),
    )

    val domains: List<GeneratedNativeLegoDomain> = listOf(
        GeneratedNativeLegoDomain(GeneratedLinkPositionLego.DOMAIN_ID, GeneratedLinkPositionLego.declarations, GeneratedLinkPositionLego.edges),
        GeneratedNativeLegoDomain(GeneratedLinkLinkLego.DOMAIN_ID, GeneratedLinkLinkLego.declarations, GeneratedLinkLinkLego.edges),
        GeneratedNativeLegoDomain(GeneratedLinkNavigationLego.DOMAIN_ID, GeneratedLinkNavigationLego.declarations, GeneratedLinkNavigationLego.edges),
    )

    val ports: List<GeneratedProductPort> = GeneratedLinkNativeLegoPortData.ports

    val portBindings: List<GeneratedProductPortBinding> = GeneratedLinkNativeLegoPortBindings.bindings

    val demandEdges: List<GeneratedProductDemandEdge> = listOf(
        GeneratedLinkNativeLegoDemandEdges0.entries,
    ).flatten()

    val allEdges: Set<GeneratedNativeLegoEdge> = portBindings.mapTo(linkedSetOf()) {
        GeneratedNativeLegoEdge(it.from.value, it.to.value)
    }
}
