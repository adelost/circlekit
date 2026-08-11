// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig navigation
// Product declaration SHA-256: 1ec993aecc19bbfd7e6eebdbbcbce7358d9835d3fad4f8ddcaf5c2f69c2c3490
package io.v1d.link.generated

internal object GeneratedLinkNavigationLego {
    const val DOMAIN_ID = "navigation"

    object Contracts {
        const val LINK_NAVIGATION_ACTIVE_PAGE = "link.navigation.active-page"
    }

    object Configs {

    }

    object Blocks {
        const val NAVIGATION_SERVICE = "navigation.service"
    }

    object BindingIds {
        data object LINK_NAVIGATION_ACTIVE_PAGE : GeneratedNativeLegoBindingId { override val value = Contracts.LINK_NAVIGATION_ACTIVE_PAGE }
        data object NAVIGATION_SERVICE : GeneratedNativeLegoBindingId { override val value = Blocks.NAVIGATION_SERVICE }
    }

    val declarations: List<GeneratedNativeLegoDeclaration> = listOf(
        GeneratedNativeLegoDeclaration(id = Contracts.LINK_NAVIGATION_ACTIVE_PAGE, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.STATE, fields = listOf(GeneratedNativeLegoField("page", "ref:link.navigation.page", null, false, "none"))),
        GeneratedNativeLegoDeclaration(id = Blocks.NAVIGATION_SERVICE, kind = GeneratedNativeLegoKind.BLOCK, specId = "link.navigation-service", nodeKind = "service", inputPorts = emptyList(), outputPorts = listOf(GeneratedNativeLegoPort("activePage", Contracts.LINK_NAVIGATION_ACTIVE_PAGE)), config = emptyMap(), stateOwner = "instance", lifetime = "instance", durability = "transient", clockDomain = "none", contextInputs = emptySet(), effects = setOf("ui.navigation"), activationKind = GeneratedNodeActivationKind.LIFETIME, demandPort = null, lifecycleSources = emptySet()),
    )

    val edges: Set<GeneratedNativeLegoEdge> = setOf(

    )
}
