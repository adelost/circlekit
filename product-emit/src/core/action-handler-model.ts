import type { LegoContract, PortBindingIr, PortRegistryEntry, ProductIr } from "@v1d/product-spec";
import { contractTypeName } from "./emit-state-presentations-kotlin.js";
import { kotlinIdentifier } from "./kotlin-syntax.js";

/** The Kotlin an action port carries: the value its handler takes and the result it hands back. */
export interface ActionKotlinType {
  readonly value: string;
  readonly result: string;
}

/** One declared action: its handler method, the input it binds, the output feeding that input, and its type. */
export interface ActionMember {
  readonly method: string;
  readonly inputRef: string;
  readonly sourceRef: string;
  readonly type: ActionKotlinType;
}

/**
 * One handler interface. `node`: the action inputs of one node, methods named by input. `source`: what one owner
 * sends into a node the product names in `sinks`, methods named by that owner's output.
 */
export interface ActionGroup {
  readonly kind: "node" | "source";
  readonly ownerId: string;
  readonly typeName: string;
  readonly members: readonly ActionMember[];
}

/** One bound output of a component instance: the input it feeds and the group whose method handles it. */
export interface ComponentEventMember {
  readonly method: string;
  readonly outputRef: string;
  readonly inputRef: string;
  readonly groupTypeName: string;
  readonly type: ActionKotlinType;
}

/** What one component instance can emit: one method per bound output. */
export interface ComponentEventsModel {
  readonly componentId: string;
  readonly typeName: string;
  readonly members: readonly ComponentEventMember[];
}

export interface ActionModel {
  readonly groups: readonly ActionGroup[];
  readonly components: readonly ComponentEventsModel[];
}

export interface ActionModelOptions {
  readonly symbolPrefix: string;
  /** Kotlin type by port ref. It wins over derivation; an entry that types no action port is refused. */
  readonly types?: Readonly<Record<string, ActionKotlinType>>;
  /** Event inputs fed by a node output (a relay) that native code handles like a component event. */
  readonly forwardedInputs?: readonly string[];
  /** Nodes whose action inputs are grouped by the owner that feeds them, instead of by the node. */
  readonly sinks?: readonly string[];
}

/** Kotlin's hard keywords: a method or parameter named by one does not compile unquoted. */
export const KOTLIN_HARD_KEYWORDS: ReadonlySet<string> = new Set(["as", "break", "class", "continue", "do", "else",
  "false", "for", "fun", "if", "in", "interface", "is", "null", "object", "package", "return", "super", "this", "throw",
  "true", "try", "typealias", "typeof", "val", "var", "when", "while"]);

/**
 * The type the declaration alone gives an event contract. No fields: Unit. Fields that are all primitive and none
 * optional (nullable is fine): the data class `emitContractTypesKotlin` writes for it, under `contractTypeName`, so
 * one contract never gets two Kotlin names. Anything else: no type, so the product names one. The result is Unit.
 */
export function derivedPayloadType(contract: LegoContract): ActionKotlinType | undefined {
  if (contract.kind !== "event") return undefined;
  if (contract.fields.length === 0) return { value: "Unit", result: "Unit" };
  const primitive = contract.fields.every((field) => typeof field.value === "string" && field.optional !== true);
  return primitive ? { value: contractTypeName(contract), result: "Unit" } : undefined;
}

/** `Generated<P><Component>Events` to its implementation for one transport: `...PortEvents` or `...DirectEvents`. */
export function eventsImplementationName(component: Pick<ComponentEventsModel, "typeName">, transport: "Port" | "Direct"): string {
  return `${component.typeName.slice(0, -"Events".length)}${transport}Events`;
}

/**
 * Every action of a compiled product: each node input fed by a component event, plus the relayed inputs the product
 * names in `forwardedInputs`, grouped into one handler interface per node (per feeding owner for a sink), and one
 * events facade per component instance. Every refusal is collected, sorted and thrown once. Order carries no meaning:
 * groups, facades and their members are sorted by name so the output is stable.
 */
