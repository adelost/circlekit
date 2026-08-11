// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig position
// Product declaration SHA-256: 8e9bebdbd90a38b019b7c0322c1385235da4215a4dbf794913bb7ae9e0d330b1
package io.v1d.link.generated

internal object GeneratedLinkPositionLego {
    const val DOMAIN_ID = "position"

    object Contracts {
        const val SERVICE_DEMAND = "service.demand"
        const val POSITION_PRESENTATION = "position.presentation"
        const val POSITION_FLIGHT_FIX = "position.flight-fix"
        const val LINK_POSITION_FIX_PRESENTATION = "link.position-fix-presentation"
    }

    object Configs {
        const val LINK_POSITION_ACQUISITION = "link.position-acquisition"
        const val LINK_POSITION_PRESENTATION_POLICY = "link.position-presentation-policy"
        const val LINK_POSITION_FLIGHT_POLICY = "link.position-flight-policy"
    }

    object Blocks {
        const val POSITION_SERVICE = "position.service"
        const val POSITION_FIX_PRESENTATION = "position.fix-presentation"
    }

    object BindingIds {
        data object SERVICE_DEMAND : GeneratedNativeLegoBindingId { override val value = Contracts.SERVICE_DEMAND }
        data object POSITION_PRESENTATION : GeneratedNativeLegoBindingId { override val value = Contracts.POSITION_PRESENTATION }
        data object POSITION_FLIGHT_FIX : GeneratedNativeLegoBindingId { override val value = Contracts.POSITION_FLIGHT_FIX }
        data object LINK_POSITION_FIX_PRESENTATION : GeneratedNativeLegoBindingId { override val value = Contracts.LINK_POSITION_FIX_PRESENTATION }
        data object LINK_POSITION_ACQUISITION : GeneratedNativeLegoBindingId { override val value = Configs.LINK_POSITION_ACQUISITION }
        data object LINK_POSITION_PRESENTATION_POLICY : GeneratedNativeLegoBindingId { override val value = Configs.LINK_POSITION_PRESENTATION_POLICY }
        data object LINK_POSITION_FLIGHT_POLICY : GeneratedNativeLegoBindingId { override val value = Configs.LINK_POSITION_FLIGHT_POLICY }
        data object POSITION_SERVICE : GeneratedNativeLegoBindingId { override val value = Blocks.POSITION_SERVICE }
        data object POSITION_FIX_PRESENTATION : GeneratedNativeLegoBindingId { override val value = Blocks.POSITION_FIX_PRESENTATION }
    }

    val declarations: List<GeneratedNativeLegoDeclaration> = listOf(
        GeneratedNativeLegoDeclaration(id = Contracts.SERVICE_DEMAND, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.EVENT, fields = listOf(GeneratedNativeLegoField("owner", "string", null, false, "none"), GeneratedNativeLegoField("active", "boolean", null, false, "none"))),
        GeneratedNativeLegoDeclaration(id = Contracts.POSITION_PRESENTATION, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.STATE, fields = listOf(GeneratedNativeLegoField("availability", "ref:position.availability", null, false, "none"), GeneratedNativeLegoField("observation", "ref:position.observation", null, true, "none"))),
        GeneratedNativeLegoDeclaration(id = Contracts.POSITION_FLIGHT_FIX, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.OBSERVATION, fields = listOf(GeneratedNativeLegoField("observation", "ref:position.observation", null, false, "none"), GeneratedNativeLegoField("breakBefore", "boolean", null, false, "none"), GeneratedNativeLegoField("gpsStatus", "string", null, false, "none"))),
        GeneratedNativeLegoDeclaration(id = Contracts.LINK_POSITION_FIX_PRESENTATION, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.SNAPSHOT, fields = listOf(GeneratedNativeLegoField("observation", "ref:position.observation", null, false, "none"), GeneratedNativeLegoField("breakBefore", "boolean", null, false, "none"), GeneratedNativeLegoField("gpsStatus", "string", null, false, "none"))),
        GeneratedNativeLegoDeclaration(id = Configs.LINK_POSITION_ACQUISITION, kind = GeneratedNativeLegoKind.CONFIG),
        GeneratedNativeLegoDeclaration(id = Configs.LINK_POSITION_PRESENTATION_POLICY, kind = GeneratedNativeLegoKind.CONFIG),
        GeneratedNativeLegoDeclaration(id = Configs.LINK_POSITION_FLIGHT_POLICY, kind = GeneratedNativeLegoKind.CONFIG),
        GeneratedNativeLegoDeclaration(id = Blocks.POSITION_SERVICE, kind = GeneratedNativeLegoKind.BLOCK, specId = "position.service", nodeKind = "service", inputPorts = listOf(GeneratedNativeLegoPort("demand", Contracts.SERVICE_DEMAND)), outputPorts = listOf(GeneratedNativeLegoPort("presentation", Contracts.POSITION_PRESENTATION), GeneratedNativeLegoPort("flightFix", Contracts.POSITION_FLIGHT_FIX)), config = mapOf("acquisition" to BindingIds.LINK_POSITION_ACQUISITION, "presentationPolicy" to BindingIds.LINK_POSITION_PRESENTATION_POLICY, "flightPolicy" to BindingIds.LINK_POSITION_FLIGHT_POLICY), stateOwner = "instance", lifetime = "process", durability = "transient", clockDomain = "monotonic", contextInputs = setOf("device.location", "permission.location", "clock.monotonic", "recording.policy"), effects = setOf("location.subscription"), activationKind = GeneratedNodeActivationKind.LEASED, demandPort = "demand", lifecycleSources = emptySet()),
        GeneratedNativeLegoDeclaration(id = Blocks.POSITION_FIX_PRESENTATION, kind = GeneratedNativeLegoKind.BLOCK, specId = "link.position-fix-presentation", nodeKind = "present", inputPorts = listOf(GeneratedNativeLegoPort("fix", Contracts.POSITION_FLIGHT_FIX)), outputPorts = listOf(GeneratedNativeLegoPort("model", Contracts.LINK_POSITION_FIX_PRESENTATION)), config = emptyMap(), stateOwner = "none", lifetime = "call", durability = "transient", clockDomain = "none", contextInputs = emptySet(), effects = emptySet(), activationKind = null, demandPort = null, lifecycleSources = emptySet()),
    )

    val edges: Set<GeneratedNativeLegoEdge> = setOf(
        GeneratedNativeLegoEdge("position.service.flightFix", "position.fix-presentation.fix"),
    )
}
