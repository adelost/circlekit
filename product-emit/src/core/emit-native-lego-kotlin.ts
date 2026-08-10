import type {
  LegoConfigRef,
  LegoContract,
  LegoField,
  LegoFiniteValueDeclaration,
  LegoPort,
  PortBindingIr,
  PortRegistryEntry,
  ProductDemandEdge,
  ProductPortRegistry,
  ProductNodeInstance,
} from "@v1d/product-spec";
import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { KotlinEmissionOptions } from "./emission-options.js";
import type { NativeLegoDomainProjectionEntry } from "./validate-native-legos.js";

/** One domain's generated object, named so the catalog can find it again. */
function legoObjectName(symbolPrefix: string, domainId: string): string {
  return `Generated${symbolPrefix}${kotlinIdentifier(domainId)}Lego`;
}

/** Emit portable declarations and edges. Native implementations stay native. */
export function emitNativeLegoKotlin(
  domain: NativeLegoDomainProjectionEntry,
  options: KotlinEmissionOptions,
): string {
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ProductConfig ${domain.id}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

internal object ${legoObjectName(options.symbolPrefix, domain.id)} {
    const val DOMAIN_ID = ${kotlinStringLiteral(domain.id)}

    object Contracts {
${domain.contracts.map(({ id }) => constant(id)).join("\n")}
    }

    object Configs {
${domain.configs.map(({ id }) => constant(id)).join("\n")}
    }

    object Blocks {
${domain.nodes.map(({ id }) => constant(id)).join("\n")}
    }

    object BindingIds {
${bindingEntries(domain)
    .map(({ id, kind }) => `        data object ${bindingToken(id, kind, domain)} : GeneratedNativeLegoBindingId { override val value = ${reference(id, kind)} }`)
    .join("\n")}
    }

    val declarations: List<GeneratedNativeLegoDeclaration> = listOf(
${[
    ...domain.contracts.map(emitContract),
    ...domain.configs.map(emitConfig),
    ...domain.nodes.map((node) => emitNode(node, domain)),
  ].join("\n")}
    )

    val edges: Set<GeneratedNativeLegoEdge> = setOf(
${domain.bindings.map(emitConnection).join("\n")}
    )
}
`;
}

/** One generated catalog lets a single native integration test cover every domain. */
export function emitNativeLegoCatalogKotlin(
  domains: readonly NativeLegoDomainProjectionEntry[],
  registry: ProductPortRegistry,
  finiteValues: readonly LegoFiniteValueDeclaration[],
  options: KotlinEmissionOptions,
): string {
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM the portable native-Lego domain catalog
// Product declarations SHA-256: ${options.sourceSha}
package ${options.packageName}

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
internal enum class GeneratedNativeLegoContractKind { ${contractKinds(domains)} }

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

internal object Generated${options.symbolPrefix}NativeLegoCatalog {
    object PortIds {
${[...registry.nodePorts, ...registry.componentPorts].map(emitPortId).join("\n")}
    }

    object FiniteValueIds {
${finiteValues.map(({ id }) => `        data object ${kotlinEnumToken(id)} : GeneratedFiniteValueId { override val value = ${kotlinStringLiteral(id)} }`).join("\n")}
    }

    val finiteValues: List<GeneratedFiniteValueDeclaration> = listOf(
${finiteValues.map(({ id, values }) => `        GeneratedFiniteValueDeclaration(FiniteValueIds.${kotlinEnumToken(id)}, ${stringSet(values)}),`).join("\n")}
    )

    val domains: List<GeneratedNativeLegoDomain> = listOf(
${domains.map((domain) => {
    const object = legoObjectName(options.symbolPrefix, domain.id);
    return `        GeneratedNativeLegoDomain(${object}.DOMAIN_ID, ${object}.declarations, ${object}.edges),`;
  }).join("\n")}
    )

    val ports: List<GeneratedProductPort> = listOf(
${[...registry.nodePorts, ...registry.componentPorts].map(emitProductPort).join("\n")}
    )

    val portBindings: List<GeneratedProductPortBinding> = listOf(
${registry.bindings.map(emitPortBinding).join("\n")}
    )

    val demandEdges: List<GeneratedProductDemandEdge> = listOf(
${registry.demandEdges.map(emitDemandEdge).join("\n")}
    )

    val allEdges: Set<GeneratedNativeLegoEdge> = setOf(
${registry.bindings.map(emitConnection).join("\n")}
    )
}

`;
}

