import type { ComponentPort, ComponentType, ProductComponentInstance } from "./component-tree-model.js";
import type { LegoPortPurpose, LegoSpec } from "./native-lego-model.js";

export const PRODUCT_LIFECYCLE_DEMAND_SOURCES = ["app-active", "session-active"] as const;
export type ProductLifecycleDemandSource = (typeof PRODUCT_LIFECYCLE_DEMAND_SOURCES)[number];

export interface ProductLeasedServiceActivation<PortId extends string = string> {
  readonly kind: "leased";
  readonly port: PortId;
  readonly lifecycleSources: readonly ProductLifecycleDemandSource[];
}

export interface ProductLifetimeServiceActivation {
  readonly kind: "lifetime";
  readonly lifecycleSources: readonly ProductLifecycleDemandSource[];
}

export type ProductServiceActivation<PortId extends string = string> =
  | ProductLeasedServiceActivation<PortId>
  | ProductLifetimeServiceActivation;

export interface ProductServiceInstance<Id extends string = string, TypeRef extends string = string> {
  readonly id: Id;
  readonly serviceTypeRef: TypeRef;
  readonly config: Readonly<Record<string, string>>;
  readonly bindings: Readonly<Record<string, string>>;
  readonly activation: ProductServiceActivation;
}

type TypeById<Types extends readonly { readonly id: string }[], Id extends string> =
  Extract<Types[number], { readonly id: Id }>;

type ServiceOutputRefForInstance<
  ServiceTypes extends readonly LegoSpec[],
  Instance,
  ContractId extends string,
  Purpose extends LegoPortPurpose,
> = Instance extends { readonly id: infer Id extends string; readonly serviceTypeRef: infer TypeRef extends string }
  ? TypeById<ServiceTypes, TypeRef>["outputs"][number] extends infer Port
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
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
  ContractId extends string,
  Purpose extends LegoPortPurpose = LegoPortPurpose,
> =
  (Services[number] extends infer Instance
    ? ServiceOutputRefForInstance<ServiceTypes, Instance, ContractId, Purpose>
    : never)
  | (Purpose extends "data"
    ? Components[number] extends infer Instance
      ? ComponentOutputRefForInstance<ComponentTypes, Instance, ContractId>
      : never
    : never);

type ServiceInputRefForInstance<
  ServiceTypes extends readonly LegoSpec[],
  Instance,
  ContractId extends string,
> = Instance extends { readonly id: infer Id extends string; readonly serviceTypeRef: infer TypeRef extends string }
  ? TypeById<ServiceTypes, TypeRef>["inputs"][number] extends infer Port
    ? Port extends { readonly id: infer PortId extends string; readonly contract: { readonly id: ContractId } }
      ? `${Id}.${PortId}`
      : never
    : never
  : never;

export type ProductInputPortRef<
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ContractId extends string,
> = Services[number] extends infer Instance
  ? ServiceInputRefForInstance<ServiceTypes, Instance, ContractId>
  : never;

type EmptyBindings = Readonly<Record<string, never>>;
type ServiceBindingMap<
  Ports,
  Optional extends boolean,
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
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
    ? ProductOutputPortRef<ServiceTypes, Services, ComponentTypes, Components, ContractId, Purpose>
    : never;
};

type ServiceBindings<
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
  Instance,
> = Instance extends { readonly serviceTypeRef: infer TypeRef extends string }
  ? TypeById<ServiceTypes, TypeRef>["inputs"][number] extends infer Ports
    ? [Ports] extends [never]
      ? EmptyBindings
      : ServiceBindingMap<Ports, false, ServiceTypes, Services, ComponentTypes, Components>
        & Partial<ServiceBindingMap<Ports, true, ServiceTypes, Services, ComponentTypes, Components>>
    : never
  : never;

type ServiceDemandPortId<
  ServiceTypes extends readonly LegoSpec[],
  Instance,
> = Instance extends { readonly serviceTypeRef: infer TypeRef extends string }
  ? Extract<TypeById<ServiceTypes, TypeRef>["inputs"][number], { readonly purpose: "demand" }> extends infer Port
    ? Port extends { readonly id: infer Id extends string } ? Id : never
    : never
  : never;

type ServiceActivation<
  ServiceTypes extends readonly LegoSpec[],
  Instance,
> = [ServiceDemandPortId<ServiceTypes, Instance>] extends [never]
  ? ProductLifetimeServiceActivation
  : ProductLeasedServiceActivation<ServiceDemandPortId<ServiceTypes, Instance>>;

type ComponentBindingMap<
  Ports,
  Required extends boolean,
  RefKind extends "input" | "event",
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = {
  readonly [Port in Ports as Port extends ComponentPort<infer Id>
    ? Port["required"] extends Required ? Id : never
    : never]: Port extends ComponentPort<string, infer Contract>
      ? RefKind extends "input"
        ? ProductOutputPortRef<ServiceTypes, Services, ComponentTypes, Components, Contract["id"]>
        : ProductInputPortRef<ServiceTypes, Services, Contract["id"]>
      : never;
};

type ComponentBindings<
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
  Instance,
> = Instance extends { readonly componentTypeRef: infer TypeRef extends string }
  ? TypeById<ComponentTypes, TypeRef> extends infer Type extends ComponentType
    ? {
      readonly inputs: ComponentBindingMap<Type["inputs"][number], true, "input", ServiceTypes, Services, ComponentTypes, Components>
        & Partial<ComponentBindingMap<Type["inputs"][number], false, "input", ServiceTypes, Services, ComponentTypes, Components>>;
      readonly events: ComponentBindingMap<Type["outputs"][number], true, "event", ServiceTypes, Services, ComponentTypes, Components>
        & Partial<ComponentBindingMap<Type["outputs"][number], false, "event", ServiceTypes, Services, ComponentTypes, Components>>;
    }
    : never
  : never;

export type ExactServiceInstances<
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = { readonly [Index in keyof Services]: Services[Index] extends ProductServiceInstance<infer Id, infer TypeRef>
  ? Omit<ProductServiceInstance<Id, TypeRef>, "bindings" | "activation"> & {
    readonly serviceTypeRef: TypeRef & ServiceTypes[number]["id"];
    readonly bindings: ServiceBindings<ServiceTypes, Services, ComponentTypes, Components, Services[Index]>;
    readonly activation: ServiceActivation<ServiceTypes, Services[Index]>;
  }
  : never };

export type ExactComponentInstances<
  ServiceTypes extends readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[],
  Components extends readonly ProductComponentInstance[],
> = { readonly [Index in keyof Components]: Components[Index] extends ProductComponentInstance<infer Id, infer TypeRef>
  ? ProductComponentInstance<Id, TypeRef> & {
    readonly componentTypeRef: TypeRef & ComponentTypes[number]["id"];
    readonly bindings: ComponentBindings<ServiceTypes, Services, ComponentTypes, Components, Components[Index]>;
  }
  : never };
