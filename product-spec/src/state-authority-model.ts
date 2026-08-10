import type { ProductNodeInstance } from "./node-instance-model.js";
import {
  contractFingerprint,
  field,
  finiteValueRef,
  port,
  present,
  requireIdentifier,
  requireUnique,
  requireWireId,
  type LegoContract,
  type LegoFiniteValueDeclaration,
  type LegoFiniteValueRef,
  type LegoPrimitive,
  type ProductNodeType,
} from "./node-model.js";
import type { CompiledProductGraph, PortBindingIr } from "./port-graph-model.js";
export type StatePresentationFieldValue = LegoPrimitive | LegoFiniteValueDeclaration;
export interface StatePresentationField<Name extends string = string,
  Value extends StatePresentationFieldValue = StatePresentationFieldValue> {
  readonly name: Name;
  readonly value: Value;
}
export function statePresentationField<const Name extends string, const Value extends StatePresentationFieldValue>(
  name: Name, value: Value,
): StatePresentationField<Name, Value> {
  requireIdentifier(name, "state presentation field");
  return { name, value };
}
type PresentationValue<Value extends StatePresentationFieldValue> =
  Value extends LegoFiniteValueDeclaration ? Value["values"][number]
    : Value extends "boolean" ? boolean
      : Value extends "integer" | "number" ? number
        : string;
type PresentationPayload<Fields extends readonly StatePresentationField[]> = {
  readonly [Field in Fields[number] as Field["name"]]: PresentationValue<Field["value"]>;
};
type StateCases<
  States extends LegoFiniteValueDeclaration,
  Fields extends readonly StatePresentationField[],
> = { readonly [State in States["values"][number]]: PresentationPayload<Fields> };
type ExactPayload<Fields extends readonly StatePresentationField[], Payload> =
  Payload & Record<Exclude<keyof Payload, Fields[number]["name"]>, never>;

type ExactCases<
  States extends LegoFiniteValueDeclaration,
  Fields extends readonly StatePresentationField[],
  Cases extends StateCases<States, Fields>,
> = {
  readonly [State in keyof Cases]: ExactPayload<Fields, Cases[State]>;
} & Record<Exclude<keyof Cases, States["values"][number]>, never>;

export interface StatePresentation<
  Id extends string = string,
  StateRef extends string = string,
  Fields extends readonly StatePresentationField[] = readonly StatePresentationField[],
> {
  readonly id: Id;
  readonly stateRef: StateRef;
  readonly fields: Fields;
  /** Keys are canonical state ids; values conform to one required payload schema. */
  readonly cases: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Closed adapter output contract generated from [fields]. */
  readonly contract: LegoContract & { readonly id: `${Id}.payload` };
}

export interface CompiledStatePresentation extends StatePresentation {
  /** Complete graph-derived present input set; never authored by a product. */
  readonly consumers: readonly string[];
}

/** Exact exhaustive product data for a canonical finite state space. */
export function defineStatePresentation<
  const States extends LegoFiniteValueDeclaration,
  const Id extends string,
  const Fields extends readonly StatePresentationField[],
  const Cases extends StateCases<States, Fields>,
>(
  states: States,
  declaration: {
    readonly id: Id;
    readonly fields: Fields;
    readonly cases: ExactCases<States, Fields, Cases>;
  },
): StatePresentation<Id, States["id"], Fields> {
  requireWireId(declaration.id, "state presentation");
  requireUnique(declaration.fields.map(({ name }) => name), `field in state presentation '${declaration.id}'`);
  if (declaration.fields.length === 0) throw new Error(`state presentation '${declaration.id}' has no payload fields`);
  const contract = {
    id: `${declaration.id}.payload` as `${Id}.payload`,
    kind: "snapshot",
    boundary: "presentation",
    fields: declaration.fields.map((item) => field(
      item.name,
      typeof item.value === "string" ? item.value : finiteValueRef(item.value.id),
    )),
  } as const;
  const result: StatePresentation<Id, States["id"], Fields> = {
    id: declaration.id,
    stateRef: states.id,
    fields: declaration.fields,
    cases: declaration.cases,
    contract,
  };
  validateStatePresentation(result, states);
  return result;
}

