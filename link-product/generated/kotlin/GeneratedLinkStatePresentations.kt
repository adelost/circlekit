// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig.stateAuthorities
// Product declaration SHA-256: d083b2858d52e7a91425fb709af5ace3cfb9a3ae2745b92226778b50c767d501
package io.v1d.link.generated


internal data class GeneratedLinkPositionAvailabilityPayload(
    val Label: String,
)
internal data class GeneratedStatePresentationFiniteValue(
    val id: String,
    val values: Set<String>,
    val nativeSymbol: kotlin.reflect.KClass<*>,
)

internal data class GeneratedStatePresentationAuthority(
    val id: String,
    val sourcePort: GeneratedProductOutputPortId,
    val stateField: String,
    val inputPort: GeneratedProductInputPortId,
    val outputPort: GeneratedProductOutputPortId,
    val componentInputs: Set<GeneratedProductInputPortId>,
)

internal object GeneratedLinkStatePresentations {
    val LinkPositionAvailability get() = GeneratedLinkStatePresentationLinkPositionAvailability

    val authorities: List<GeneratedStatePresentationAuthority> = listOf(
        LinkPositionAvailability.authority,
    )

    val finiteValues: List<GeneratedStatePresentationFiniteValue> = listOf(

    )

    val nativePortsByBinding: Map<String, List<io.v1d.link.runtime.NativeProductPortRegistration>> = mapOf(
        "LinkPositionAvailability" to listOf(
            LinkPositionAvailability.nativeInputPort,
            LinkPositionAvailability.outputPort,
        ),
    )
}
