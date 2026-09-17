import {
  registerContract,
  requireIdentifier,
  requireUnique,
  requireWireId,
  type LegoContract,
} from "./node-model.js";
import { frozen } from "./frozen.js";

export const PORTABLE_SURFACE_CLASSES = ["round", "compact", "wide"] as const;
export type PortableSurfaceClass = (typeof PORTABLE_SURFACE_CLASSES)[number];

export type ComponentRequirement =
  | { readonly kind: "required" }
  | { readonly kind: "optional"; readonly fallback: "omit" };

export interface ComponentPortDeclaration<
  Id extends string = string,
  Contract extends LegoContract = LegoContract,
> {
  readonly id: Id;
  readonly contract: Contract;
  readonly required?: boolean;
}

export interface ComponentPort<
  Id extends string = string,
  Contract extends LegoContract = LegoContract,
> {
  readonly id: Id;
  readonly contract: Contract;
  readonly required: boolean;
}

/** What a port names in the object form: a contract, or a presentation, which means its contract. */
export type ComponentPortSource<Contract extends LegoContract = LegoContract> =
  | Contract
  | { readonly contract: Contract };

/** Ports as a list of componentPort(...) calls, or as an object whose keys are the port names, in order. */
export type ComponentPortsDeclaration =
  | readonly ComponentPortDeclaration[]
  | { readonly [id: string]: ComponentPortSource };

/** The capability a component type needs unless it says otherwise: its renderer draws a component tree. */
export const COMPONENT_TREE_CAPABILITY = "ui.component-tree";

export interface ComponentTypeDeclaration<Id extends string = string> {
  readonly id: Id;
  /** Written only when a type needs something other than [COMPONENT_TREE_CAPABILITY]. */
  readonly requiredCapabilities?: readonly string[];
  readonly inputs: ComponentPortsDeclaration;
  readonly outputs: ComponentPortsDeclaration;
}

export interface ComponentType<Id extends string = string> {
  readonly id: Id;
  readonly requiredCapabilities: readonly string[];
  readonly inputs: readonly ComponentPort[];
  readonly outputs: readonly ComponentPort[];
}

export function componentPort<
  const Id extends string,
  const Contract extends LegoContract,
>(id: Id, contract: Contract, options: { readonly required?: boolean } = {}): ComponentPortDeclaration<Id, Contract> {
  return { id, contract, ...(options.required === undefined ? {} : { required: options.required }) };
}

type NormalizedComponentPort<Port extends ComponentPortDeclaration> =
  Port extends ComponentPortDeclaration<infer Id, infer Contract>
    ? ComponentPort<Id, Contract> & { readonly required: Port["required"] extends false ? false : true }
    : never;

type ContractOfSource<Source> =
  Source extends { readonly contract: infer Contract extends LegoContract } ? Contract
    : Source extends LegoContract ? Source
      : never;

/** A list keeps its tuple; an object becomes a list of its ports, which is what bindings read ([number]). */
type NormalizedComponentPorts<Ports extends ComponentPortsDeclaration> =
  Ports extends readonly ComponentPortDeclaration[]
    ? { readonly [Index in keyof Ports]: Ports[Index] extends ComponentPortDeclaration
      ? NormalizedComponentPort<Ports[Index]>
      : never }
    : readonly {
      [Id in keyof Ports & string]: ComponentPort<Id, ContractOfSource<Ports[Id]>> & { readonly required: true }
    }[keyof Ports & string][];

export type NormalizedComponentType<Declaration extends ComponentTypeDeclaration> =
  ComponentType<Declaration["id"]> & {
    readonly requiredCapabilities: Declaration extends { readonly requiredCapabilities: infer Capabilities extends readonly string[] }
      ? Capabilities
      : readonly [typeof COMPONENT_TREE_CAPABILITY];
    readonly inputs: NormalizedComponentPorts<Declaration["inputs"]>;
    readonly outputs: NormalizedComponentPorts<Declaration["outputs"]>;
  };

function isPortList(ports: ComponentPortsDeclaration): ports is readonly ComponentPortDeclaration[] {
  return Array.isArray(ports);
}

function contractOfSource(source: ComponentPortSource): LegoContract {
  return "contract" in source ? source.contract : source;
}

function portDeclarations(ports: ComponentPortsDeclaration): readonly ComponentPortDeclaration[] {
  if (isPortList(ports)) return ports;
  return Object.entries(ports).map(([id, source]) => ({ id, contract: contractOfSource(source) }));
}

export function defineComponentType<const Declaration extends ComponentTypeDeclaration>(
  declaration: Declaration,
): NormalizedComponentType<Declaration> {
  requireWireId(declaration.id, "component type");
  const requiredCapabilities = declaration.requiredCapabilities ?? [COMPONENT_TREE_CAPABILITY];
  requireUnique(requiredCapabilities, `capability in component type '${declaration.id}'`);
  requiredCapabilities.forEach((id) => requireWireId(id, `capability in component type '${declaration.id}'`));
  const contracts = new Map<string, LegoContract>();
  const normalize = (declared: ComponentPortsDeclaration, direction: "input" | "output"): ComponentPort[] => {
    const ports = portDeclarations(declared);
    requireUnique(ports.map(({ id }) => id), `${direction} in component type '${declaration.id}'`);
    return ports.map((item) => {
      requireIdentifier(item.id, `${direction} in component type '${declaration.id}'`);
      registerContract(contracts, item.contract);
      if (item.contract.boundary === "service-internal") {
        throw new Error(`component type '${declaration.id}' ${direction} '${item.id}' uses service-internal contract '${item.contract.id}'`);
      }
      if (direction === "input" && (item.contract.boundary !== "presentation" || item.contract.kind === "event")) {
        throw new Error(`component type '${declaration.id}' input '${item.id}' must use a presentation contract`);
      }
      if (direction === "output" && (item.contract.boundary !== "ui-event" || item.contract.kind !== "event")) {
        throw new Error(`component type '${declaration.id}' output '${item.id}' must use a ui-event contract`);
      }
      return { id: item.id, contract: item.contract, required: item.required ?? true };
    });
  };
  return frozen({
    id: declaration.id,
    requiredCapabilities,
    inputs: normalize(declaration.inputs, "input"),
    outputs: normalize(declaration.outputs, "output"),
  } as unknown as NormalizedComponentType<Declaration>);
}