export interface StateAuthority {
  readonly id: string;
  readonly source: {
    readonly portRef: string;
    readonly contract: LegoContract;
    readonly stateField: string;
    readonly states: LegoFiniteValueDeclaration;
  };
  readonly presentation: StatePresentation;
  readonly adapter: {
    readonly nodeTypeRef: string;
    readonly nodeInstanceRef: string;
    readonly inputPortRef: string;
    readonly outputPortRef: string;
  };
}

export interface CompiledStateAuthority extends Omit<StateAuthority, "presentation"> {
  readonly presentation: CompiledStatePresentation;
}

type ContractFieldName<Contract extends LegoContract> = Contract["fields"][number]["name"];

/**
 * Defines both the authority declaration and its executable final presentation.
 * Products add adapter.type/node to the mandatory graph and bind its presentation
 * output directly into components; handwritten present nodes cannot intercept it.
 */
export function defineStateAuthority<
  const Id extends string,
  const SourcePortRef extends string,
  const Contract extends LegoContract,
  const States extends LegoFiniteValueDeclaration,
  const Presentation extends StatePresentation<string, States["id"]>,
>(declaration: {
  readonly id: Id;
  readonly source: {
    readonly portRef: SourcePortRef;
    readonly contract: Contract;
    readonly stateField: ContractFieldName<Contract>;
    readonly states: States;
  };
  readonly presentation: Presentation;
}) {
  requireWireId(declaration.id, "state authority");
  const nodeId = `${declaration.id}.presentation-adapter` as `${Id}.presentation-adapter`;
  const stateInput = port<"state", Contract>("state", declaration.source.contract);
  const presentationOutput = port<"presentation", Presentation["contract"]>(
    "presentation",
    declaration.presentation.contract,
  );
  const type = present({
    id: nodeId,
    inputs: [stateInput],
    outputs: [presentationOutput],
    runtime: {
      stateOwner: "none", lifetime: "call", durability: "transient",
      clockDomain: "none", contextInputs: [], effects: [],
    },
  });
  const node = {
    id: nodeId,
    nodeTypeRef: type.id,
    config: {},
    bindings: { state: declaration.source.portRef },
  } as const;
  return {
    authority: {
      ...declaration,
      adapter: {
        nodeTypeRef: type.id,
        nodeInstanceRef: node.id,
        inputPortRef: `${node.id}.state`,
        outputPortRef: `${node.id}.presentation`,
      },
    },
    adapter: { type, node },
  } as const;
}