export function projectActionModel(ir: Pick<ProductIr, "portRegistry">, options: ActionModelOptions): ActionModel {
  const { contracts, nodePorts, componentPorts, bindings } = ir.portRegistry;
  const portByRef = new Map([...nodePorts, ...componentPorts].map((entry) => [entry.ref, entry] as const));
  const contractById = new Map(contracts.map((contract) => [contract.id, contract] as const));
  const port = (ref: string) => known(portByRef.get(ref), `port '${ref}'`);
  const contractOf = (entry: PortRegistryEntry) => known(contractById.get(entry.contractRef), `contract '${entry.contractRef}'`);
  const problems: string[] = [];
  const sinks = new Set(options.sinks ?? []);
  for (const sink of sinks) {
    if (!nodePorts.some((entry) => entry.ownerId === sink && entry.direction === "input")) {
      problems.push(`sink '${sink}' is not a compiled node with inputs`);
    }
  }
  const typedRefs = new Set<string>();
  const derivedPayloads = new Map<string, string>();
  const typeOf = (entry: PortRegistryEntry): ActionKotlinType | undefined => {
    typedRefs.add(entry.ref);
    const declared = options.types?.[entry.ref];
    const type = declared ?? derivedPayloadType(contractOf(entry));
    if (type === undefined) {
      problems.push(`action port '${entry.ref}' (contract '${entry.contractRef}') has no Kotlin type: pass it in types, or declare its fields primitive`);
    } else if (declared === undefined && type.value !== "Unit") {
      derivedPayloads.set(entry.contractRef, type.value);
    }
    return type;
  };
  const refuseKeyword = (method: string, ref: string) => {
    if (KOTLIN_HARD_KEYWORDS.has(method)) problems.push(`action method '${method}' is a Kotlin keyword; rename port '${ref}'`);
  };

  const groups = new Map<string, { kind: ActionGroup["kind"]; ownerId: string; typeName: string; members: ActionMember[] }>();
  const facades = new Map<string, { componentId: string; typeName: string; members: ComponentEventMember[] }>();
  for (const edge of actionEdges(bindings, options.forwardedInputs ?? [], port, contractOf, problems)) {
    const input = port(edge.to);
    const source = port(edge.from);
    const bySource = sinks.has(input.ownerId);
    const method = bySource ? source.portId : input.portId;
    refuseKeyword(method, bySource ? source.ref : input.ref);
    const inputType = typeOf(input);
    const sourceType = edge.kind === "component-event" ? typeOf(source) : inputType;
    if (inputType === undefined || sourceType === undefined) continue;
    if (inputType.value !== sourceType.value || inputType.result !== sourceType.result) {
      problems.push(`component event '${source.ref}' carries ${sourceType.value} -> ${sourceType.result} but its input '${input.ref}' takes ${inputType.value} -> ${inputType.result}; give both one type`);
      continue;
    }
    const kind = bySource ? "source" : "node";
    const ownerId = bySource ? source.ownerId : input.ownerId;
    const typeName = `Generated${options.symbolPrefix}${kotlinIdentifier(ownerId)}${kind === "node" ? "Inputs" : "Actions"}`;
    const group = groups.get(`${kind} ${ownerId}`) ?? { kind, ownerId, typeName, members: [] };
    groups.set(`${kind} ${ownerId}`, group);
    group.members.push({ method, inputRef: input.ref, sourceRef: source.ref, type: inputType });
    if (edge.kind !== "component-event") continue;
    refuseKeyword(source.portId, source.ref);
    const facade = facades.get(source.ownerId)
      ?? { componentId: source.ownerId, typeName: `Generated${options.symbolPrefix}${kotlinIdentifier(source.ownerId)}Events`, members: [] };
    facades.set(source.ownerId, facade);
    facade.members.push({ method: source.portId, outputRef: source.ref, inputRef: input.ref, groupTypeName: typeName, type: sourceType });
  }
  for (const ref of Object.keys(options.types ?? {})) {
    if (!typedRefs.has(ref)) problems.push(`types names '${ref}', which no action binds; delete it`);
  }
  refuseDuplicateNames([
    ...[...groups.values()].map(({ typeName, kind, ownerId }) =>
      [typeName, `${kind === "node" ? "event inputs" : "actions"} of '${ownerId}'`] as const),
    ...[...facades.values()].flatMap((facade) => [
      [facade.typeName, `events of '${facade.componentId}'`] as const,
      [eventsImplementationName(facade, "Port"), `port events of '${facade.componentId}'`] as const,
      [eventsImplementationName(facade, "Direct"), `direct events of '${facade.componentId}'`] as const,
    ]),
    [`Generated${options.symbolPrefix}ActionIndex`, "the action index"] as const,
    ...[...derivedPayloads].map(([contractId, typeName]) => [typeName, `the payload of contract '${contractId}'`] as const),
  ], problems);
  if (problems.length > 0) {
    const sorted = [...new Set(problems)].sort();
    throw new Error(`action handlers refused (${sorted.length}):\n  ${sorted.join("\n  ")}`);
  }
  return {
    groups: [...groups.values()].sort(byTypeName).map((group) => ({ ...group, members: group.members.sort(byMethod) })),
    components: [...facades.values()].sort(byTypeName).map((facade) => ({ ...facade, members: facade.members.sort(byMethod) })),
  };
}

/** Every component-event binding, plus the binding feeding each named relay input once it is proven a node-fed event. */
function actionEdges(
  bindings: readonly PortBindingIr[],
  forwardedInputs: readonly string[],
  port: (ref: string) => PortRegistryEntry,
  contractOf: (entry: PortRegistryEntry) => LegoContract,
  problems: string[],
): readonly PortBindingIr[] {
  const forwarded = [...new Set(forwardedInputs)].flatMap((ref) => {
    const edge = bindings.find((binding) => binding.to === ref);
    if (edge?.kind === "node-input" && contractOf(port(ref)).kind === "event") return [edge];
    problems.push(`forwarded input '${ref}' is not an event input fed by a node output`);
    return [];
  });
  return [...bindings.filter((binding) => binding.kind === "component-event"), ...forwarded];
}

function refuseDuplicateNames(declared: readonly (readonly [string, string])[], problems: string[]): void {
  const byName = new Map<string, string[]>();
  for (const [name, declaredBy] of declared) byName.set(name, [...(byName.get(name) ?? []), declaredBy]);
  for (const [name, declarers] of byName) {
    if (declarers.length > 1) problems.push(`two action types are named '${name}': ${declarers.sort().join(", ")}`);
  }
}

function known<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`action model: the port registry names no ${what}`);
  return value;
}

const byTypeName = (left: { readonly typeName: string }, right: { readonly typeName: string }) =>
  compare(left.typeName, right.typeName);
const byMethod = (left: { readonly method: string }, right: { readonly method: string }) => compare(left.method, right.method);
const compare = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
