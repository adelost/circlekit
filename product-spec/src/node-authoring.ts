import type { ProductNodeActivation } from "./node-instance-model.js";
import type { ComponentType } from "./component-tree-model.js";
import type { LegoConfigRef, LegoPort, ProductNodeType } from "./node-model.js";

/** A typed authoring reference. Only its wire id reaches ProductIr. */
export interface NodeOutputRef<Ref extends string, Contract extends string, Purpose extends string> {
  readonly ref: Ref;
  readonly contract: Contract;
  readonly purpose: Purpose;
}

type OutputOf<Type extends ProductNodeType, Id extends string, Port extends Type["outputs"][number]["id"]> =
  Extract<Type["outputs"][number], { readonly id: Port }> extends infer Output extends LegoPort
    ? NodeOutputRef<`${Id}.${Port}`, Output["contract"]["id"], Output["purpose"]>
    : never;

type OutputRefs<Type extends ProductNodeType, Id extends string> = {
  readonly [Port in Type["outputs"][number] as Port["id"]]:
    NodeOutputRef<`${Id}.${Port["id"]}`, Port["contract"]["id"], Port["purpose"]>;
};

/** Use an existing producer without copying its output contract into the consumer. */
export function nodeOutput<
  const Type extends ProductNodeType,
  const Id extends string,
  const Port extends Type["outputs"][number]["id"],
>(producer: { readonly id: Id; readonly type: Type }, portId: Port): OutputOf<Type, Id, Port> {
  const output = producer.type.outputs.find((candidate) => candidate.id === portId);
  if (output === undefined) throw new Error(`node '${producer.id}' has no output '${portId}'`);
  return {
    ref: `${producer.id}.${portId}`,
    contract: output.contract.id,
    purpose: output.purpose,
  } as OutputOf<Type, Id, Port>;
}

/** Component events can feed node inputs without becoming an untyped string. */
export function componentOutput<
  const Type extends ComponentType,
  const Id extends string,
  const Port extends Type["outputs"][number]["id"],
>(producer: { readonly id: Id; readonly type: Type }, portId: Port):
  NodeOutputRef<`${Id}.${Port}`, Extract<Type["outputs"][number], { readonly id: Port }>["contract"]["id"], "data"> {
  const output = producer.type.outputs.find((candidate) => candidate.id === portId);
  if (output === undefined) throw new Error(`component '${producer.id}' has no output '${portId}'`);
  return { ref: `${producer.id}.${portId}`, contract: output.contract.id, purpose: "data" } as
    NodeOutputRef<`${Id}.${Port}`, Extract<Type["outputs"][number], { readonly id: Port }>["contract"]["id"], "data">;
}

type DataInput<Type extends ProductNodeType> = Extract<Type["inputs"][number], { readonly purpose: "data" }>;
type InputAt<Type extends ProductNodeType, Key extends string> =
  Extract<Type["inputs"][number], { readonly id: Key }>;
type ContractOf<Source> = Source extends NodeOutputRef<string, infer Contract, string> ? Contract : "<invalid>";
type BindingError<Id extends string, Port extends string, Expected extends string, Actual extends string> =
  `node ${Id} port ${Port}: expected ${Expected}, actual ${Actual}`;
type CheckedSources<Id extends string, Type extends ProductNodeType, From> = {
  readonly [Key in keyof From]: Key extends string
    ? [InputAt<Type, Key>] extends [never]
      ? BindingError<Id, Key, "<undeclared>", ContractOf<From[Key]>>
      : InputAt<Type, Key> extends infer Input extends LegoPort
        ? From[Key] extends NodeOutputRef<string, Input["contract"]["id"], Input["purpose"]>
          ? From[Key]
          : BindingError<Id, Key, Input["contract"]["id"], ContractOf<From[Key]>>
        : never
    : never;
} & {
  readonly [Input in DataInput<Type> as Input["id"]]: Input["id"] extends keyof From
    ? unknown
    : BindingError<Id, Input["id"], Input["contract"]["id"], "<missing>">;
};
type NodeConfigs<Type extends ProductNodeType> = {
  readonly [Input in NonNullable<Type["configInputs"]>[number] as Input["id"]]: LegoConfigRef;
};
type SourceIds<From> = { readonly [Key in keyof From]: From[Key] extends NodeOutputRef<infer Ref, string, string> ? Ref : never };
type ConfigIds<Configs> = { readonly [Key in keyof Configs]: Configs[Key] extends { readonly id: infer Id extends string } ? Id : never };
type AuthoredNode<Id extends string, Type extends ProductNodeType, From, Configs, Runs> = {
  readonly id: Id;
  readonly type: Type;
  readonly out: OutputRefs<Type, Id>;
  readonly node: {
    readonly id: Id;
    readonly nodeTypeRef: Type["id"];
    readonly bindings: SourceIds<From>;
    readonly config: ConfigIds<Configs>;
  } & (Type["kind"] extends "service" ? { readonly activation: Runs } : {});
};

/** Type and instance share one block; the compiler still receives its existing IR. */
export function authorNode<
  const Id extends string,
  const Type extends ProductNodeType,
  const From extends Readonly<Record<string, NodeOutputRef<string, string, string>>>,
  const Configs extends NodeConfigs<Type>,
  const Runs extends ProductNodeActivation = ProductNodeActivation,
>(id: Id, spec: {
  readonly type: Type;
  readonly from: From & CheckedSources<Id, Type, From>;
  readonly config: Configs;
} & (Type["kind"] extends "service" ? { readonly runs: Runs } : { readonly runs?: never })):
  AuthoredNode<Id, Type, From, Configs, Runs> {
  const bindings = Object.fromEntries(Object.entries(spec.from as Record<string, NodeOutputRef<string, string, string>>).map(([key, value]) =>
    [key, value?.ref]));
  const config = Object.fromEntries(Object.entries(spec.config as Record<string, LegoConfigRef>).map(([key, value]) =>
    [key, value.id]));
  const node = {
    id, nodeTypeRef: spec.type.id, config, bindings,
    ...(spec.runs === undefined ? {} : { activation: spec.runs }),
  };
  const out = Object.fromEntries(spec.type.outputs.map((port) => [port.id, {
    ref: `${id}.${port.id}`, contract: port.contract.id, purpose: port.purpose,
  }]));
  return { id, type: spec.type, out, node } as unknown as AuthoredNode<Id, Type, From, Configs, Runs>;
}