/** Compile all UI-reaching closed state lineages against the executable graph. */
export function compileStateAuthorities(
  declarations: readonly StateAuthority[],
  finiteValues: readonly LegoFiniteValueDeclaration[],
  graph: CompiledProductGraph,
): readonly CompiledStateAuthority[] {
  requireUnique(declarations.map(({ id }) => id), "state authority");
  requireUnique(declarations.map(axisKey), "state authority axis");
  requireUnique(declarations.map(({ presentation }) => presentation.id), "state presentation");
  requireUnique(declarations.map(({ adapter }) => adapter.nodeInstanceRef), "state presentation adapter");

  const finiteById = new Map(finiteValues.map((item) => [item.id, item]));
  const contractById = new Map(graph.portRegistry.contracts.map((item) => [item.id, item]));
  const nodeTypeById = new Map(graph.nodeTypes.map((item) => [item.id, item]));
  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));
  const portByRef = new Map(graph.portRegistry.nodePorts.map((item) => [item.ref, item]));
  const dataBindings = graph.portRegistry.bindings.filter(({ purpose }) => purpose === "data");
  const nodeBindings = dataBindings.filter(({ kind }) => kind === "node-input");
  const componentBindings = dataBindings.filter(({ kind }) => kind === "component-input");
  const upstreamByNode = groupOwners(nodeBindings);
  const outputsByNode = new Map<string, string[]>();
  for (const portEntry of graph.portRegistry.nodePorts.filter(({ direction }) => direction === "output")) {
    const refs = outputsByNode.get(portEntry.ownerId) ?? [];
    refs.push(portEntry.ref);
    outputsByNode.set(portEntry.ownerId, refs);
  }
  const targetsByOutput = new Map<string, Set<string>>();
  for (const binding of nodeBindings) {
    const targets = targetsByOutput.get(binding.from) ?? new Set<string>();
    targets.add(ownerOf(binding.to));
    targetsByOutput.set(binding.from, targets);
  }
  const presentIds = new Set(graph.nodes.filter((node) =>
    nodeTypeById.get(node.nodeTypeRef)?.kind === "present").map(({ id }) => id));
  const serviceIds = new Set(graph.nodes.filter((node) =>
    nodeTypeById.get(node.nodeTypeRef)?.kind === "service").map(({ id }) => id));
  const adapterIds = new Set(declarations.map(({ adapter }) => adapter.nodeInstanceRef));
  const ordinaryPresentIds = new Set([...presentIds].filter((id) => !adapterIds.has(id)));
  const componentIds = new Set(graph.portRegistry.componentPorts.map(({ ownerId }) => ownerId));
  const authorityByAxis = new Map(declarations.map((item) => [axisKey(item), item]));
  const generatedAdapterOutputs = new Set(declarations.map(({ adapter }) => adapter.outputPortRef));
  const eligibleAxes: { readonly portRef: string; readonly field: string; readonly stateRef: string }[] = [];

  for (const output of graph.portRegistry.nodePorts.filter(({ direction }) => direction === "output")) {
    if (presentIds.has(output.ownerId) || generatedAdapterOutputs.has(output.ref) || !componentTargets(output.ref).size) continue;
    const contract = contractById.get(output.contractRef);
    if (contract?.boundary !== "presentation" || contract.kind === "event") continue;
    // PageId is already closed and interpreted by the navigation compiler. Its
    // declared page-host consumes identity, not a second label/tone presentation.
    if (contract.navigation?.kind === "active-page") continue;
    for (const contractField of contract.fields) {
      if (!isFiniteValueRef(contractField.value)) continue;
      eligibleAxes.push({ portRef: output.ref, field: contractField.name, stateRef: contractField.value.ref });
    }
  }
  for (const axis of eligibleAxes) {
    const key = axisKey({ source: { portRef: axis.portRef, stateField: axis.field } });
    if (!authorityByAxis.has(key)) {
      throw new Error(`UI-reaching closed state '${key}' has no state authority`);
    }
  }
  for (const authority of declarations) {
    if (!eligibleAxes.some((axis) => axisKey({ source: { portRef: axis.portRef, stateField: axis.field } }) === axisKey(authority))) {
      throw new Error(`state authority '${authority.id}' does not own a UI-reaching closed state`);
    }
  }
  rejectOverlappingAuthorities(
    declarations,
    (nodeId) => canonicalLineage(nodeId, upstreamByNode, serviceIds),
    componentTargets,
  );
  for (const presentId of ordinaryPresentIds) {
    for (const authority of declarations) {
      const direct = nodeBindings.filter(({ from, to }) =>
        from === authority.source.portRef && ownerOf(to) === presentId);
      if (direct.length > 1) {
        throw new Error(
          `present '${presentId}' must bind at most one direct canonical input ` +
          `'${authority.source.portRef}' (found ${direct.length})`,
        );
      }
    }
  }
  const authorityBindings = new Map<string, ReadonlyMap<string, readonly PortBindingIr[]>>();
  for (const componentId of componentIds) {
    const bindings = new Map<string, readonly PortBindingIr[]>();
    for (const authority of declarations) {
      const matches = componentBindings.filter(({ from, to }) =>
        from === authority.adapter.outputPortRef && ownerOf(to) === componentId);
      if (matches.length > 1) {
        throw new Error(
          `component '${componentId}' binds state presentation '${authority.adapter.outputPortRef}' ${matches.length} times`,
        );
      }
      bindings.set(authority.id, matches);
      if (componentTargets(authority.source.portRef, adapterIds).has(componentId) && matches.length !== 1) {
        throw new Error(
          `component '${componentId}' receives data derived from state authority '${authority.id}' ` +
          `but does not consume its generated presentation '${authority.adapter.outputPortRef}'`,
        );
      }
    }
    const ordinarySources = componentBindings.filter(({ from, to }) =>
      ownerOf(to) === componentId && ordinaryPresentIds.has(ownerOf(from)));
    const upstreamOwners = new Set(ordinarySources.flatMap(({ from }) =>
      [...canonicalLineage(ownerOf(from), upstreamByNode, serviceIds)]));
    for (const owner of new Set(declarations.map(({ source }) => ownerOf(source.portRef)))) {
      if (!upstreamOwners.has(owner)) continue;
      const candidates = declarations.filter(({ source }) => ownerOf(source.portRef) === owner);
      if (!candidates.some(({ id }) => bindings.get(id)?.length === 1)) {
        throw new Error(
          `component '${componentId}' receives presentation data from stateful owner '${owner}' ` +
          "but consumes none of its generated state presentations",
        );
      }
    }
    authorityBindings.set(componentId, bindings);

    for (const source of ordinarySources) {
      const output = portByRef.get(source.from)!;
      const contract = contractById.get(output.contractRef);
      for (const contractField of contract?.fields ?? []) {
        if (!isFiniteValueRef(contractField.value)) continue;
        const stateRef = contractField.value.ref;
        const matching = declarations.filter(({ id, source }) =>
          source.states.id === stateRef && bindings.get(id)?.length === 1);
        if (matching.length !== 1) {
          throw new Error(
            `component '${componentId}' receives '${output.ref}#${contractField.name}' closed state '${stateRef}' ` +
            `without exactly one generated state presentation (found ${matching.length})`,
          );
        }
      }
    }
  }

  const compiled: CompiledStateAuthority[] = [];
  for (const authority of declarations) {
    const { portRef, contract, stateField, states } = authority.source;
    const sourcePort = portByRef.get(portRef);
    if (sourcePort === undefined || sourcePort.direction !== "output") {
      throw new Error(`state authority '${authority.id}' uses unknown output port '${portRef}'`);
    }
    if (presentIds.has(sourcePort.ownerId)) {
      throw new Error(`state authority '${authority.id}' cannot originate in present node '${sourcePort.ownerId}'`);
    }
    if (sourcePort.contractRef !== contract.id) {
      throw new Error(`state authority '${authority.id}' source '${portRef}' does not use contract '${contract.id}'`);
    }
    const compiledContract = contractById.get(contract.id);
    if (compiledContract === undefined || contractFingerprint(compiledContract) !== contractFingerprint(contract)) {
      throw new Error(`state authority '${authority.id}' contract '${contract.id}' does not match the compiled graph`);
    }
    const state = contract.fields.find(({ name }) => name === stateField);
    if (contract.boundary !== "presentation" || contract.kind === "event" || state === undefined ||
        !isFiniteValueRef(state.value) || state.value.ref !== states.id) {
      throw new Error(`state authority '${authority.id}' field '${stateField}' must use finite state '${states.id}'`);
    }
    const declaredStates = finiteById.get(states.id);
    if (declaredStates === undefined || !sameValues(declaredStates.values, states.values)) {
      throw new Error(`state authority '${authority.id}' uses undeclared state space '${states.id}'`);
    }
    if (authority.presentation.stateRef !== states.id) {
      throw new Error(
        `state presentation '${authority.presentation.id}' maps '${authority.presentation.stateRef}', expected '${states.id}'`,
      );
    }
    validateStatePresentation(authority.presentation, states);
    validateAdapter(authority, nodeById, nodeTypeById, portByRef, contractById, nodeBindings);

    const consumers: string[] = [];
    for (const componentId of componentIds) {
      const bindings = authorityBindings.get(componentId)?.get(authority.id);
      if (bindings?.length === 1) consumers.push(bindings[0]!.to);
    }
    if (consumers.length === 0) throw new Error(`state presentation '${authority.presentation.id}' has no consumer`);
    compiled.push({
      ...authority,
      presentation: { ...authority.presentation, consumers },
    });
  }
  return compiled;

  function componentTargets(ref: string, excludedNodes = new Set<string>(), seen = new Set<string>()): ReadonlySet<string> {
    if (seen.has(ref)) return new Set();
    seen.add(ref);
    const result = new Set<string>();
    for (const binding of componentBindings.filter(({ from }) => from === ref)) result.add(ownerOf(binding.to));
    for (const target of targetsByOutput.get(ref) ?? []) {
      if (excludedNodes.has(target)) continue;
      // A service is a semantic re-authority boundary. Its outputs are not
      // assumed to derive from every one of its inputs: any UI-reaching closed
      // output is independently governed by the ordinary eligible-axis rule.
      if (serviceIds.has(target)) continue;
      for (const output of outputsByNode.get(target) ?? []) {
        for (const componentId of componentTargets(output, excludedNodes, seen)) result.add(componentId);
      }
    }
    return result;
  }
}

