// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig.stateAuthorities
// Product declaration SHA-256: d083b2858d52e7a91425fb709af5ace3cfb9a3ae2745b92226778b50c767d501
package io.v1d.link.generated

internal object GeneratedLinkStatePresentationLinkPositionAvailability {
    val nativeInputPort: io.v1d.link.runtime.ProductDataInput<Any> =
        object : io.v1d.link.runtime.ProductDataInput<Any>(
            GeneratedLinkNativeLegoCatalog.PortIds.LINK_POSITION_AVAILABILITY_PRESENTATION_ADAPTER_STATE,
        ) {}
    @Suppress("UNCHECKED_CAST")
    fun <T : Any> inputPort(): io.v1d.link.runtime.ProductDataInput<T> =
        nativeInputPort as io.v1d.link.runtime.ProductDataInput<T>
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
    private val cases: Map<String, GeneratedLinkPositionAvailabilityPayload> = mapOf(
        "off" to GeneratedLinkPositionAvailabilityPayload(Label = "GPS OFF"),
        "precise-required" to GeneratedLinkPositionAvailabilityPayload(Label = "PRECISE REQUIRED"),
        "subscribing" to GeneratedLinkPositionAvailabilityPayload(Label = "SEARCHING"),
        "live" to GeneratedLinkPositionAvailabilityPayload(Label = "GPS LIVE"),
        "coarse" to GeneratedLinkPositionAvailabilityPayload(Label = "GPS COARSE"),
        "stale" to GeneratedLinkPositionAvailabilityPayload(Label = "LAST SEEN"),
        "failed" to GeneratedLinkPositionAvailabilityPayload(Label = "GPS ERROR"),
    )
    val stateIds: Set<String> get() = cases.keys

    fun require(stateId: String): GeneratedLinkPositionAvailabilityPayload = requireNotNull(cases[stateId]) {
        "Unknown link.position-availability state '$stateId'"
    }
}
