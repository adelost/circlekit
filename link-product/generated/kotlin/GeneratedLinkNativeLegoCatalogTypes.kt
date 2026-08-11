// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM the portable native-Lego domain catalog
// Product declarations SHA-256: d083b2858d52e7a91425fb709af5ace3cfb9a3ae2745b92226778b50c767d501
package io.v1d.link.generated

internal interface GeneratedNativeLegoBindingId { val value: String }
internal interface GeneratedFiniteValueId { val value: String }
internal sealed interface GeneratedProductPortId { val value: String }
internal sealed interface GeneratedProductInputPortId : GeneratedProductPortId
internal sealed interface GeneratedProductOutputPortId : GeneratedProductPortId
internal data class GeneratedFiniteValueDeclaration(
    val id: GeneratedFiniteValueId,
    val values: Set<String>,
)
internal data class GeneratedNativeLegoField(val name: String, val type: String, val unit: String?, val nullable: Boolean, val clockDomain: String)
internal data class GeneratedNativeLegoPort(val id: String, val contract: String)
internal enum class GeneratedProductPortOwnerKind { NODE, COMPONENT }
internal enum class GeneratedProductPortDirection { INPUT, OUTPUT }
internal enum class GeneratedProductPortBoundary { PRESENTATION, UI_EVENT, SERVICE_INTERNAL }
internal enum class GeneratedProductPortPurpose { DATA, DEMAND, CONTEXT }
internal data class GeneratedProductPort(
    val id: GeneratedProductPortId,
    val ownerKind: GeneratedProductPortOwnerKind,
    val ownerId: String,
    val typeRef: String,
    val portId: String,
    val direction: GeneratedProductPortDirection,
    val contractRef: String,
    val boundary: GeneratedProductPortBoundary,
    val required: Boolean,
    val purpose: GeneratedProductPortPurpose,
)
internal enum class GeneratedProductPortBindingKind { NODE_INPUT, COMPONENT_INPUT, COMPONENT_EVENT }
internal data class GeneratedProductPortBinding(
    val kind: GeneratedProductPortBindingKind,
    val from: GeneratedProductOutputPortId,
    val to: GeneratedProductInputPortId,
    val purpose: GeneratedProductPortPurpose,
)
internal data class GeneratedProductDemandEdge(
    val kind: String,
    val nodeInstanceRef: String,
    val targetPortRef: GeneratedProductInputPortId,
    val source: String? = null,
    val rootNodeInstanceRef: String? = null,
    val artifactRef: String? = null,
    val screenRef: String? = null,
    val surface: String? = null,
    val mountRef: String? = null,
    val componentInstanceRef: String? = null,
)
/** What a declaration IS. Three structural categories, so a reader may switch
 *  on them exhaustively instead of comparing spelling. */
internal enum class GeneratedNativeLegoKind { CONTRACT, CONFIG, BLOCK }
internal enum class GeneratedNodeActivationKind { LEASED, LIFETIME }

/** The contract kinds the declarations actually use, so a new one arrives here
 *  by being declared rather than by someone remembering to add it. */
internal enum class GeneratedNativeLegoContractKind { EVENT, OBSERVATION, SNAPSHOT, STATE }

internal data class GeneratedNativeLegoDeclaration(
    val id: String,
    val kind: GeneratedNativeLegoKind,
    val contractKind: GeneratedNativeLegoContractKind? = null,
    val fields: List<GeneratedNativeLegoField> = emptyList(),
    val specId: String? = null,
    val nodeKind: String? = null,
    val inputPorts: List<GeneratedNativeLegoPort> = emptyList(),
    val outputPorts: List<GeneratedNativeLegoPort> = emptyList(),
    val config: Map<String, GeneratedNativeLegoBindingId> = emptyMap(),
    val stateOwner: String? = null,
    val lifetime: String? = null,
    val durability: String? = null,
    val clockDomain: String? = null,
    val contextInputs: Set<String> = emptySet(),
    val effects: Set<String> = emptySet(),
    val activationKind: GeneratedNodeActivationKind? = null,
    val demandPort: String? = null,
    val lifecycleSources: Set<String> = emptySet(),
)
internal data class GeneratedNativeLegoEdge(val from: String, val to: String)

internal data class GeneratedNativeLegoDomain(
    val domainId: String,
    val declarations: List<GeneratedNativeLegoDeclaration>,
    val edges: Set<GeneratedNativeLegoEdge>,
)