/**
 * Split the generated registry at its declared data seams. A real product can
 * have thousands of transitive demand edges; putting those constructors in a
 * single Kotlin object creates one JVM <clinit> and eventually exceeds the
 * 64 KiB method limit. The public catalog remains one API while its immutable
 * data is initialized in bounded generated shards.
 */
export function emitNativeLegoCatalogKotlinFiles(
  domains: readonly NativeLegoDomainProjectionEntry[],
  registry: ProductPortRegistry,
  finiteValues: readonly LegoFiniteValueDeclaration[],
  options: KotlinEmissionOptions,
): Readonly<{ aggregate: string; shards: readonly Readonly<{ suffix: string; content: string }>[] }> {
  const fullCatalog = emitNativeLegoCatalogKotlin(domains, registry, finiteValues, options);
  const catalogMarker = `internal object Generated${options.symbolPrefix}NativeLegoCatalog {`;
  const catalogStart = fullCatalog.indexOf(catalogMarker);
  if (catalogStart < 0) throw new Error(`missing generated catalog marker '${catalogMarker}'`);
  const catalogTypes = fullCatalog.slice(0, catalogStart).trimEnd() + "\n";
  const portIdsBody = [...registry.nodePorts, ...registry.componentPorts].map(emitPortId).join("\n");
  const aggregate = (generatedShardHeader(options, "the portable native-Lego domain catalog") +
    fullCatalog.slice(catalogStart))
    .replace(
      `    object PortIds {\n${portIdsBody}\n    }`,
      `    val PortIds = Generated${options.symbolPrefix}NativeLegoPortIds`,
    )
    .replace(
      /    val ports: List<GeneratedProductPort> = listOf\([\s\S]*?\n    \)\n\n    val portBindings:/,
      `    val ports: List<GeneratedProductPort> = Generated${options.symbolPrefix}NativeLegoPortData.ports\n\n    val portBindings:`,
    )
    .replace(
      /    val portBindings: List<GeneratedProductPortBinding> = listOf\([\s\S]*?\n    \)\n\n    val demandEdges:/,
      `    val portBindings: List<GeneratedProductPortBinding> = Generated${options.symbolPrefix}NativeLegoPortBindings.bindings\n\n    val demandEdges:`,
    )
    .replace(
      /    val demandEdges: List<GeneratedProductDemandEdge> = listOf\([\s\S]*?\n    \)\n\n    val allEdges: Set<GeneratedNativeLegoEdge> = setOf\([\s\S]*?\n    \)/,
      `    val demandEdges: List<GeneratedProductDemandEdge> = listOf(\n${chunks(registry.demandEdges, 300)
        .map((_, index) => `        Generated${options.symbolPrefix}NativeLegoDemandEdges${index}.entries,`)
        .join("\n")}\n    ).flatten()\n\n    val allEdges: Set<GeneratedNativeLegoEdge> = portBindings.mapTo(linkedSetOf()) {\n        GeneratedNativeLegoEdge(it.from.value, it.to.value)\n    }`,
    ).trimEnd() + "\n";

  const portIds = generatedShardHeader(options, "the portable native-Lego port IDs") + `
internal object Generated${options.symbolPrefix}NativeLegoPortIds {
${[...registry.nodePorts, ...registry.componentPorts].map(emitPortIdValue).join("\n")}
}
`;

  const portData = generatedShardHeader(options, "the portable native-Lego port registry") + `
internal object Generated${options.symbolPrefix}NativeLegoPortData {
    val ports: List<GeneratedProductPort> = listOf(
${[...registry.nodePorts, ...registry.componentPorts].map(emitProductPortCompact).join("\n")
  .replaceAll("PortIds.", `Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.`)}
    )
}
`;
  const portBindings = generatedShardHeader(options, "the portable native-Lego port bindings") + `
internal object Generated${options.symbolPrefix}NativeLegoPortBindings {
    val bindings: List<GeneratedProductPortBinding> = listOf(
${registry.bindings.map(emitPortBindingCompact).join("\n")
  .replaceAll("PortIds.", `Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.`)}
    )
}
`;
  const demandShards = chunks(registry.demandEdges, 300).map((edges, index) => ({
    suffix: `DemandEdges${index}`,
    content: generatedShardHeader(options, `portable demand-edge shard ${index}`) + `
internal object Generated${options.symbolPrefix}NativeLegoDemandEdges${index} {
    val entries: List<GeneratedProductDemandEdge> = listOf(
${edges.map(emitDemandEdgeCompact).join("\n")
  .replaceAll("PortIds.", `Generated${options.symbolPrefix}NativeLegoCatalog.PortIds.`)}
    )
}
`,
  }));
  return {
    aggregate,
    shards: [
      { suffix: "Types", content: catalogTypes },
      { suffix: "PortIds", content: portIds },
      { suffix: "PortData", content: portData },
      { suffix: "PortBindings", content: portBindings },
      ...demandShards,
    ],
  };
}

