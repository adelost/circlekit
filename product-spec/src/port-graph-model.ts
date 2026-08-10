import type {
  ComponentType,
  ProductComponentInstance,
} from "./component-tree-model.js";
import {
  PRODUCT_LIFECYCLE_DEMAND_SOURCES,
  type ProductLifecycleDemandSource,
  type ProductNodeInstance,
} from "./node-instance-model.js";
import {
  validateProductNodeType,
  registerContract,
  requireIdentifier,
  requireUnique,
  requireWireId,
  validateConfigCatalog,
  validateNodeConfig,
  type LegoConfigRef,
  type LegoContract,
  type LegoPortPurpose,
  type ProductNodeType,
} from "./node-model.js";

export type PortOwnerKind = "node" | "component";
export type PortDirection = "input" | "output";
export type PortBindingKind = "node-input" | "component-input" | "component-event";

export interface PortRegistryEntry {
  readonly ref: string;
  readonly ownerKind: PortOwnerKind;
  readonly ownerId: string;
  readonly typeRef: string;
  readonly portId: string;
  readonly direction: PortDirection;
  readonly contractRef: string;
  readonly boundary: LegoContract["boundary"];
  readonly required: boolean;
  readonly purpose: LegoPortPurpose;
}

export interface PortBindingIr {
  readonly kind: PortBindingKind;
  readonly from: string;
  readonly to: string;
  readonly purpose: LegoPortPurpose;
}

export interface MountedComponentScope {
  readonly artifactRef: string;
  readonly screenRef: string;
  readonly surface: string;
  readonly mountRef: string;
  readonly componentInstanceRef: string;
}

export type ProductDemandEdge =
  | (MountedComponentScope & {
    readonly kind: "component-mount";
    readonly nodeInstanceRef: string;
    readonly targetPortRef: string;
  })
  | {
    readonly kind: "lifecycle";
    readonly source: ProductLifecycleDemandSource;
    readonly rootNodeInstanceRef: string;
    readonly nodeInstanceRef: string;
    readonly targetPortRef: string;
  };

export interface ProductPortRegistry {
  readonly contracts: readonly LegoContract[];
  readonly nodePorts: readonly PortRegistryEntry[];
  readonly componentPorts: readonly PortRegistryEntry[];
  readonly bindings: readonly PortBindingIr[];
  readonly demandEdges: readonly ProductDemandEdge[];
}