export interface ProductComponentInstance<Id extends string = string, TypeRef extends string = string> {
  readonly id: Id;
  readonly componentTypeRef: TypeRef;
  readonly bindings: {
    readonly inputs: Readonly<Record<string, string>>;
    readonly events: Readonly<Record<string, string>>;
  };
}

export interface ComponentMount<InstanceId extends string = string> {
  readonly id: string;
  readonly instance: InstanceId;
  readonly region: string;
  readonly order: number;
  readonly priority: number;
  readonly capacity: number | null;
  readonly requirement: ComponentRequirement;
}

export interface ComponentMountDeclaration<InstanceId extends string = string> {
  readonly instance: InstanceId;
  readonly region: string;
  readonly mountId?: string;
  readonly priority?: number;
  readonly capacity?: number;
  readonly requirement?: ComponentRequirement;
}

export interface SurfaceComponentTree<InstanceId extends string = string> {
  readonly surface: PortableSurfaceClass;
  readonly mounts: readonly ComponentMount<InstanceId>[];
}

export interface SurfaceFamily<InstanceId extends string = string> {
  readonly id: string;
  readonly trees: readonly SurfaceComponentTree<InstanceId>[];
}

export interface SurfaceFamilyDeclaration<InstanceId extends string = string> {
  readonly id: string;
  readonly trees: readonly {
    readonly surface: PortableSurfaceClass;
    readonly mounts: readonly ComponentMountDeclaration<InstanceId>[];
  }[];
}

export interface ScreenComponentFamilyRef<ScreenRef extends string = string, Family extends SurfaceFamily = SurfaceFamily> {
  readonly screen: ScreenRef;
  readonly family: Family;
}

export function defineSurfaceFamily<const Instances extends readonly ProductComponentInstance[]>(
  instances: Instances,
  family: SurfaceFamilyDeclaration<Instances[number]["id"]>,
): SurfaceFamily<Instances[number]["id"]> {
  requireWireId(family.id, "surface family id");
  requireUnique(family.trees.map(({ surface }) => surface), `${family.id} surface`);
  const surfaces = new Set(family.trees.map(({ surface }) => surface));
  if (surfaces.size !== PORTABLE_SURFACE_CLASSES.length ||
      PORTABLE_SURFACE_CLASSES.some((surface) => !surfaces.has(surface))) {
    throw new Error(`${family.id} must cover round, compact and wide exactly once`);
  }
  const instanceIds = new Set(instances.map(({ id }) => id));
  const trees = family.trees.map((tree) => ({
    surface: tree.surface,
    mounts: tree.mounts.map((mount, order) => ({
      id: mount.mountId ?? mount.instance,
      instance: mount.instance,
      region: mount.region,
      order,
      priority: mount.priority ?? 0,
      capacity: mount.capacity ?? null,
      requirement: mount.requirement ?? { kind: "required" as const },
    })),
  }));
  for (const tree of trees) {
    requireUnique(tree.mounts.map(({ id }) => id), `${family.id}/${tree.surface} mount id`);
    for (const item of tree.mounts) {
      requireWireId(item.id, `${family.id}/${tree.surface} mount id`);
      requireWireId(item.region, `${family.id}/${tree.surface} region`);
      if (!instanceIds.has(item.instance)) {
        throw new Error(`${family.id}/${tree.surface} uses unknown component instance '${item.instance}'`);
      }
      if (!Number.isSafeInteger(item.priority) || item.priority < 0) {
        throw new Error(`${family.id}/${tree.surface}/${item.id} has invalid priority`);
      }
      if (item.capacity !== null && (!Number.isSafeInteger(item.capacity) || item.capacity < 1)) {
        throw new Error(`${family.id}/${tree.surface}/${item.id} has invalid capacity`);
      }
    }
  }
  return frozen({ id: family.id, trees });
}

export function defineScreenComponentFamilyRegistry<
  const Instances extends readonly ProductComponentInstance[],
  ScreenRef extends string,
>(
  instances: Instances,
  entries: readonly {
    readonly screen: ScreenRef;
    readonly family: SurfaceFamilyDeclaration<Instances[number]["id"]>;
  }[],
): readonly ScreenComponentFamilyRef<ScreenRef, SurfaceFamily<Instances[number]["id"]>>[] {
  requireUnique(entries.map(({ screen }) => screen), "component-family screen");
  requireUnique(entries.map(({ family }) => family.id), "component-family ref");
  const registry = entries.map(({ screen, family }) => ({ screen, family: defineSurfaceFamily(instances, family) }));
  const mounted = new Set(registry.flatMap(({ family }) =>
    family.trees.flatMap(({ mounts }) => mounts.map(({ instance }) => instance))));
  const orphan = instances.map(({ id }) => id).filter((id) => !mounted.has(id));
  if (orphan.length > 0) throw new Error(`component registry has orphan instance '${orphan.join("', '")}'`);
  return frozen(registry);
}
