/**
 * The duplication law, in two levels.
 *
 * Mattias, 2026-09-23 (voice): "Jag taenkte att spraak skulle ju vara ett saett foer oss att faanga
 * saana haer dubletter ocksaa ... Lego-blocken ska ju vara saa smaa att ... det gaar att pussla ihop
 * nya tjaenster med liksom inte anvaendas en gaang." And: "om det aer tvaa legoblock eller tjaenster
 * anvaender samma vaeldigt liknande saker liksom saa ska man ha naagon varning just att bara men kolla
 * saa att de inte bara borde slaas ihop till en generisk tjaenst."
 *
 * D1, identical, is refused at build: two declarations that already say the same thing.
 * D2, same shape, is a warning: declarations a pattern could carry instead. A warning is answered by
 * making them pattern instances, or by writing the reason where the declaration is, so the answer is
 * readable beside the code instead of in a baseline file somewhere else.
 *
 * Both levels are pure functions of what is already compiled. [refuseDuplication] is the only one that
 * throws, so a caller can read the findings of a product that still carries them.
 */
import type { ComponentType } from "./component-tree-model.js";
import type { LegoContract, ProductNodeType } from "./node-model.js";
import type { ProductNodeInstance } from "./node-instance-model.js";
import { declaredSite, isCompilerBuilt } from "./source-site.js";

/** Every D1 case, in the order the law reports them. */
export const IDENTICAL_CASES = [
  "same-effects-and-context",
  "identical-contracts",
  "pass-through",
  "relay",
  "many-writers",
] as const;

/** Every D2 case, in the order the law reports them. */
export const SHAPE_CASES = ["service-shape", "present-shape", "component-shape", "empty-contracts", "one-off"] as const;

export type IdenticalCase = (typeof IDENTICAL_CASES)[number];
export type ShapeCase = (typeof SHAPE_CASES)[number];

export interface DuplicationFinding<Case extends string = IdenticalCase | ShapeCase> {
  /** Stable across recompiles of the same declaration: the case plus the ids it names. */
  readonly key: string;
  readonly case: Case;
  /** The declared ids this finding is about, sorted, so a reader can open them. */
  readonly ids: readonly string[];
  /** Where to look: the authored file and line of the first declaration named, when the kit saw it. */
  readonly site: string;
  /** One line. It says what is duplicated, names every id, and ends with the site. */
  readonly message: string;
}

/** The closed list of effect kinds a pattern can carry. Anything else is OTHER and never groups. */
export const EFFECT_KINDS = ["network", "store", "sensor", "ui"] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number] | "other";

/**
 * The kind of an effect, read from the word the product already declares it with. A product that means
 * a kind the list does not name keeps OTHER, and OTHER never groups, so audio, clock and power are
 * never proposed as one service.
 */
export function effectKind(effect: string): EffectKind {
  const word = effect.toLowerCase();
  if (/(^|[.-])(network|http|fetch|request|upload|download|poll)([.-]|$)/u.test(word)) return "network";
  if (/(^|[.-])(storage|store|write|read|persist|cache|journal|ledger)([.-]|$)/u.test(word)) return "store";
  if (/(^|[.-])(sensor|gps|location|barometer|attitude|subscription)([.-]|$)/u.test(word)) return "sensor";
  if (/(^|[.-])(ui|display|navigation|brightness|haptic)([.-]|$)/u.test(word)) return "ui";
  return "other";
}

/** The pattern a shape could become, named so the warning says what to do, not only what is wrong. */
export function patternFor(kinds: readonly EffectKind[]): string {
  if (kinds.includes("network")) return "fetchService";
  if (kinds.includes("store")) return "store";
  if (kinds.includes("sensor")) return "sensorService";
  return kinds.join("+") + " service";
}

const sortedUnique = (values: Iterable<string>): string[] => [...new Set(values)].sort();
/** A declaration that says why it keeps its own shape has answered the law and is never refused. */
const answered = (nodeType: ProductNodeType): boolean => nodeType.distinct === undefined;
const at = (site: string | undefined): string => site ?? "source unknown";

function group<T>(items: Iterable<T>, keyOf: (item: T) => string | null): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

function finding<Case extends string>(
  kind: Case,
  ids: readonly string[],
  site: string,
  sentence: string,
  resolution?: string,
): DuplicationFinding<Case> {
  const named = sortedUnique(ids);
  const how = resolution === undefined ? "" : ` ${resolution}`;
  return { key: `${kind}:${named.join(",")}`, case: kind, ids: named, site, message: `${sentence}.${how} [${site}]` };
}

/** What the author does next, written into the message so nobody has to read the kit to find out. */
const mergeOrDeclare = (what: string, others: readonly string[]): string =>
  `Merge this ${what} with ${others.join(" or ")}, or write distinct: "<why>" on its declaration`;