export interface CompiledProductGraph {
  readonly nodeTypes: readonly ProductNodeType[];
  readonly nodes: readonly ProductNodeInstance[];
  readonly configs: readonly LegoConfigRef[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly portRegistry: ProductPortRegistry;
}

export function compileProductGraph(input: {
  readonly nodeTypes: readonly ProductNodeType[];
  readonly nodes: readonly ProductNodeInstance[];
  readonly configs: readonly LegoConfigRef[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly mountedScopes: readonly MountedComponentScope[];
  /** Typed outputs consumed by another compiler-owned IR seam rather than a graph input. */
  readonly intrinsicConsumerContractRefs?: readonly string[];
}): CompiledProductGraph {
  requireUnique(input.nodeTypes.map(({ id }) => id), "node type");
  requireUnique(input.nodes.map(({ id }) => id), "node instance");
  requireUnique(input.componentTypes.map(({ id }) => id), "component type");
  requireUnique(input.components.map(({ id }) => id), "component instance");
  requireUnique(
    [...input.nodes.map(({ id }) => id), ...input.components.map(({ id }) => id)],
    "product instance",
  );

  const contracts = new Map<string, LegoContract>();
  const nodeTypes = new Map(input.nodeTypes.map((item) => [item.id, validateProductNodeType(item)]));
  const componentTypes = new Map(input.componentTypes.map((item) => [item.id, item]));
  const usedNodeTypes = new Set(input.nodes.map(({ nodeTypeRef }) => nodeTypeRef));
  const usedComponentTypes = new Set(input.components.map(({ componentTypeRef }) => componentTypeRef));
  const orphanNodeTypes = input.nodeTypes.map(({ id }) => id).filter((id) => !usedNodeTypes.has(id));
  const orphanComponentTypes = input.componentTypes.map(({ id }) => id).filter((id) => !usedComponentTypes.has(id));
  if (orphanNodeTypes.length > 0) throw new Error(`orphan node type '${orphanNodeTypes.join("', '")}'`);
  if (orphanComponentTypes.length > 0) throw new Error(`orphan component type '${orphanComponentTypes.join("', '")}'`);
  const configs = validateConfigCatalog(input.configs);
  const usedConfigs = new Set<string>();
  const nodePorts: PortRegistryEntry[] = [];
  const componentPorts: PortRegistryEntry[] = [];
  const inputs = new Map<string, PortRegistryEntry>();
  const outputs = new Map<string, PortRegistryEntry>();
  const nodeById = new Map(input.nodes.map((item) => [item.id, item]));
  const componentById = new Map(input.components.map((item) => [item.id, item]));
  const demandPortByNode = new Map<string, string>();

  for (const instance of input.nodes) {
    requireWireId(instance.id, "node instance");
    const spec = nodeTypes.get(instance.nodeTypeRef);
    if (spec === undefined) throw new Error(`node '${instance.id}' uses unknown node type '${instance.nodeTypeRef}'`);
    const demandInputs = spec.inputs.filter(({ purpose }) => purpose === "demand");
    const demandOutputs = spec.outputs.filter(({ purpose }) => purpose === "demand");
    if (spec.kind !== "service" && demandInputs.length + demandOutputs.length > 0) {
      throw new Error(`${spec.kind} '${instance.id}' cannot own demand ports; demand changes service lifecycle`);
    }
    if (spec.kind !== "service") {
      if (instance.activation !== undefined) {
        throw new Error(`${spec.kind} '${instance.id}' cannot declare activation`);
      }
    } else if (instance.activation === undefined) {
      throw new Error(`service '${instance.id}' must declare activation`);
    }
    const activation = instance.activation;
    if (demandInputs.length > 1) {
      throw new Error(`node '${instance.id}' declares ambiguous demand inputs (found ${demandInputs.length})`);
    }
    if (spec.kind === "service" && demandInputs.length === 1) {
      if (activation?.kind !== "leased") {
        throw new Error(`service '${instance.id}' declares a demand input and must use leased activation`);
      }
      if (activation.port !== demandInputs[0]!.id) {
        throw new Error(
          `service '${instance.id}' activation targets '${activation.port}', expected '${demandInputs[0]!.id}'`,
        );
      }
      demandPortByNode.set(instance.id, `${instance.id}.${demandInputs[0]!.id}`);
    } else if (spec.kind === "service" && activation?.kind !== "lifetime") {
      throw new Error(`service '${instance.id}' has no demand input and must use lifetime activation`);
    }
    const lifecycleSources = activation?.lifecycleSources ?? [];
    requireUnique(lifecycleSources, `lifecycle demand source in service '${instance.id}'`);
    for (const source of lifecycleSources) {
      if (!PRODUCT_LIFECYCLE_DEMAND_SOURCES.includes(source)) {
        throw new Error(`service '${instance.id}' uses unknown lifecycle demand source '${String(source)}'`);
      }
    }
    validateNodeConfig(instance.id, spec, instance.config, configs).forEach((id) => usedConfigs.add(id));
    for (const [direction, ports] of [["input", spec.inputs], ["output", spec.outputs]] as const) {
      for (const item of ports) {
        registerContract(contracts, item.contract);
        const entry: PortRegistryEntry = {
          ref: `${instance.id}.${item.id}`,
          ownerKind: "node",
          ownerId: instance.id,
          typeRef: instance.nodeTypeRef,
          portId: item.id,
          direction,
          contractRef: item.contract.id,
          boundary: item.contract.boundary,
          required: direction === "output" || item.purpose !== "context",
          purpose: item.purpose,
        };
        nodePorts.push(entry);
        (direction === "input" ? inputs : outputs).set(entry.ref, entry);
      }
    }
  }

  for (const instance of input.components) {
    requireWireId(instance.id, "component instance");
    const type = componentTypes.get(instance.componentTypeRef);
    if (type === undefined) throw new Error(`component '${instance.id}' uses unknown component type '${instance.componentTypeRef}'`);
    for (const [direction, ports] of [["input", type.inputs], ["output", type.outputs]] as const) {
      for (const item of ports) {
        requireIdentifier(item.id, `${direction} in component type '${type.id}'`);
        registerContract(contracts, item.contract);
        if (item.contract.boundary === "service-internal") {
          throw new Error(`component '${instance.id}' ${direction} '${item.id}' uses service-internal contract '${item.contract.id}'`);
        }
        if (direction === "input" && (item.contract.boundary !== "presentation" || item.contract.kind === "event")) {
          throw new Error(`component '${instance.id}' input '${item.id}' must use a presentation contract`);
        }
        if (direction === "output" && (item.contract.boundary !== "ui-event" || item.contract.kind !== "event")) {
          throw new Error(`component '${instance.id}' output '${item.id}' must use a ui-event contract`);
        }
        const entry: PortRegistryEntry = {
          ref: `${instance.id}.${item.id}`,
          ownerKind: "component",
          ownerId: instance.id,
          typeRef: instance.componentTypeRef,
          portId: item.id,
          direction,
          contractRef: item.contract.id,
          boundary: item.contract.boundary,
          required: item.required,
          purpose: "data",
        };
        componentPorts.push(entry);
        (direction === "input" ? inputs : outputs).set(entry.ref, entry);
      }
    }
  }

  const orphanConfigs = [...configs.keys()].filter((id) => !usedConfigs.has(id));
  if (orphanConfigs.length > 0) throw new Error(`orphan config '${orphanConfigs.join("', '")}'`);
  const bindings: PortBindingIr[] = [];
  const boundInputs = new Set<string>();
  const usedOutputs = new Set<string>();

  for (const instance of input.nodes) {
    const spec = nodeTypes.get(instance.nodeTypeRef)!;
    const declared = new Set(spec.inputs.map(({ id }) => id));
    for (const [port, from] of Object.entries(instance.bindings)) {
      if (!declared.has(port)) throw new Error(`node '${instance.id}' binds extra input '${port}'`);
      const sourceOwner = from.slice(0, from.lastIndexOf("."));
      bind(componentById.has(sourceOwner) ? "component-event" : "node-input", from, `${instance.id}.${port}`);
    }
    const missing = spec.inputs.filter(({ purpose }) => purpose === "data")
      .map(({ id }) => id).filter((id) => !(id in instance.bindings));
    if (missing.length > 0) throw new Error(`node '${instance.id}' is missing input binding '${missing.join("', '")}'`);
  }

  for (const instance of input.components) {
    const type = componentTypes.get(instance.componentTypeRef)!;
    const declaredInputs = new Map(type.inputs.map((item) => [item.id, item]));
    const declaredOutputs = new Map(type.outputs.map((item) => [item.id, item]));
    for (const [port, from] of Object.entries(instance.bindings.inputs)) {
      if (!declaredInputs.has(port)) throw new Error(`component '${instance.id}' binds extra input '${port}'`);
      bind("component-input", from, `${instance.id}.${port}`);
    }
    for (const [port, to] of Object.entries(instance.bindings.events)) {
      if (!declaredOutputs.has(port)) throw new Error(`component '${instance.id}' binds extra event '${port}'`);
      const from = `${instance.id}.${port}`;
      const eventBinding = bindings.find((candidate) => candidate.from === from && candidate.to === to);
      if (eventBinding === undefined || eventBinding.kind !== "component-event") {
        throw new Error(`component event '${from}' does not match service input binding '${to}'`);
      }
    }
    const missingInputs = type.inputs.filter(({ required }) => required)
      .map(({ id }) => id).filter((id) => !(id in instance.bindings.inputs));
    const missingEvents = type.outputs.filter(({ required }) => required)
      .map(({ id }) => id).filter((id) => !(id in instance.bindings.events));
    if (missingInputs.length > 0) throw new Error(`component '${instance.id}' is missing input binding '${missingInputs.join("', '")}'`);
    if (missingEvents.length > 0) throw new Error(`component '${instance.id}' is missing event binding '${missingEvents.join("', '")}'`);
  }

  const intrinsicConsumerContractRefs = input.intrinsicConsumerContractRefs ?? [];
  requireUnique(intrinsicConsumerContractRefs, "intrinsic consumer contract");
  const intrinsicConsumers = new Set(intrinsicConsumerContractRefs);
  const orphanOutputs = [...outputs.values()].filter(({ required, ref, contractRef }) =>
    required && !usedOutputs.has(ref) && !intrinsicConsumers.has(contractRef));
  if (orphanOutputs.length > 0) throw new Error(`orphan output port '${orphanOutputs.map(({ ref }) => ref).join("', '")}'`);
  requireAcyclic(input.nodes, bindings);
  const mountedIds = new Set(input.mountedScopes.map(({ componentInstanceRef }) => componentInstanceRef));
  const orphanComponents = input.components.map(({ id }) => id).filter((id) => !mountedIds.has(id));
  if (orphanComponents.length > 0) throw new Error(`orphan component instance '${orphanComponents.join("', '")}'`);
  const demandEdges = deriveDemandEdges(
    input.mountedScopes,
    input.nodes,
    bindings,
    nodeById,
    componentById,
    demandPortByNode,
  );
  const demandedNodes = new Set(demandEdges.map(({ nodeInstanceRef }) => nodeInstanceRef));
  const orphanNodes = [...demandPortByNode.keys()].filter((id) => !demandedNodes.has(id));
  if (orphanNodes.length > 0) throw new Error(`orphan leased service '${orphanNodes.join("', '")}'`);

  return {
    nodeTypes: input.nodeTypes,
    nodes: input.nodes,
    configs: input.configs,
    componentTypes: input.componentTypes,
    components: input.components,
    portRegistry: {
      contracts: [...contracts.values()],
      nodePorts,
      componentPorts,
      bindings,
      demandEdges,
    },
  };

  function bind(kind: PortBindingKind, from: string, to: string): void {
    const source = outputs.get(from);
    const target = inputs.get(to);
    if (source === undefined) throw new Error(`unknown output port '${from}'`);
    if (target === undefined) throw new Error(`unknown input port '${to}'`);
    if (source.contractRef !== target.contractRef || source.boundary !== target.boundary
        || source.purpose !== target.purpose) {
      throw new Error(`incompatible ports '${from}' and '${to}'`);
    }
    const sourceNode = source.ownerKind === "node"
      ? nodeTypes.get(nodeById.get(source.ownerId)?.nodeTypeRef ?? "")
      : undefined;
    const targetNode = target.ownerKind === "node"
      ? nodeTypes.get(nodeById.get(target.ownerId)?.nodeTypeRef ?? "")
      : undefined;
    if (target.ownerKind === "component" && sourceNode?.kind !== "present") {
      throw new Error(
        `${sourceNode?.kind ?? source.ownerKind} '${source.ownerId}' cannot feed component '${target.ownerId}' directly; ` +
        "add a final present node",
      );
    }
    if (sourceNode?.kind === "present" && target.ownerKind === "node") {
      throw new Error(
        `'${source.ownerId}' is present and feeds '${target.ownerId}' which is also a node; ` +
        `make '${source.ownerId}' derive - only the final node before a component may be present`,
      );
    }
    if (source.ownerKind === "component" && targetNode?.kind !== "service") {
      throw new Error(`component event '${from}' must target a service input, not ${targetNode?.kind ?? target.ownerKind}`);
    }
    if (boundInputs.has(to)) throw new Error(`input port '${to}' is bound twice`);
    boundInputs.add(to);
    usedOutputs.add(from);
    bindings.push({ kind, from, to, purpose: target.purpose });
  }
}

function requireAcyclic(nodes: readonly ProductNodeInstance[], bindings: readonly PortBindingIr[]): void {
  const ids = new Set(nodes.map(({ id }) => id));
  const graph = new Map([...ids].map((id) => [id, new Set<string>()]));
  for (const binding of bindings) {
    const from = binding.from.slice(0, binding.from.lastIndexOf("."));
    const to = binding.to.slice(0, binding.to.lastIndexOf("."));
    if (ids.has(from) && ids.has(to)) graph.get(from)?.add(to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`node binding cycle reaches '${id}'`);
    if (visited.has(id)) return;
    visiting.add(id);
    graph.get(id)?.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  graph.forEach((_, id) => visit(id));
}

function deriveDemandEdges(
  scopes: readonly MountedComponentScope[],
  nodeInstances: readonly ProductNodeInstance[],
  bindings: readonly PortBindingIr[],
  nodes: ReadonlyMap<string, ProductNodeInstance>,
  components: ReadonlyMap<string, ProductComponentInstance>,
  demandPortByNode: ReadonlyMap<string, string>,
): ProductDemandEdge[] {
  const incomingByOwner = new Map<string, Set<string>>();
  const directByComponent = new Map<string, Set<string>>();
  for (const binding of bindings) {
    const fromOwner = binding.from.slice(0, binding.from.lastIndexOf("."));
    const toOwner = binding.to.slice(0, binding.to.lastIndexOf("."));
    if (nodes.has(toOwner) && nodes.has(fromOwner) && binding.purpose !== "context") {
      const demandedOwner = binding.purpose === "demand" ? fromOwner : toOwner;
      const dependencyOwner = binding.purpose === "demand" ? toOwner : fromOwner;
      const set = incomingByOwner.get(demandedOwner) ?? new Set<string>();
      set.add(dependencyOwner);
      incomingByOwner.set(demandedOwner, set);
    }
    if (components.has(toOwner) && nodes.has(fromOwner)) {
      const set = directByComponent.get(toOwner) ?? new Set<string>();
      set.add(fromOwner);
      directByComponent.set(toOwner, set);
    }
    if (components.has(fromOwner) && nodes.has(toOwner)) {
      const set = directByComponent.get(fromOwner) ?? new Set<string>();
      set.add(toOwner);
      directByComponent.set(fromOwner, set);
    }
  }
  const result: ProductDemandEdge[] = [];
  for (const scope of scopes) {
    const visited = new Set<string>();
    const demanded = new Set<string>();
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      if (demandPortByNode.has(id)) demanded.add(id);
      incomingByOwner.get(id)?.forEach(visit);
    };
    directByComponent.get(scope.componentInstanceRef)?.forEach(visit);
    for (const nodeInstanceRef of [...demanded].sort()) {
      result.push({
        kind: "component-mount",
        ...scope,
        nodeInstanceRef,
        targetPortRef: demandPortByNode.get(nodeInstanceRef)!,
      });
    }
  }
  for (const root of nodeInstances) {
    for (const source of root.activation?.lifecycleSources ?? []) {
      const visited = new Set<string>();
      const demanded = new Set<string>();
      const visit = (id: string): void => {
        if (visited.has(id)) return;
        visited.add(id);
        if (demandPortByNode.has(id)) demanded.add(id);
        incomingByOwner.get(id)?.forEach(visit);
      };
      visit(root.id);
      if (demanded.size === 0) {
        throw new Error(`service '${root.id}' lifecycle source '${source}' reaches no leased service`);
      }
      for (const nodeInstanceRef of [...demanded].sort()) {
        result.push({
          kind: "lifecycle",
          source,
          rootNodeInstanceRef: root.id,
          nodeInstanceRef,
          targetPortRef: demandPortByNode.get(nodeInstanceRef)!,
        });
      }
    }
  }
  return result;
}