function validateAdapter(
  authority: StateAuthority,
  nodeById: ReadonlyMap<string, ProductNodeInstance>,
  nodeTypeById: ReadonlyMap<string, ProductNodeType>,
  portByRef: ReadonlyMap<string, { readonly contractRef: string; readonly direction: string }>,
  contractById: ReadonlyMap<string, LegoContract>,
  bindings: readonly PortBindingIr[],
): void {
  const node = nodeById.get(authority.adapter.nodeInstanceRef);
  const type = node === undefined ? undefined : nodeTypeById.get(node.nodeTypeRef);
  if (node === undefined || type?.kind !== "present" || node.nodeTypeRef !== authority.adapter.nodeTypeRef) {
    throw new Error(`state authority '${authority.id}' generated adapter is absent from the node graph`);
  }
  const input = portByRef.get(authority.adapter.inputPortRef);
  const output = portByRef.get(authority.adapter.outputPortRef);
  if (input?.direction !== "input" || output?.direction !== "output") {
    throw new Error(`state authority '${authority.id}' generated adapter ports are absent from the node graph`);
  }
  const inputBindings = bindings.filter(({ to }) => to === authority.adapter.inputPortRef);
  if (inputBindings.length !== 1 || inputBindings[0]?.from !== authority.source.portRef) {
    throw new Error(`state authority '${authority.id}' generated adapter does not read its canonical source`);
  }
  if (output.contractRef !== authority.presentation.contract.id ||
      contractFingerprint(contractById.get(output.contractRef)!) !== contractFingerprint(authority.presentation.contract)) {
    throw new Error(`state authority '${authority.id}' generated adapter output contract drifted`);
  }
}

