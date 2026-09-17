// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig.stateAuthorities
// Product declaration SHA-256: 3fa61be4e2a0ef9ca86443d60bce5ffb6453f135e5dac1c497d9ae1e32bc3978
package io.v1d.link.generated

internal data class GeneratedStatePresentationBinding<S : Any, P : Any>(
    val inputPort: io.v1d.link.runtime.ProductDataInput<S>,
    val present: (S) -> P,
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

    val authorities: List<GeneratedStatePresentationAuthority> = buildList {
        addAll(GeneratedLinkStatePresentationAuthorities0)
    }

    val finiteValues: List<GeneratedStatePresentationFiniteValue> = buildList {
        addAll(GeneratedLinkStatePresentationFiniteValues0)
    }

    val nativePortIdsByBinding: Map<String, Set<GeneratedProductPortId>> = buildMap {
        putAll(GeneratedLinkStatePresentationNativePorts0)
    }
}