/** Every contract the node types and component types name, by id, so a contract is compared once. */
function contractsOf(
  nodeTypes: readonly ProductNodeType[],
  componentTypes: readonly ComponentType[],
): Map<string, { readonly contract: LegoContract; readonly site: string }> {
  const found = new Map<string, { contract: LegoContract; site: string }>();
  const seen = (contract: LegoContract, fallback: string): void => {
    if (found.has(contract.id)) return;
    found.set(contract.id, { contract, site: at(declaredSite(contract.fields[0] ?? {}) ?? fallback) });
  };
  for (const nodeType of nodeTypes) {
    const fallback = at(declaredSite(nodeType));
    for (const port of [...nodeType.inputs, ...nodeType.outputs]) seen(port.contract, fallback);
  }
  for (const componentType of componentTypes) {
    for (const port of [...componentType.inputs, ...componentType.outputs]) seen(port.contract, "source unknown");
  }
  return found;
}

/** D1: two node types that do the same thing to the world, under the same context. */
function sameEffectsAndContext(nodeTypes: readonly ProductNodeType[]): DuplicationFinding<IdenticalCase>[] {
  const groups = group(nodeTypes.filter(answered), (nodeType) => nodeType.runtime.effects.length === 0 ? null
    : JSON.stringify([sortedUnique(nodeType.runtime.effects), sortedUnique(nodeType.runtime.contextInputs)]));
  return [...groups.values()].filter((members) => members.length > 1).map((members) => {
    const ids = sortedUnique(members.map(({ id }) => id));
    const effects = sortedUnique(members[0]!.runtime.effects).join(", ");
    return finding("same-effects-and-context", ids, at(declaredSite(members[0]!)),
      `${members.length} node types declare the effects ${effects} under the same context: ${ids.join(", ")}`,
      mergeOrDeclare("node type", ids.slice(1)));
  });
}

const fieldShape = (contract: LegoContract): string =>
  JSON.stringify(contract.fields.map(({ name, value, nullable, unit }) => [name, value, nullable, unit ?? null]));

/**
 * D1: two contracts of the same kind and boundary, carrying the same fields, are one contract under two
 * names. A contract with NO fields is deliberately not identical to another empty one: an event's
 * identity is its id, and refusing that would leave the language unable to say which signal happened.
 * Empty contracts of the same kind and boundary are a merge candidate in D2 instead.
 */
function identicalContracts(
  nodeTypes: readonly ProductNodeType[],
  componentTypes: readonly ComponentType[],
): DuplicationFinding<IdenticalCase>[] {
  const groups = group(contractsOf(nodeTypes, componentTypes).values(), ({ contract }) =>
    contract.fields.length === 0 || isCompilerBuilt(contract) || contract.distinct !== undefined ? null
      : JSON.stringify([contract.kind, contract.boundary, fieldShape(contract)]));
  return [...groups.values()].filter((members) => members.length > 1).map((members) => {
    const ids = sortedUnique(members.map(({ contract }) => contract.id));
    const names = members[0]!.contract.fields.map(({ name }) => name);
    return finding("identical-contracts", ids, members[0]!.site,
      `${members.length} contracts declare the fields ${names.join(", ")}: ${ids.join(", ")}`,
      mergeOrDeclare("contract", ids.slice(1)));
  });
}

const mirrors = (nodeType: ProductNodeType): boolean =>
  nodeType.inputs.length === 1 && nodeType.outputs.length === 1
  && nodeType.inputs[0]!.contract.id === nodeType.outputs[0]!.contract.id;

/**
 * D1: a derive whose one output is its one input computes nothing, so the binding could have gone
 * straight to the consumer.
 *
 * A PRESENT that mirrors its input is a warning instead (D2, `present-shape`), not a refusal: this
 * language requires a final present between a service and a component, so a product whose model needs
 * no reshaping has no other legal way to say so. Refusing it would make the smallest correct product
 * unexpressible, which the kit's own minimal fixture proves.
 */
function passThrough(nodeTypes: readonly ProductNodeType[]): DuplicationFinding<IdenticalCase>[] {
  return nodeTypes
    .filter((nodeType) => answered(nodeType) && nodeType.kind === "derive" && mirrors(nodeType))
    .map((nodeType) => finding("pass-through", [nodeType.id], at(declaredSite(nodeType)),
      `derive '${nodeType.id}' answers with the contract it was given, '${nodeType.outputs[0]!.contract.id}', `
      + "so it computes nothing the binding could not carry",
      `Bind '${nodeType.inputs[0]!.contract.id}' straight to the consumer and delete this derive, `
      + 'or write distinct: "<why>" on its declaration'));
}

