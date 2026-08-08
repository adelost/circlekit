import type {
  ComponentType,
  ProductComponentInstance,
} from "./component-tree-model.js";
import {
  PRODUCT_LIFECYCLE_DEMAND_SOURCES,
  type ProductLifecycleDemandSource,
  type ProductServiceInstance,
} from "./product-instance-model.js";
import {
  defineLegoSpec,
  registerContract,
  requireIdentifier,
  requireUnique,
  requireWireId,
  validateConfigCatalog,
  validateServiceConfig,
  type LegoConfigRef,
  type LegoContract,
  type LegoPortPurpose,
  type LegoSpec,
} from "./native-lego-model.js";

export type PortOwnerKind = "service" | "component";
export type PortDirection = "input" | "output";
export type PortBindingKind = "service-input" | "component-input" | "component-event";

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
    readonly serviceInstanceRef: string;
  })
  | {
    readonly kind: "lifecycle";
    readonly source: ProductLifecycleDemandSource;
    readonly rootServiceInstanceRef: string;
    readonly serviceInstanceRef: string;
  };

export interface ProductPortRegistry {
  readonly contracts: readonly LegoContract[];
  readonly servicePorts: readonly PortRegistryEntry[];
  readonly componentPorts: readonly PortRegistryEntry[];
  readonly bindings: readonly PortBindingIr[];
  readonly demandEdges: readonly ProductDemandEdge[];
}

