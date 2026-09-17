// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig.stateAuthorities
// Product declaration SHA-256: 3fa61be4e2a0ef9ca86443d60bce5ffb6453f135e5dac1c497d9ae1e32bc3978
package io.v1d.link.generated

internal object GeneratedLinkStatePresentationLinkPositionAvailability {
    fun <S : Any> bind(
        state: (S) -> GeneratedLinkPositionAvailability,
    ): GeneratedStatePresentationBinding<S, GeneratedLinkPositionAvailabilityPayload> = GeneratedStatePresentationBinding(
        inputPort = object : io.v1d.link.runtime.ProductDataInput<S>(
            GeneratedLinkNativeLegoCatalog.PortIds.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER_STATE,
        ) {},
        present = { source -> require(state(source)) },
    )
    val outputPort: io.v1d.link.runtime.ProductOutputPort<GeneratedLinkPositionAvailabilityPayload> =
        object : io.v1d.link.runtime.ProductOutputPort<GeneratedLinkPositionAvailabilityPayload>(
            GeneratedLinkNativeLegoCatalog.PortIds.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER_PRESENTATION,
        ) {}
    val componentInputs: Map<GeneratedProductInputPortId, io.v1d.link.runtime.ProductComponentInput<GeneratedLinkPositionAvailabilityPayload>> = mapOf(
        GeneratedLinkNativeLegoCatalog.PortIds.POSITION_PAGE_AVAILABILITY to
            object : io.v1d.link.runtime.ProductComponentInput<GeneratedLinkPositionAvailabilityPayload>(
                GeneratedLinkNativeLegoCatalog.PortIds.POSITION_PAGE_AVAILABILITY,
            ) {},
    )
    val authority = GeneratedStatePresentationAuthority(
        id = "link.position-availability",
        sourcePort = GeneratedLinkNativeLegoCatalog.PortIds.POSITION_SERVICE_PRESENTATION,
        stateField = "availability",
        inputPort = GeneratedLinkNativeLegoCatalog.PortIds.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER_STATE,
        outputPort = GeneratedLinkNativeLegoCatalog.PortIds.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER_PRESENTATION,
        componentInputs = setOf(
            GeneratedLinkNativeLegoCatalog.PortIds.POSITION_PAGE_AVAILABILITY,
        ),
    )
    private val statesById: Map<String, GeneratedLinkPositionAvailability> = mapOf(
        "off" to GeneratedLinkPositionAvailability.OFF,
        "precise-required" to GeneratedLinkPositionAvailability.PRECISE_REQUIRED,
        "subscribing" to GeneratedLinkPositionAvailability.SUBSCRIBING,
        "live" to GeneratedLinkPositionAvailability.LIVE,
        "coarse" to GeneratedLinkPositionAvailability.COARSE,
        "stale" to GeneratedLinkPositionAvailability.STALE,
        "failed" to GeneratedLinkPositionAvailability.FAILED,
    )
    private val cases: Map<GeneratedLinkPositionAvailability, GeneratedLinkPositionAvailabilityPayload> = mapOf(
        GeneratedLinkPositionAvailability.OFF to GeneratedLinkPositionAvailabilityPayload(Label = "GPS OFF"),
        GeneratedLinkPositionAvailability.PRECISE_REQUIRED to GeneratedLinkPositionAvailabilityPayload(Label = "PRECISE REQUIRED"),
        GeneratedLinkPositionAvailability.SUBSCRIBING to GeneratedLinkPositionAvailabilityPayload(Label = "SEARCHING"),
        GeneratedLinkPositionAvailability.LIVE to GeneratedLinkPositionAvailabilityPayload(Label = "GPS LIVE"),
        GeneratedLinkPositionAvailability.COARSE to GeneratedLinkPositionAvailabilityPayload(Label = "GPS COARSE"),
        GeneratedLinkPositionAvailability.STALE to GeneratedLinkPositionAvailabilityPayload(Label = "LAST SEEN"),
        GeneratedLinkPositionAvailability.FAILED to GeneratedLinkPositionAvailabilityPayload(Label = "GPS ERROR"),
    )
    val stateIds: Set<String> get() = statesById.keys

    fun state(stateId: String): GeneratedLinkPositionAvailability = requireNotNull(statesById[stateId]) {
        "Unknown link.position-availability state '$stateId'"
    }

    fun require(state: GeneratedLinkPositionAvailability): GeneratedLinkPositionAvailabilityPayload = requireNotNull(cases[state]) {
        "Missing link.position-availability presentation for '$state'"
    }

    fun require(stateId: String): GeneratedLinkPositionAvailabilityPayload = require(state(stateId))
}