/**
 * D1: a service or derive whose every output is one of its inputs carries nothing the binding could
 * not carry. A present is left to the D2 warning for the same reason as a mirroring present: the
 * language requires one before a component, so forwarding there can be the only legal shape.
 */
function relay(nodeTypes: readonly ProductNodeType[], passed: ReadonlySet<string>): DuplicationFinding<IdenticalCase>[] {
  return nodeTypes
    .filter((nodeType) => answered(nodeType) && nodeType.kind !== "present"
      && !passed.has(nodeType.id) && nodeType.inputs.length > 0 && nodeType.outputs.length > 0
      && nodeType.outputs.every((output) => nodeType.inputs.some((input) => input.contract.id === output.contract.id)))
    .map((nodeType) => finding("relay", [nodeType.id], at(declaredSite(nodeType)),
      `${nodeType.kind} '${nodeType.id}' forwards every output contract straight from its inputs `
      + `(${sortedUnique(nodeType.outputs.map((output) => output.contract.id)).join(", ")})`,
      "Bind its source straight to the consumer and delete this node, "
      + 'or write distinct: "<why>" on its declaration'));
}

/** D1: durable state with two writers has no single owner, whatever each writer is called. */
function manyWriters(nodeTypes: readonly ProductNodeType[]): DuplicationFinding<IdenticalCase>[] {
  const writers = new Map<string, ProductNodeType[]>();
  for (const nodeType of nodeTypes) {
    if (!answered(nodeType) || nodeType.runtime.durability !== "durable") continue;
    for (const effect of nodeType.runtime.effects) {
      const bucket = writers.get(effect);
      if (bucket) bucket.push(nodeType);
      else writers.set(effect, [nodeType]);
    }
  }
  return [...writers.entries()]
    .filter(([, owners]) => sortedUnique(owners.map(({ id }) => id)).length > 1)
    .map(([effect, owners]) => {
      const ids = sortedUnique(owners.map(({ id }) => id));
      return finding("many-writers", [effect, ...ids], at(declaredSite(owners[0]!)),
        `durable effect '${effect}' has ${ids.length} writers: ${ids.join(", ")}`,
        `Give '${effect}' one owner and let the others ask it, `
        + 'or write distinct: "<why>" on the declarations that keep it');
    });
}

/** Every D1 finding the compiled declarations already carry, in a stable order. */
export function findIdenticalDuplication(
  nodeTypes: readonly ProductNodeType[],
  componentTypes: readonly ComponentType[] = [],
): DuplicationFinding<IdenticalCase>[] {
  const passed = passThrough(nodeTypes);
  const findings = [
    ...sameEffectsAndContext(nodeTypes),
    ...identicalContracts(nodeTypes, componentTypes),
    ...passed,
    ...relay(nodeTypes, new Set(passed.map(({ ids }) => ids[0]!))),
    ...manyWriters(nodeTypes),
  ];
  const order = new Map(IDENTICAL_CASES.map((kind, index) => [kind, index]));
  return findings.sort((left, right) =>
    order.get(left.case)! - order.get(right.case)! || left.key.localeCompare(right.key));
}

/** The shape a service is compared by: its effect kinds, its durability and its lifetime. */
function serviceShape(nodeType: ProductNodeType): readonly EffectKind[] | null {
  const kinds = sortedUnique(nodeType.runtime.effects.map(effectKind)) as EffectKind[];
  return kinds.length === 0 || kinds.includes("other") ? null : kinds;
}

/** The shape a present or component type is compared by: the contracts in and the contracts out. */
const portShape = (
  inputs: readonly { readonly contract: LegoContract }[],
  outputs: readonly { readonly contract: LegoContract }[],
): string => JSON.stringify([
  sortedUnique(inputs.map(({ contract }) => contract.id)),
  sortedUnique(outputs.map(({ contract }) => contract.id)),
]);

/**
 * Every D2 finding: declarations one pattern could carry. A declaration that says why it is its own
 * (`distinct`) or that it is named domain logic (`domain`) is answered and never reported.
 */