function generatedShardHeader(options: KotlinEmissionOptions, source: string): string {
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${source}
// Product declarations SHA-256: ${options.sourceSha}
package ${options.packageName}
`;
}

function chunks<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

/** Every contract kind in the catalog, sorted so the emitted enum is stable. */
function contractKinds(domains: readonly NativeLegoDomainProjectionEntry[]): string {
  const kinds = new Set(domains.flatMap(({ contracts }) => contracts.map(({ kind }) => kind)));
  return [...kinds].sort().map(kotlinEnumToken).join(", ");
}

function emitContract(contract: LegoContract): string {
  return `        GeneratedNativeLegoDeclaration(id = Contracts.${kotlinEnumToken(contract.id)}, kind = GeneratedNativeLegoKind.CONTRACT, contractKind = GeneratedNativeLegoContractKind.${kotlinEnumToken(contract.kind)}, fields = listOf(${contract.fields.map((item) => `GeneratedNativeLegoField(${kotlinStringLiteral(item.name)}, ${kotlinStringLiteral(valueType(item))}, ${item.unit === undefined ? "null" : kotlinStringLiteral(item.unit)}, ${item.nullable}, ${kotlinStringLiteral(item.clockDomain)})`).join(", ")})),`;
}

function emitConfig(config: LegoConfigRef): string {
  return `        GeneratedNativeLegoDeclaration(id = Configs.${kotlinEnumToken(config.id)}, kind = GeneratedNativeLegoKind.CONFIG),`;
}

function emitNode(node: ProductNodeInstance, domain: NativeLegoDomainProjectionEntry): string {
  const config = Object.entries(node.config);
  const lego = domain.nodeTypes.find(({ id }) => id === node.nodeTypeRef);
  if (lego === undefined) throw new Error(`node '${node.id}' has no type '${node.nodeTypeRef}' in domain '${domain.id}'`);
  const demandPort = node.activation?.kind === "leased"
    ? kotlinStringLiteral(node.activation.port)
    : "null";
  const activationKind = node.activation === undefined
    ? "null"
    : `GeneratedNodeActivationKind.${kotlinEnumToken(node.activation.kind)}`;
  return `        GeneratedNativeLegoDeclaration(id = Blocks.${kotlinEnumToken(node.id)}, kind = GeneratedNativeLegoKind.BLOCK, specId = ${kotlinStringLiteral(lego.id)}, nodeKind = ${kotlinStringLiteral(lego.kind)}, inputPorts = ${ports(lego.inputs)}, outputPorts = ${ports(lego.outputs)}, config = ${config.length === 0 ? "emptyMap()" : `mapOf(${config.map(([key, id]) => `${kotlinStringLiteral(key)} to BindingIds.${bindingToken(id, "config", domain)}`).join(", ")})`}, stateOwner = ${kotlinStringLiteral(lego.runtime.stateOwner)}, lifetime = ${kotlinStringLiteral(lego.runtime.lifetime)}, durability = ${kotlinStringLiteral(lego.runtime.durability)}, clockDomain = ${kotlinStringLiteral(lego.runtime.clockDomain)}, contextInputs = ${stringSet(lego.runtime.contextInputs)}, effects = ${stringSet(lego.runtime.effects)}, activationKind = ${activationKind}, demandPort = ${demandPort}, lifecycleSources = ${stringSet(node.activation?.lifecycleSources ?? [])}),`;
}

function emitConnection(connection: PortBindingIr): string {
  return `        GeneratedNativeLegoEdge(${kotlinStringLiteral(connection.from)}, ${kotlinStringLiteral(connection.to)}),`;
}

type BindingKind = "contract" | "config" | "block";

function bindingEntries(domain: NativeLegoDomainProjectionEntry): readonly Readonly<{ id: string; kind: BindingKind }>[] {
  return [
    ...domain.contracts.map(({ id }) => ({ id, kind: "contract" as const })),
    ...domain.configs.map(({ id }) => ({ id, kind: "config" as const })),
    ...domain.nodes.map(({ id }) => ({ id, kind: "block" as const })),
  ];
}

function bindingToken(id: string, kind: BindingKind, domain: NativeLegoDomainProjectionEntry): string {
  const token = kotlinEnumToken(id);
  const collides = bindingEntries(domain).filter((entry) => kotlinEnumToken(entry.id) === token).length > 1;
  return collides ? `${kotlinEnumToken(kind)}_${token}` : token;
}

function reference(id: string, kind: BindingKind): string {
  const owner = kind === "contract" ? "Contracts" : kind === "config" ? "Configs" : "Blocks";
  return `${owner}.${kotlinEnumToken(id)}`;
}

function emitPortId(port: PortRegistryEntry): string {
  const direction = port.direction === "input" ? "GeneratedProductInputPortId" : "GeneratedProductOutputPortId";
  return `        data object ${kotlinEnumToken(port.ref)} : ${direction} { override val value = ${kotlinStringLiteral(port.ref)} }`;
}

function emitPortIdValue(port: PortRegistryEntry): string {
  const token = kotlinEnumToken(port.ref);
  const direction = port.direction === "input" ? "GeneratedProductInputPortId" : "GeneratedProductOutputPortId";
  return `    data object ${token}_VALUE : ${direction} { override val value = ${kotlinStringLiteral(port.ref)} }; val ${token}: ${direction} = ${token}_VALUE`;
}

function emitProductPort(port: PortRegistryEntry): string {
  return `        GeneratedProductPort(
            id = PortIds.${kotlinEnumToken(port.ref)},
            ownerKind = GeneratedProductPortOwnerKind.${kotlinEnumToken(port.ownerKind)},
            ownerId = ${kotlinStringLiteral(port.ownerId)},
            typeRef = ${kotlinStringLiteral(port.typeRef)},
            portId = ${kotlinStringLiteral(port.portId)},
            direction = GeneratedProductPortDirection.${kotlinEnumToken(port.direction)},
            contractRef = ${kotlinStringLiteral(port.contractRef)},
            boundary = GeneratedProductPortBoundary.${kotlinEnumToken(port.boundary)},
            required = ${port.required},
            purpose = GeneratedProductPortPurpose.${kotlinEnumToken(port.purpose)},
        ),`;
}

function emitProductPortCompact(port: PortRegistryEntry): string {
  return `        GeneratedProductPort(PortIds.${kotlinEnumToken(port.ref)}, GeneratedProductPortOwnerKind.${kotlinEnumToken(port.ownerKind)}, ${kotlinStringLiteral(port.ownerId)}, ${kotlinStringLiteral(port.typeRef)}, ${kotlinStringLiteral(port.portId)}, GeneratedProductPortDirection.${kotlinEnumToken(port.direction)}, ${kotlinStringLiteral(port.contractRef)}, GeneratedProductPortBoundary.${kotlinEnumToken(port.boundary)}, ${port.required}, GeneratedProductPortPurpose.${kotlinEnumToken(port.purpose)}),`;
}

function emitPortBinding(binding: PortBindingIr): string {
  return `        GeneratedProductPortBinding(
            kind = GeneratedProductPortBindingKind.${kotlinEnumToken(binding.kind)},
            from = PortIds.${kotlinEnumToken(binding.from)},
            to = PortIds.${kotlinEnumToken(binding.to)},
            purpose = GeneratedProductPortPurpose.${kotlinEnumToken(binding.purpose)},
        ),`;
}

function emitPortBindingCompact(binding: PortBindingIr): string {
  return `        GeneratedProductPortBinding(GeneratedProductPortBindingKind.${kotlinEnumToken(binding.kind)}, PortIds.${kotlinEnumToken(binding.from)}, PortIds.${kotlinEnumToken(binding.to)}, GeneratedProductPortPurpose.${kotlinEnumToken(binding.purpose)}),`;
}

function emitDemandEdge(edge: ProductDemandEdge): string {
  if (edge.kind === "lifecycle") {
    return `        GeneratedProductDemandEdge(
            kind = "lifecycle",
            nodeInstanceRef = ${kotlinStringLiteral(edge.nodeInstanceRef)},
            targetPortRef = PortIds.${kotlinEnumToken(edge.targetPortRef)},
            source = ${kotlinStringLiteral(edge.source)},
            rootNodeInstanceRef = ${kotlinStringLiteral(edge.rootNodeInstanceRef)},
        ),`;
  }
  return `        GeneratedProductDemandEdge(
            kind = "component-mount",
            nodeInstanceRef = ${kotlinStringLiteral(edge.nodeInstanceRef)},
            targetPortRef = PortIds.${kotlinEnumToken(edge.targetPortRef)},
            artifactRef = ${kotlinStringLiteral(edge.artifactRef)},
            screenRef = ${kotlinStringLiteral(edge.screenRef)},
            surface = ${kotlinStringLiteral(edge.surface)},
            mountRef = ${kotlinStringLiteral(edge.mountRef)},
            componentInstanceRef = ${kotlinStringLiteral(edge.componentInstanceRef)},
        ),`;
}

function emitDemandEdgeCompact(edge: ProductDemandEdge): string {
  if (edge.kind === "lifecycle") {
    return `        GeneratedProductDemandEdge("lifecycle", ${kotlinStringLiteral(edge.nodeInstanceRef)}, PortIds.${kotlinEnumToken(edge.targetPortRef)}, source = ${kotlinStringLiteral(edge.source)}, rootNodeInstanceRef = ${kotlinStringLiteral(edge.rootNodeInstanceRef)}),`;
  }
  return `        GeneratedProductDemandEdge("component-mount", ${kotlinStringLiteral(edge.nodeInstanceRef)}, PortIds.${kotlinEnumToken(edge.targetPortRef)}, artifactRef = ${kotlinStringLiteral(edge.artifactRef)}, screenRef = ${kotlinStringLiteral(edge.screenRef)}, surface = ${kotlinStringLiteral(edge.surface)}, mountRef = ${kotlinStringLiteral(edge.mountRef)}, componentInstanceRef = ${kotlinStringLiteral(edge.componentInstanceRef)}),`;
}

function constant(id: string): string {
  return `        const val ${kotlinEnumToken(id)} = ${kotlinStringLiteral(id)}`;
}

function valueType(item: LegoField): string {
  return typeof item.value === "string" ? item.value : `ref:${item.value.ref}`;
}

function ports(values: readonly LegoPort[]): string {
  return values.length === 0
    ? "emptyList()"
    : `listOf(${values.map(({ id, contract }) => `GeneratedNativeLegoPort(${kotlinStringLiteral(id)}, Contracts.${kotlinEnumToken(contract.id)})`).join(", ")})`;
}

function stringSet(values: readonly string[]): string {
  return values.length === 0 ? "emptySet()" : `setOf(${values.map(kotlinStringLiteral).join(", ")})`;
}