export interface CompiledProductGraph {
  readonly serviceTypes: readonly LegoSpec[];
  readonly services: readonly ProductServiceInstance[];
  readonly configs: readonly LegoConfigRef[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly portRegistry: ProductPortRegistry;
}

export function compileProductGraph(input: {
  readonly serviceTypes: readonly LegoSpec[];
  readonly services: readonly ProductServiceInstance[];
  readonly configs: readonly LegoConfigRef[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly mountedScopes: readonly MountedComponentScope[];
}): CompiledProductGraph {
  requireUnique(input.serviceTypes.map(({ id }) => id), "service type");
  requireUnique(input.services.map(({ id }) => id), "service instance");
  requireUnique(input.componentTypes.map(({ id }) => id), "component type");
  requireUnique(input.components.map(({ id }) => id), "component instance");
  requireUnique(
    [...input.services.map(({ id }) => id), ...input.components.map(({ id }) => id)],
    "product instance",
  );

  const contracts = new Map<string, LegoContract>();
  const serviceTypes = new Map(input.serviceTypes.map((item) => [item.id, defineLegoSpec(item)]));
  const componentTypes = new Map(input.componentTypes.map((item) => [item.id, item]));
  const usedServiceTypes = new Set(input.services.map(({ serviceTypeRef }) => serviceTypeRef));
  const usedComponentTypes = new Set(input.components.map(({ componentTypeRef }) => componentTypeRef));
  const orphanServiceTypes = input.serviceTypes.map(({ id }) => id).filter((id) => !usedServiceTypes.has(id));
  const orphanComponentTypes = input.componentTypes.map(({ id }) => id).filter((id) => !usedComponentTypes.has(id));
  if (orphanServiceTypes.length > 0) throw new Error(`orphan service type '${orphanServiceTypes.join("', '")}'`);
  if (orphanComponentTypes.length > 0) throw new Error(`orphan component type '${orphanComponentTypes.join("', '")}'`);
  const configs = validateConfigCatalog(input.configs);
  const usedConfigs = new Set<string>();
  const servicePorts: PortRegistryEntry[] = [];
  const componentPorts: PortRegistryEntry[] = [];
  const inputs = new Map<string, PortRegistryEntry>();
  const outputs = new Map<string, PortRegistryEntry>();
  const serviceById = new Map(input.services.map((item) => [item.id, item]));
  const componentById = new Map(input.components.map((item) => [item.id, item]));

  for (const instance of input.services) {
    requireWireId(instance.id, "service instance");
    requireUnique(instance.demandSources, `lifecycle demand source in service '${instance.id}'`);
    for (const source of instance.demandSources) {
      if (!PRODUCT_LIFECYCLE_DEMAND_SOURCES.includes(source)) {
        throw new Error(`service '${instance.id}' uses unknown lifecycle demand source '${String(source)}'`);
      }
    }
    const spec = serviceTypes.get(instance.serviceTypeRef);
    if (spec === undefined) throw new Error(`service '${instance.id}' uses unknown service type '${instance.serviceTypeRef}'`);
    validateServiceConfig(instance.id, spec, instance.config, configs).forEach((id) => usedConfigs.add(id));
    for (const [direction, ports] of [["input", spec.inputs], ["output", spec.outputs]] as const) {
      for (const item of ports) {
        registerContract(contracts, item.contract);
        const entry: PortRegistryEntry = {
          ref: `${instance.id}.${item.id}`,
          ownerKind: "service",
          ownerId: instance.id,
          typeRef: instance.serviceTypeRef,
          portId: item.id,
          direction,
          contractRef: item.contract.id,
          boundary: item.contract.boundary,
          required: direction === "output" || item.purpose !== "context",
          purpose: item.purpose,
        };
        servicePorts.push(entry);
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

  for (const instance of input.services) {
    const spec = serviceTypes.get(instance.serviceTypeRef)!;
    const declared = new Set(spec.inputs.map(({ id }) => id));
    for (const [port, from] of Object.entries(instance.bindings)) {
      if (!declared.has(port)) throw new Error(`service '${instance.id}' binds extra input '${port}'`);
      const sourceOwner = from.slice(0, from.lastIndexOf("."));
      bind(componentById.has(sourceOwner) ? "component-event" : "service-input", from, `${instance.id}.${port}`);
    }
    const missing = spec.inputs.filter(({ purpose }) => purpose !== "context")
      .map(({ id }) => id).filter((id) => !(id in instance.bindings));
    if (missing.length > 0) throw new Error(`service '${instance.id}' is missing input binding '${missing.join("', '")}'`);
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
      const serviceBinding = bindings.find((candidate) => candidate.from === from && candidate.to === to);
      if (serviceBinding === undefined || serviceBinding.kind !== "component-event") {
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

  const orphanOutputs = [...outputs.values()].filter(({ required, ref }) => required && !usedOutputs.has(ref));
  if (orphanOutputs.length > 0) throw new Error(`orphan output port '${orphanOutputs.map(({ ref }) => ref).join("', '")}'`);
  requireAcyclic(input.services, bindings);
  const mountedIds = new Set(input.mountedScopes.map(({ componentInstanceRef }) => componentInstanceRef));
  const orphanComponents = input.components.map(({ id }) => id).filter((id) => !mountedIds.has(id));
  if (orphanComponents.length > 0) throw new Error(`orphan component instance '${orphanComponents.join("', '")}'`);
  const demandEdges = deriveDemandEdges(input.mountedScopes, input.services, bindings, serviceById, componentById);
  const demandedServices = new Set(demandEdges.map(({ serviceInstanceRef }) => serviceInstanceRef));
  const orphanServices = input.services.map(({ id }) => id).filter((id) => !demandedServices.has(id));
  if (orphanServices.length > 0) throw new Error(`orphan service instance '${orphanServices.join("', '")}'`);

  return {
    serviceTypes: input.serviceTypes,
    services: input.services,
    configs: input.configs,
    componentTypes: input.componentTypes,
    components: input.components,
    portRegistry: {
      contracts: [...contracts.values()],
      servicePorts,
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
    if (boundInputs.has(to)) throw new Error(`input port '${to}' is bound twice`);
    boundInputs.add(to);
    usedOutputs.add(from);
    bindings.push({ kind, from, to, purpose: target.purpose });
  }
}

function requireAcyclic(services: readonly ProductServiceInstance[], bindings: readonly PortBindingIr[]): void {
  const ids = new Set(services.map(({ id }) => id));
  const graph = new Map([...ids].map((id) => [id, new Set<string>()]));
  for (const binding of bindings) {
    const from = binding.from.slice(0, binding.from.lastIndexOf("."));
    const to = binding.to.slice(0, binding.to.lastIndexOf("."));
    if (ids.has(from) && ids.has(to)) graph.get(from)?.add(to);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error(`service binding cycle reaches '${id}'`);
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
  serviceInstances: readonly ProductServiceInstance[],
  bindings: readonly PortBindingIr[],
  services: ReadonlyMap<string, ProductServiceInstance>,
  components: ReadonlyMap<string, ProductComponentInstance>,
): ProductDemandEdge[] {
  const incomingByOwner = new Map<string, Set<string>>();
  const directByComponent = new Map<string, Set<string>>();
  for (const binding of bindings) {
    const fromOwner = binding.from.slice(0, binding.from.lastIndexOf("."));
    const toOwner = binding.to.slice(0, binding.to.lastIndexOf("."));
    if (services.has(toOwner) && services.has(fromOwner) && binding.purpose !== "context") {
      const demandedOwner = binding.purpose === "demand" ? fromOwner : toOwner;
      const dependencyOwner = binding.purpose === "demand" ? toOwner : fromOwner;
      const set = incomingByOwner.get(demandedOwner) ?? new Set<string>();
      set.add(dependencyOwner);
      incomingByOwner.set(demandedOwner, set);
    }
    if (components.has(toOwner) && services.has(fromOwner)) {
      const set = directByComponent.get(toOwner) ?? new Set<string>();
      set.add(fromOwner);
      directByComponent.set(toOwner, set);
    }
    if (components.has(fromOwner) && services.has(toOwner)) {
      const set = directByComponent.get(fromOwner) ?? new Set<string>();
      set.add(toOwner);
      directByComponent.set(fromOwner, set);
    }
  }
  const result: ProductDemandEdge[] = [];
  for (const scope of scopes) {
    const demanded = new Set<string>();
    const visit = (id: string): void => {
      if (demanded.has(id)) return;
      demanded.add(id);
      incomingByOwner.get(id)?.forEach(visit);
    };
    directByComponent.get(scope.componentInstanceRef)?.forEach(visit);
    for (const serviceInstanceRef of [...demanded].sort()) {
      result.push({ kind: "component-mount", ...scope, serviceInstanceRef });
    }
  }
  for (const root of serviceInstances) {
    for (const source of root.demandSources) {
      const demanded = new Set<string>();
      const visit = (id: string): void => {
        if (demanded.has(id)) return;
        demanded.add(id);
        incomingByOwner.get(id)?.forEach(visit);
      };
      visit(root.id);
      for (const serviceInstanceRef of [...demanded].sort()) {
        result.push({
          kind: "lifecycle",
          source,
          rootServiceInstanceRef: root.id,
          serviceInstanceRef,
        });
      }
    }
  }
  return result;
}