function validateStatePresentation(presentation: StatePresentation, states: LegoFiniteValueDeclaration): void {
  requireWireId(presentation.id, "state presentation");
  requireUnique(presentation.fields.map(({ name }) => name), `field in state presentation '${presentation.id}'`);
  if (presentation.fields.length === 0) throw new Error(`state presentation '${presentation.id}' has no payload fields`);
  const stateIds = new Set(states.values);
  const caseIds = Object.keys(presentation.cases);
  const missingCases = states.values.filter((state) => !(state in presentation.cases));
  const extraCases = caseIds.filter((state) => !stateIds.has(state));
  if (missingCases.length > 0) throw new Error(`state presentation '${presentation.id}' is missing case '${missingCases.join("', '")}'`);
  if (extraCases.length > 0) throw new Error(`state presentation '${presentation.id}' has extra case '${extraCases.join("', '")}'`);
  for (const [state, payload] of Object.entries(presentation.cases)) {
    const expectedFields = new Set(presentation.fields.map(({ name }) => name));
    const actualFields = Object.keys(payload);
    const missing = presentation.fields.map(({ name }) => name).filter((name) => !(name in payload));
    const extra = actualFields.filter((name) => !expectedFields.has(name));
    if (missing.length > 0) throw new Error(`state presentation '${presentation.id}' case '${state}' is missing field '${missing.join("', '")}'`);
    if (extra.length > 0) throw new Error(`state presentation '${presentation.id}' case '${state}' has extra field '${extra.join("', '")}'`);
    for (const schema of presentation.fields) validatePayloadValue(presentation.id, state, schema, payload[schema.name]);
  }
}

