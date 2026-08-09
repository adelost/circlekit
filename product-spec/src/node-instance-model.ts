import type { ComponentPort, ComponentType, ProductComponentInstance } from "./component-tree-model.js";
import type { LegoPortPurpose, ProductNodeType } from "./node-model.js";

export const PRODUCT_LIFECYCLE_DEMAND_SOURCES = ["app-active", "session-active"] as const;
export type ProductLifecycleDemandSource = (typeof PRODUCT_LIFECYCLE_DEMAND_SOURCES)[number];

export interface ProductLeasedNodeActivation<PortId extends string = string> {
  readonly kind: "leased";
  readonly port: PortId;
  readonly lifecycleSources: readonly ProductLifecycleDemandSource[];
}

export interface ProductLifetimeNodeActivation {
  readonly kind: "lifetime";
  readonly lifecycleSources: readonly ProductLifecycleDemandSource[];
}

export type ProductNodeActivation<PortId extends string = string> =
  | ProductLeasedNodeActivation<PortId>
  | ProductLifetimeNodeActivation;

export interface ProductNodeInstance<Id extends string = string, TypeRef extends string = string> {
  readonly id: Id;
  readonly nodeTypeRef: TypeRef;
  readonly config: Readonly<Record<string, string>>;
  readonly bindings: Readonly<Record<string, string>>;
  /** Only effect-owning service nodes have independent activation. */
  readonly activation?: ProductNodeActivation;
}

type TypeById<Types extends readonly { readonly id: string }[], Id extends string> =
  Extract<Types[number], { readonly id: Id }>;

type NodeOutputRefForInstance<
  NodeTypes extends readonly ProductNodeType[],
  Instance,
  ContractId extends string,
  Purpose extends LegoPortPurpose,
> = Instance extends { readonly id: infer Id extends string; readonly nodeTypeRef: infer TypeRef extends string }
  ? TypeById<NodeTypes, TypeRef>["outputs"][number] extends infer Port
    ? Port extends {
      readonly id: infer PortId extends string;
      readonly contract: { readonly id: ContractId };
      readonly purpose: Purpose;
    }
      ? `${Id}.${PortId}`
      : never
    : never
  : never;

type ComponentOutputRefForInstance<
  ComponentTypes extends readonly ComponentType[],
  Instance,
  ContractId extends string,
> = Instance extends { readonly id: infer Id extends string; readonly componentTypeRef: infer TypeRef extends string }
  ? TypeById<ComponentTypes, TypeRef>["outputs"][number] extends infer Port
    ? Port extends { readonly id: infer PortId extends string; readonly contract: { readonly id: ContractId } }
      ? `${Id}.${PortId}`
      : never
    : never
  : never;

export type ProductOutputPortRef<
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
  ContractId extends string,
  Purpose extends LegoPortPurpose = LegoPortPurpose,
> =
  (Nodes[number] extends infer Instance
    ? NodeOutputRefForInstance<NodeTypes, Instance, ContractId, Purpose>
    : never)
  | (Purpose extends "data"
    ? Components[number] extends infer Instance
      ? ComponentOutputRefForInstance<ComponentTypes, Instance, ContractId>
      : never
    : never);

type NodeInputRefForInstance<
  NodeTypes extends readonly ProductNodeType[],
  Instance,
  ContractId extends string,
> = Instance extends { readonly id: infer Id extends string; readonly nodeTypeRef: infer TypeRef extends string }
  ? TypeById<NodeTypes, TypeRef>["inputs"][number] extends infer Port
    ? Port extends { readonly id: infer PortId extends string; readonly contract: { readonly id: ContractId } }
      ? `${Id}.${PortId}`
      : never
    : never
  : never;

export type ProductInputPortRef<
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ContractId extends string,
> = Nodes[number] extends infer Instance
  ? NodeInputRefForInstance<NodeTypes, Instance, ContractId>
  : never;

type EmptyBindings = Readonly<Record<string, never>>;
type NodeBindingMap<
  Ports,
  Optional extends boolean,
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = {
  readonly [Port in Ports as Port extends {
    readonly id: infer Id extends string;
    readonly purpose: infer Purpose extends LegoPortPurpose;
  } ? Optional extends true
    ? Purpose extends "context" | "demand" ? Id : never
    : Purpose extends "data" ? Id : never
  : never]: Port extends {
    readonly contract: { readonly id: infer ContractId extends string };
    readonly purpose: infer Purpose extends LegoPortPurpose;
  }
    ? ProductOutputPortRef<NodeTypes, Nodes, ComponentTypes, Components, ContractId, Purpose>
    : never;
};

