// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig link
// Product declaration SHA-256: 7e3b52212cacaf5c93732e096de970201fb7e446fb33e41686a542ddb677d188
package io.v1d.link.generated

internal object GeneratedLinkLinkLego {
    const val DOMAIN_ID = "link"

    object Contracts {
        const val POSITION_PRESENTATION = "position.presentation"
        const val LINK_POSITION_AVAILABILITY_PAYLOAD = "link.position-availability.payload"
    }

    object Configs {

    }

    object Blocks {
        const val LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER = "link.position-availability.presentation-adapter"
    }

    object BindingIds {
        data object POSITION_PRESENTATION : GeneratedNativeLegoBindingId { override val value = Contracts.POSITION_PRESENTATION }
        data object LINK_POSITION_AVAILABILITY_PAYLOAD : GeneratedNativeLegoBindingId { override val value = Contracts.LINK_POSITION_AVAILABILITY_PAYLOAD }
        data object LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER : GeneratedNativeLegoBindingId { override val value = Blocks.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER }
    }

    val declarations: List<GeneratedNativeLegoDeclaration> = listOf(
        GeneratedNativeLegoDeclaration(id = Contracts.POSITION_PRESENTATION, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.STATE, fields = listOf(GeneratedNativeLegoField("availability", "ref:position.availability", null, false, "none"), GeneratedNativeLegoField("observation", "ref:position.observation", null, true, "none"), GeneratedNativeLegoField("isMock", "boolean", null, true, "none"))),
        GeneratedNativeLegoDeclaration(id = Contracts.LINK_POSITION_AVAILABILITY_PAYLOAD, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.SNAPSHOT, fields = listOf(GeneratedNativeLegoField("label", "string", null, false, "none"))),
        GeneratedNativeLegoDeclaration(id = Blocks.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER, kind = GeneratedNativeLegoKind.BLOCK, specId = "link.position-availability.presentation-adapter", nodeKind = "present", inputPorts = listOf(GeneratedNativeLegoPort("state", Contracts.POSITION_PRESENTATION)), outputPorts = listOf(GeneratedNativeLegoPort("presentation", Contracts.LINK_POSITION_AVAILABILITY_PAYLOAD)), config = emptyMap(), stateOwner = "none", lifetime = "call", durability = "transient", clockDomain = "none", contextInputs = emptySet(), effects = emptySet(), activationKind = null, demandPort = null, lifecycleSources = emptySet()),
    )

    val edges: Set<GeneratedNativeLegoEdge> = setOf(

    )
}