export function findMergeCandidates(
  nodeTypes: readonly ProductNodeType[],
  nodes: readonly ProductNodeInstance[] = [],
  componentTypes: readonly ComponentType[] = [],
): DuplicationFinding<ShapeCase>[] {
  // A declaration a pattern already carries has had its merge; one that says why it is its own has
  // answered. Everything else is still an open candidate.
  const open = (nodeType: ProductNodeType): boolean =>
    nodeType.distinct === undefined && nodeType.pattern === undefined;
  const services = group(nodeTypes.filter((nodeType) => nodeType.kind === "service" && open(nodeType)), (nodeType) => {
    const kinds = serviceShape(nodeType);
    return kinds === null ? null : JSON.stringify([kinds, nodeType.runtime.durability, nodeType.runtime.lifetime]);
  });
  const shaped = [...services.entries()].filter(([, members]) => members.length > 1).map(([shape, members]) => {
    const ids = sortedUnique(members.map(({ id }) => id));
    const [kinds, durability, lifetime] = JSON.parse(shape) as [EffectKind[], string, string];
    return finding("service-shape", ids, at(declaredSite(members[0]!)),
      `${members.length} services share one shape (${kinds.join("+")}, ${durability}, ${lifetime}) and could be `
      + `${patternFor(kinds)} instances: ${ids.join(", ")}. Answer with a pattern or with distinct: "<why>"`);
  });

  const openPresents = nodeTypes.filter((nodeType) => nodeType.kind === "present" && open(nodeType));
  const presents = group(openPresents, (nodeType) => portShape(nodeType.inputs, nodeType.outputs));
  const presentShapes = [...presents.values()].filter((members) => members.length > 1).map((members) => {
    const ids = sortedUnique(members.map(({ id }) => id));
    return finding("present-shape", ids, at(declaredSite(members[0]!)),
      `${members.length} presents take and give the same contracts, so one of them could serve all: ${ids.join(", ")}. `
      + 'Answer with one present or with distinct: "<why>"');
  });
  // A present that hands its input straight on reshapes nothing. It is legal, because a component
  // needs a final present, so it is a warning and not a refusal.
  const forwards = (nodeType: ProductNodeType): boolean =>
    nodeType.inputs.length > 0 && nodeType.outputs.length > 0
    && nodeType.outputs.every((output) => nodeType.inputs.some((input) => input.contract.id === output.contract.id));
  const mirroring = openPresents.filter(forwards).map((nodeType) =>
    finding("present-shape", [nodeType.id], at(declaredSite(nodeType)),
      `present '${nodeType.id}' hands on contracts it was given `
      + `(${sortedUnique(nodeType.outputs.map((output) => output.contract.id)).join(", ")}), `
      + 'so it reshapes nothing. Answer with its own model or with distinct: "<why>"'));

  const components = group(componentTypes, (componentType) => portShape(componentType.inputs, componentType.outputs));
  const componentShapes = [...components.values()].filter((members) => members.length > 1).map((members) => {
    const ids = sortedUnique(members.map(({ id }) => id));
    return finding("component-shape", ids, "source unknown",
      `${members.length} component types take and give the same contracts: ${ids.join(", ")}`);
  });

  // Contracts that carry nothing: their id IS the signal, so they are never identical (D1), but a
  // wall of them of the same kind is a pattern waiting to be declared once with named cases.
  const empty = group([...contractsOf(nodeTypes, componentTypes).values()]
    .filter(({ contract }) => contract.fields.length === 0 && !isCompilerBuilt(contract)),
    ({ contract }) => JSON.stringify([contract.kind, contract.boundary]));
  const emptyContracts = [...empty.values()].filter((members) => members.length > 1).map((members) => {
    const ids = sortedUnique(members.map(({ contract }) => contract.id));
    const { kind, boundary } = members[0]!.contract;
    return finding("empty-contracts", ids, members[0]!.site,
      `${members.length} ${boundary} ${kind} contracts carry no payload at all, so each one is only its own name: `
      + `${ids.join(", ")}. Answer with one declared contract and named cases, or with distinct: "<why>"`);
  });

  const uses = new Map<string, number>();
  for (const node of nodes) uses.set(node.nodeTypeRef, (uses.get(node.nodeTypeRef) ?? 0) + 1);
  const oneOffs = nodeTypes
    .filter((nodeType) => (uses.get(nodeType.id) ?? 0) === 1 && nodeType.domain === undefined
      && nodeType.pattern === undefined)
    .map((nodeType) => finding("one-off", [nodeType.id], at(declaredSite(nodeType)),
      `node type '${nodeType.id}' has one instance and is not named domain logic, so it is a one-off, not a Lego. `
      + 'Answer with a pattern instance or with domain: "<why>"'));

  const order = new Map(SHAPE_CASES.map((kind, index) => [kind, index]));
  return [...shaped, ...presentShapes, ...mirroring, ...componentShapes, ...emptyContracts, ...oneOffs]
    .sort((left, right) =>
    order.get(left.case)! - order.get(right.case)! || left.key.localeCompare(right.key));
}

/** D1 is a refusal: the first identical duplication stops the build, in one line with file and line. */
export function refuseDuplication(
  nodeTypes: readonly ProductNodeType[],
  componentTypes: readonly ComponentType[] = [],
): void {
  const [first] = findIdenticalDuplication(nodeTypes, componentTypes);
  if (first) throw new Error(`duplication refused: ${first.message}`);
}