type NodeBindings<
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
  Instance,
> = Instance extends { readonly nodeTypeRef: infer TypeRef extends string }
  ? TypeById<NodeTypes, TypeRef>["inputs"][number] extends infer Ports
    ? [Ports] extends [never]
      ? EmptyBindings
      : NodeBindingMap<Ports, false, NodeTypes, Nodes, ComponentTypes, Components>
        & Partial<NodeBindingMap<Ports, true, NodeTypes, Nodes, ComponentTypes, Components>>
    : never
  : never;

type NodeDemandPortId<
  NodeTypes extends readonly ProductNodeType[],
  Instance,
> = Instance extends { readonly nodeTypeRef: infer TypeRef extends string }
  ? Extract<TypeById<NodeTypes, TypeRef>["inputs"][number], { readonly purpose: "demand" }> extends infer Port
    ? Port extends { readonly id: infer Id extends string } ? Id : never
    : never
  : never;

type NodeActivation<
  NodeTypes extends readonly ProductNodeType[],
  Instance,
> = Instance extends { readonly nodeTypeRef: infer TypeRef extends string }
  ? TypeById<NodeTypes, TypeRef>["kind"] extends "service"
    ? [NodeDemandPortId<NodeTypes, Instance>] extends [never]
      ? { readonly activation: ProductLifetimeNodeActivation }
      : { readonly activation: ProductLeasedNodeActivation<NodeDemandPortId<NodeTypes, Instance>> }
    : { readonly activation?: never }
  : never;

type ComponentBindingMap<
  Ports,
  Required extends boolean,
  RefKind extends "input" | "event",
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = {
  readonly [Port in Ports as Port extends ComponentPort<infer Id>
    ? Port["required"] extends Required ? Id : never
    : never]: Port extends ComponentPort<string, infer Contract>
      ? RefKind extends "input"
        ? ProductOutputPortRef<NodeTypes, Nodes, ComponentTypes, Components, Contract["id"]>
        : ProductInputPortRef<NodeTypes, Nodes, Contract["id"]>
      : never;
};

type ComponentBindings<
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
  Instance,
> = Instance extends { readonly componentTypeRef: infer TypeRef extends string }
  ? TypeById<ComponentTypes, TypeRef> extends infer Type extends ComponentType
    ? {
      readonly inputs: ComponentBindingMap<Type["inputs"][number], true, "input", NodeTypes, Nodes, ComponentTypes, Components>
        & Partial<ComponentBindingMap<Type["inputs"][number], false, "input", NodeTypes, Nodes, ComponentTypes, Components>>;
      readonly events: ComponentBindingMap<Type["outputs"][number], true, "event", NodeTypes, Nodes, ComponentTypes, Components>
        & Partial<ComponentBindingMap<Type["outputs"][number], false, "event", NodeTypes, Nodes, ComponentTypes, Components>>;
    }
    : never
  : never;

export type ExactNodeInstances<
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = { readonly [Index in keyof Nodes]: Nodes[Index] extends ProductNodeInstance<infer Id, infer TypeRef>
  ? Omit<ProductNodeInstance<Id, TypeRef>, "bindings" | "activation"> & {
    readonly nodeTypeRef: TypeRef & NodeTypes[number]["id"];
    readonly bindings: NodeBindings<NodeTypes, Nodes, ComponentTypes, Components, Nodes[Index]>;
  } & NodeActivation<NodeTypes, Nodes[Index]>
  : never };

export type ExactComponentInstances<
  NodeTypes extends readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = { readonly [Index in keyof Components]: Components[Index] extends ProductComponentInstance<infer Id, infer TypeRef>
  ? ProductComponentInstance<Id, TypeRef> & {
    readonly componentTypeRef: TypeRef & ComponentTypes[number]["id"];
    readonly bindings: ComponentBindings<NodeTypes, Nodes, ComponentTypes, Components, Components[Index]>;
  }
  : never };