function validatePayloadValue(
  presentationId: string,
  state: string,
  schema: StatePresentationField,
  value: unknown,
): void {
  const valid = typeof schema.value === "object" ? schema.value.values.includes(value as string)
    : schema.value === "boolean" ? typeof value === "boolean"
      : schema.value === "integer" ? typeof value === "number" && Number.isSafeInteger(value)
        : schema.value === "number" ? typeof value === "number" && Number.isFinite(value)
          : typeof value === "string";
  if (!valid) throw new Error(
    `state presentation '${presentationId}' case '${state}' field '${schema.name}' does not match its payload schema`,
  );
}

function rejectOverlappingAuthorities(
  declarations: readonly StateAuthority[],
  lineageForNode: (nodeId: string) => ReadonlySet<string>,
  componentTargetsForOutput: (ref: string) => ReadonlySet<string>,
): void {
  for (let leftIndex = 0; leftIndex < declarations.length; leftIndex += 1) {
    const left = declarations[leftIndex]!;
    for (const right of declarations.slice(leftIndex + 1)) {
      // Dependency is not identity. Position availability may feed flight phase
      // and both axes may legitimately reach the same component. Competing
      // lineage exists only when the finite space is reused or a descendant
      // republishes the same named axis under a renamed finite space.
      const sameAxis = left.source.states.id === right.source.states.id ||
        left.source.stateField === right.source.stateField;
      if (!sameAxis) continue;
      const leftOwner = ownerOf(left.source.portRef);
      const rightOwner = ownerOf(right.source.portRef);
      if (leftOwner === rightOwner) continue;
      const lineageOverlaps = lineageForNode(leftOwner).has(rightOwner) ||
        lineageForNode(rightOwner).has(leftOwner);
      const leftConsumers = componentTargetsForOutput(left.source.portRef);
      const rightConsumers = componentTargetsForOutput(right.source.portRef);
      const sharedComponent = [...leftConsumers].find((id) => rightConsumers.has(id));
      if (lineageOverlaps && sharedComponent !== undefined) {
        throw new Error(
          `state authorities '${left.id}' and '${right.id}' are competing ancestor/descendant state lineages ` +
          `consumed by component '${sharedComponent}'`,
        );
      }
    }
  }
}

function groupOwners(bindings: readonly PortBindingIr[]): ReadonlyMap<string, ReadonlySet<string>> {
  const result = new Map<string, Set<string>>();
  for (const binding of bindings) {
    const owners = result.get(ownerOf(binding.to)) ?? new Set<string>();
    owners.add(ownerOf(binding.from));
    result.set(ownerOf(binding.to), owners);
  }
  return result;
}

/**
 * Closed-state identity traverses pure derive/present nodes, but stops at a
 * service. A service may consume one state axis while publishing an unrelated
 * output; that output must declare its own authority if it exposes closed
 * state to UI.
 */
function canonicalLineage(
  nodeId: string,
  upstream: ReadonlyMap<string, ReadonlySet<string>>,
  serviceIds: ReadonlySet<string>,
  seen = new Set<string>(),
): Set<string> {
  if (seen.has(nodeId)) return seen;
  seen.add(nodeId);
  if (serviceIds.has(nodeId)) return seen;
  for (const owner of upstream.get(nodeId) ?? []) canonicalLineage(owner, upstream, serviceIds, seen);
  return seen;
}

function axisKey(authority: Pick<StateAuthority, "source"> | { readonly source: { readonly portRef: string; readonly stateField: string } }): string {
  return `${authority.source.portRef}#${authority.source.stateField}`;
}

function ownerOf(portRef: string): string {
  return portRef.slice(0, portRef.lastIndexOf("."));
}

function isFiniteValueRef(value: LegoContract["fields"][number]["value"]): value is LegoFiniteValueRef {
  return typeof value !== "string" && "finite" in value && value.finite === true;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
