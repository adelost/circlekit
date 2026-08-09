package io.v1d.circlekit.showcase.catalog

/** Inspector data and native dispatch both read this exact generated Product IR registry. */
object ShowcaseProductInspectorRegistry {
    val nodes: List<ShowcaseNodeDescriptor> get() = ShowcaseManifest.nodes
    val ports: List<ShowcaseProductPort> get() = ShowcaseManifest.ports
    val bindings: List<ShowcasePortBinding> get() = ShowcaseManifest.bindings
    val demandEdges: List<ShowcaseDemandEdge> get() = ShowcaseManifest.demandEdges

    fun requireOpenTarget(caseId: ShowcaseCaseId): String {
        val source = "${caseId.value}.open"
        val target = requireNotNull(bindings.singleOrNull {
            it.kind == "component-event" && it.from == source
        }) { "No Product IR open binding for ${caseId.value}" }.to
        val owner = target.substringBeforeLast('.')
        val port = target.substringAfterLast('.')
        val native = requireNotNull(ShowcaseNativeBindings.nodes.singleOrNull { it.nodeId == owner }) {
            "No native Showcase node for $owner"
        }
        require(port in native.inputPorts) { "Native node $owner does not bind Product IR port $port" }
        return target
    }
}
