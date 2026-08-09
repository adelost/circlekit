import type { CompiledProductGraph } from "./port-graph-model.js";
import {
  contractFingerprint,
  requireIdentifier,
  requireUnique,
  requireWireId,
  type LegoContract,
  type LegoFiniteValueDeclaration,
  type LegoFiniteValueRef,
} from "./node-model.js";

/** Product data carried by one canonical state case. Native code may render it, never invent its id. */
export type StatePresentationValue = boolean | number | string | null;
export type StatePresentationPayload = Readonly<Record<string, StatePresentationValue>>;

export interface StatePresentation<
  Id extends string = string,
  StateRef extends string = string,
  State extends string = string,
  Payload extends StatePresentationPayload = StatePresentationPayload,
> {
  readonly id: Id;
  readonly stateRef: StateRef;
  /** Keys are the canonical state ids. There is deliberately no second tier id. */
  readonly cases: Readonly<Record<State, Payload>>;
}

export interface CompiledStatePresentation extends StatePresentation {
  /** Complete graph-derived present-node input set; never authored by a product. */
  readonly consumers: readonly string[];
}

type StateCaseMap<States extends LegoFiniteValueDeclaration, Payload extends StatePresentationPayload> = {
  readonly [State in States["values"][number]]: Payload;
};

type NoExtraStateCases<
  States extends LegoFiniteValueDeclaration,
  Cases,
> = Cases & Record<Exclude<keyof Cases, States["values"][number]>, never>;

/**
 * Exhaustive copy/tone/layout data for one closed state space.
 *
 * The canonical state ids are the case ids. A product cannot create a second
 * presentation-only tier universe and silently collapse two runtime states into
 * one. Missing and extra cases are type errors for literals and compiler errors
 * for decoded/generated declarations.
 */
export function defineStatePresentation<
  const States extends LegoFiniteValueDeclaration,
  const Id extends string,
  const Payload extends StatePresentationPayload,
  const Cases extends StateCaseMap<States, Payload>,
>(
  states: States,
  declaration: {
    readonly id: Id;
    readonly cases: NoExtraStateCases<States, Cases>;
  },
): StatePresentation<Id, States["id"], States["values"][number], Payload> {
  const presentation = {
    id: declaration.id,
    stateRef: states.id,
    cases: declaration.cases,
  } as StatePresentation<Id, States["id"], States["values"][number], Payload>;
  validateStatePresentation(presentation, states);
  return presentation;
}

export interface StateAuthority<
  Id extends string = string,
  SourcePortRef extends string = string,
  Contract extends LegoContract = LegoContract,
  StateField extends string = string,
  States extends LegoFiniteValueDeclaration = LegoFiniteValueDeclaration,
  Presentation extends StatePresentation = StatePresentation,
> {
  readonly id: Id;
  readonly source: {
    readonly portRef: SourcePortRef;
    readonly contract: Contract;
    readonly stateField: StateField;
    readonly states: States;
  };
  /** One vocabulary per authority. Surfaces resolve it; they never redefine it. */
  readonly presentation: Presentation;
}

export interface CompiledStateAuthority extends Omit<StateAuthority, "presentation"> {
  readonly presentation: CompiledStatePresentation;
}

type ContractFieldName<Contract extends LegoContract> = Contract["fields"][number]["name"];

/** One canonical closed state output and every presentation vocabulary derived from it. */
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
}): StateAuthority<Id, SourcePortRef, Contract, ContractFieldName<Contract>, States, Presentation> {
  return declaration;
}

/**
 * Compile state authorities against the real port graph.
 *
 * This is intentionally product-neutral. It never infers a domain from names:
 * the source is an exact output ref and each presentation is tied to exact
 * present-node inputs already wired from that output.
 */
export function compileStateAuthorities(
  declarations: readonly StateAuthority[],
  finiteValues: readonly LegoFiniteValueDeclaration[],
  graph: CompiledProductGraph,
): readonly CompiledStateAuthority[] {
  requireUnique(declarations.map(({ id }) => id), "state authority");
  requireUnique(declarations.map(({ source }) => source.portRef), "state authority source");
  requireUnique(
    declarations.map(({ source }) => source.portRef.slice(0, source.portRef.lastIndexOf("."))),
    "state authority owner",
  );
  const presentationIds = declarations.map(({ presentation }) => presentation.id);
  requireUnique(presentationIds, "state presentation");

  const finiteById = new Map(finiteValues.map((item) => [item.id, item]));
  const contractById = new Map(graph.portRegistry.contracts.map((item) => [item.id, item]));
  const nodeTypeById = new Map(graph.nodeTypes.map((item) => [item.id, item]));
  const nodeById = new Map(graph.nodes.map((item) => [item.id, item]));
  const portByRef = new Map(graph.portRegistry.nodePorts.map((item) => [item.ref, item]));
  const dataBindings = graph.portRegistry.bindings.filter(({ kind, purpose }) =>
    kind === "node-input" && purpose === "data");
  const upstreamByNode = new Map<string, Set<string>>();
  for (const binding of dataBindings) {
    const fromOwner = ownerOf(binding.from);
    const toOwner = ownerOf(binding.to);
    const upstream = upstreamByNode.get(toOwner) ?? new Set<string>();
    upstream.add(fromOwner);
    upstreamByNode.set(toOwner, upstream);
  }
  const dataTargetsByOutput = new Map<string, Set<string>>();
  for (const binding of dataBindings) {
    const targets = dataTargetsByOutput.get(binding.from) ?? new Set<string>();
    targets.add(ownerOf(binding.to));
    dataTargetsByOutput.set(binding.from, targets);
  }
  const outputRefsByNode = new Map<string, string[]>();
  for (const port of graph.portRegistry.nodePorts.filter(({ direction }) => direction === "output")) {
    const refs = outputRefsByNode.get(port.ownerId) ?? [];
    refs.push(port.ref);
    outputRefsByNode.set(port.ownerId, refs);
  }
  const presentIds = new Set(graph.nodes.filter((node) =>
    nodeTypeById.get(node.nodeTypeRef)?.kind === "present").map(({ id }) => id));
  const authorityByOwner = new Map(declarations.map((authority) => [ownerOf(authority.source.portRef), authority]));
  for (const node of graph.nodes) {
    if (nodeTypeById.get(node.nodeTypeRef)?.kind !== "service") continue;
    const eligible = graph.portRegistry.nodePorts.filter((port) => {
      if (port.ownerId !== node.id || port.direction !== "output") return false;
      const candidate = contractById.get(port.contractRef);
      return candidate?.kind === "state" &&
        candidate.fields.some(({ value }) => isFiniteValueRef(value)) &&
        outputReachesPresent(port.ref);
    });
    if (eligible.length > 1) {
      throw new Error(
        `service '${node.id}' exposes multiple UI-reaching closed state outputs '${eligible.map(({ ref }) => ref).join("', '")}'; ` +
        "unify them behind one canonical state authority",
      );
    }
    if (eligible.length === 1) {
      const authority = authorityByOwner.get(node.id);
      if (authority === undefined) {
        throw new Error(
          `service '${node.id}' UI-reaching closed state '${eligible[0]!.ref}' has no state authority`,
        );
      }
      if (authority.source.portRef !== eligible[0]!.ref) {
        throw new Error(
          `service '${node.id}' state authority uses '${authority.source.portRef}', expected '${eligible[0]!.ref}'`,
        );
      }
    }
  }
  const compiled: CompiledStateAuthority[] = [];

  for (const authority of declarations) {
    requireWireId(authority.id, "state authority");
    const { portRef, contract, stateField, states } = authority.source;
    const sourcePort = portByRef.get(portRef);
    if (sourcePort === undefined || sourcePort.direction !== "output") {
      throw new Error(`state authority '${authority.id}' uses unknown output port '${portRef}'`);
    }
    if (sourcePort.contractRef !== contract.id) {
      throw new Error(
        `state authority '${authority.id}' source '${portRef}' uses contract '${sourcePort.contractRef}', not '${contract.id}'`,
      );
    }
    const sourceNode = nodeById.get(sourcePort.ownerId);
    if (sourceNode === undefined || nodeTypeById.get(sourceNode.nodeTypeRef)?.kind !== "service") {
      throw new Error(`state authority '${authority.id}' source '${portRef}' is not owned by a service`);
    }
    const compiledContract = contractById.get(contract.id);
    if (compiledContract === undefined || contractFingerprint(compiledContract) !== contractFingerprint(contract)) {
      throw new Error(`state authority '${authority.id}' contract '${contract.id}' does not match the compiled graph`);
    }
    if (contract.kind !== "state") {
      throw new Error(`state authority '${authority.id}' contract '${contract.id}' must be a state contract`);
    }
    const sourceOwner = ownerOf(portRef);
    const competing = graph.portRegistry.nodePorts.filter((candidate) => {
      if (candidate.ownerId !== sourceOwner || candidate.direction !== "output" || candidate.ref === portRef) return false;
      const candidateContract = contractById.get(candidate.contractRef);
      return candidateContract?.boundary === "presentation" &&
        (candidateContract.kind === "state" || candidateContract.fields.some(({ value }) => isFiniteValueRef(value)));
    });
    if (competing.length > 0) {
      throw new Error(
        `state authority '${authority.id}' owner '${sourceOwner}' exposes second presentation state '${competing.map(({ ref }) => ref).join("', '")}'`,
      );
    }
    const field = contract.fields.find(({ name }) => name === stateField);
    if (field === undefined || !isFiniteValueRef(field.value) || field.value.ref !== states.id) {
      throw new Error(
        `state authority '${authority.id}' field '${stateField}' must use finite state '${states.id}'`,
      );
    }
    const declaredStates = finiteById.get(states.id);
    if (declaredStates === undefined || !sameValues(declaredStates.values, states.values)) {
      throw new Error(`state authority '${authority.id}' uses undeclared state space '${states.id}'`);
    }

    const presentation = authority.presentation;
    if (presentation.stateRef !== states.id) {
      throw new Error(
        `state presentation '${presentation.id}' maps '${presentation.stateRef}', expected '${states.id}'`,
      );
    }
    validateStatePresentation(presentation, states);
    const consumers: string[] = [];
    for (const node of graph.nodes) {
      const type = nodeTypeById.get(node.nodeTypeRef);
      if (type?.kind !== "present" || !reaches(node.id, sourceOwner)) continue;
      const directCanonicalInputs = dataBindings
        .filter(({ from, to }) => from === portRef && ownerOf(to) === node.id)
        .map(({ to }) => to);
      if (directCanonicalInputs.length !== 1) {
        throw new Error(
          `present '${node.id}' uses data derived from state authority '${authority.id}' ` +
          `and must have exactly one direct input from canonical source '${portRef}' ` +
          `(found ${directCanonicalInputs.length})`,
        );
      }
      consumers.push(...directCanonicalInputs);
    }
    if (consumers.length === 0) {
      throw new Error(`state presentation '${presentation.id}' has no graph-derived consumer`);
    }
    compiled.push({
      ...authority,
      presentation: { ...presentation, consumers },
    });
  }
  return compiled;

  function reaches(nodeId: string, targetOwner: string, seen = new Set<string>()): boolean {
    if (nodeId === targetOwner) return true;
    if (seen.has(nodeId)) return false;
    seen.add(nodeId);
    return [...(upstreamByNode.get(nodeId) ?? [])].some((upstream) => reaches(upstream, targetOwner, seen));
  }

  function outputReachesPresent(outputRef: string, seen = new Set<string>()): boolean {
    if (seen.has(outputRef)) return false;
    seen.add(outputRef);
    for (const targetNode of dataTargetsByOutput.get(outputRef) ?? []) {
      if (presentIds.has(targetNode)) return true;
      for (const next of outputRefsByNode.get(targetNode) ?? []) {
        if (outputReachesPresent(next, seen)) return true;
      }
    }
    return false;
  }
}

function validateStatePresentation(
  presentation: StatePresentation,
  states: LegoFiniteValueDeclaration,
): void {
  requireWireId(presentation.id, "state presentation");
  const expected = new Set(states.values);
  const actual = Object.keys(presentation.cases);
  const missing = states.values.filter((state) => !(state in presentation.cases));
  const extra = actual.filter((state) => !expected.has(state));
  if (missing.length > 0) {
    throw new Error(`state presentation '${presentation.id}' is missing case '${missing.join("', '")}'`);
  }
  if (extra.length > 0) {
    throw new Error(`state presentation '${presentation.id}' has extra case '${extra.join("', '")}'`);
  }
  for (const [state, payload] of Object.entries(presentation.cases)) {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(`state presentation '${presentation.id}' case '${state}' must be product data`);
    }
    for (const [key, value] of Object.entries(payload)) {
      requireIdentifier(key, `field in state presentation '${presentation.id}' case '${state}'`);
      if (value !== null && !["boolean", "number", "string"].includes(typeof value)) {
        throw new Error(`state presentation '${presentation.id}' case '${state}' field '${key}' is not product data`);
      }
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error(`state presentation '${presentation.id}' case '${state}' field '${key}' must be finite`);
      }
    }
  }
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
