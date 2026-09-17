import { requireWireId } from "./node-model.js";
import { frozen } from "./frozen.js";

/**
 * A machine: which input may move which state where, under which named guards.
 *
 * The first form is a stage-transition contract over a runtime that already exists: it says what the runtime may
 * decide, not how it updates its fields. Skyvw's recording session wrote this contract by hand in Kotlin
 * (RecordingSessionTable), with its own overlap and reachability checks; here the shape holds them once.
 *
 * - A cell is `from + on + guards -> to`. Guards are names of facts the caller supplies; nothing here runs a predicate.
 * - An input that only updates fields, never the state, is listed under `updates`, so the machine names every input it
 *   has. An input the machine takes no notice of is listed under `ignored`, by name.
 * - `otherwise` says what an input with no matching cell does: `stay` where it is, or `refuse` the input.
 *
 * Laws the shape owns, refused at build:
 * 1. every state, input and guard a cell or update names is declared;
 * 2. with `exclusive`, two cells for one (from, on) are told apart by a guard one requires and the other forbids;
 * 3. with `first-match`, the declared order decides, and a cell an earlier cell always wins over is refused by name;
 * 4. every state is reachable from `initial` through declared cells;
 * 5. no functions anywhere: guards are names, facts are supplied by the caller;
 * 6. every input is on a cell or an update, or listed under `ignored`.
 *
 * Not in this form: hierarchy, parallel regions, history, eventless or delayed transitions, entry and exit actions.
 * A parallel region is a second machine; a deadline is an input carrying `now`, decided into a guard by the caller.
 */

export type MachineOrdering = "exclusive" | "first-match";
export type MachineOtherwise = "stay" | "refuse";

export interface MachineCell<State extends string = string, Input extends string = string, Guard extends string = string> {
  /** Stable: a recorded transition names the cell that made it. */
  readonly id: string;
  readonly from: State;
  readonly on: Input;
  readonly to: State;
  /** Guards that must all hold. */
  readonly requires?: readonly Guard[];
  /** Guards none of which may hold. */
  readonly forbids?: readonly Guard[];
}

/** An input that only updates the named fields; it never moves the state. */
export interface MachineUpdate<Input extends string = string> {
  readonly on: Input;
  readonly fields: readonly string[];
}

export interface MachineDeclaration<State extends string, Input extends string, Guard extends string> {
  readonly id: string;
  readonly states: readonly State[];
  readonly initial: NoInfer<State>;
  readonly inputs: readonly Input[];
  readonly guards: readonly Guard[];
  readonly cells: readonly MachineCell<NoInfer<State>, NoInfer<Input>, NoInfer<Guard>>[];
  readonly updates?: readonly MachineUpdate<NoInfer<Input>>[];
  readonly ignored?: readonly NoInfer<Input>[];
  readonly ordering: MachineOrdering;
  readonly otherwise: MachineOtherwise;
}

/** A machine that passed every law: plain data, cells in declared order with their guard lists always present. */
export interface Machine<State extends string = string, Input extends string = string, Guard extends string = string> {
  readonly id: string;
  readonly states: readonly State[];
  readonly initial: State;
  readonly inputs: readonly Input[];
  readonly guards: readonly Guard[];
  readonly cells: readonly Required<MachineCell<State, Input, Guard>>[];
  readonly updates: readonly MachineUpdate<Input>[];
  readonly ignored: readonly Input[];
  readonly ordering: MachineOrdering;
  readonly otherwise: MachineOtherwise;
}

/** Where one input took the machine: a cell's `to` and id, or the state it stayed in and no cell. */
export type MachineStep<State extends string = string> =
  | { readonly to: State; readonly cellId: string }
  | { readonly to: State; readonly cellId: null };

/**
 * Checks every law, then returns the machine frozen. All problems are named in one error, so a machine with three
 * holes is fixed in one pass.
 */
export function defineMachine<const State extends string, const Input extends string, const Guard extends string>(
  declaration: MachineDeclaration<State, Input, Guard>,
): Machine<State, Input, Guard> {
  const machine = {
    id: declaration.id,
    states: declaration.states,
    initial: declaration.initial,
    inputs: declaration.inputs,
    guards: declaration.guards,
    cells: declaration.cells.map((cell) => ({ ...cell, requires: cell.requires ?? [], forbids: cell.forbids ?? [] })),
    updates: declaration.updates ?? [],
    ignored: declaration.ignored ?? [],
    ordering: declaration.ordering,
    otherwise: declaration.otherwise,
  } as Machine<State, Input, Guard>;
  const problems = machineProblems(machine as unknown as Machine, declaration as unknown as Readonly<Record<string, unknown>>);
  if (problems.length > 0) throw new Error(`machine '${declaration.id}' is refused:\n- ${problems.join("\n- ")}`);
  return frozen(machine);
}

/**
 * The first cell, in declared order, from [state] on [input] whose required guards all hold and whose forbidden guards
 * none hold. With no such cell the machine stays, or refuses the input when `otherwise` is `refuse`; an input that only
 * updates fields, or is ignored, stays either way. Pure: the same arguments always give the same answer.
 */
export function step<State extends string, Input extends string, Guard extends string>(
  machine: Machine<State, Input, Guard>,
  state: State,
  input: Input,
  guardsHeld: ReadonlySet<Guard>,
): MachineStep<State> {
  if (!machine.states.includes(state)) throw new Error(`machine '${machine.id}' has no state '${state}'; its states are ${machine.states.join(", ")}`);
  if (!machine.inputs.includes(input)) throw new Error(`machine '${machine.id}' has no input '${input}'; its inputs are ${machine.inputs.join(", ")}`);
  for (const guard of guardsHeld) {
    if (!machine.guards.includes(guard)) throw new Error(`machine '${machine.id}' has no guard '${guard}'; its guards are ${machine.guards.join(", ")}`);
  }
  const cell = machine.cells.find((candidate) => candidate.from === state && candidate.on === input
    && candidate.requires.every((guard) => guardsHeld.has(guard)) && !candidate.forbids.some((guard) => guardsHeld.has(guard)));
  if (cell !== undefined) return { to: cell.to, cellId: cell.id };
  const movesNothing = machine.updates.some(({ on }) => on === input) || machine.ignored.includes(input);
  if (machine.otherwise === "refuse" && !movesNothing) {
    throw new Error(`machine '${machine.id}' refuses ${input} in ${state}: no cell matches the guards held (${[...guardsHeld].join(", ") || "none"})`);
  }
  return { to: state, cellId: null };
}

/** Every state [machine] can reach from its initial state through its cells, guards aside. */
export function reachableStates<State extends string>(machine: Machine<State>): readonly State[] {
  const reached = new Set<State>([machine.initial]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const cell of machine.cells) {
      if (reached.has(cell.from) && !reached.has(cell.to)) {
        reached.add(cell.to);
        grew = true;
      }
    }
  }
  return machine.states.filter((state) => reached.has(state));
}

function machineProblems(machine: Machine, declaration: Readonly<Record<string, unknown>>): string[] {
  const problems: string[] = [];
  try {
    requireWireId(machine.id, "machine");
  } catch (error) {
    problems.push((error as Error).message);
  }
  problems.push(...functionProblems(declaration, "the declaration"));
  if (problems.length > 0) return problems;
  problems.push(...nameListProblems("state", machine.states), ...nameListProblems("input", machine.inputs), ...nameListProblems("guard", machine.guards, 0));
  if (!["exclusive", "first-match"].includes(machine.ordering)) problems.push(`ordering '${String(machine.ordering)}' is not exclusive or first-match`);
  if (!["stay", "refuse"].includes(machine.otherwise)) problems.push(`otherwise '${String(machine.otherwise)}' is not stay or refuse`);
  if (!machine.states.includes(machine.initial)) problems.push(`initial state '${machine.initial}' is not a declared state`);
  problems.push(...cellProblems(machine), ...inputProblems(machine));
  if (problems.length > 0) return problems;
  problems.push(...orderingProblems(machine));
  const unreached = machine.states.filter((state) => !reachableStates(machine).includes(state));
  if (unreached.length > 0) problems.push(`no cell reaches ${unreached.join(", ")} from ${machine.initial}`);
  return problems;
}

/** Law 5: a function anywhere in the declaration is refused with where it sits. */
function functionProblems(value: unknown, where: string): string[] {
  if (typeof value === "function") return [`${where} is a function; guards are names and facts are supplied by the caller`];
  if (Array.isArray(value)) return value.flatMap((item, index) => functionProblems(item, `${where}[${index}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => functionProblems(item, `${where}.${key}`));
  }
  return [];
}

function nameListProblems(kind: string, names: readonly string[], minimum = 1): string[] {
  const problems: string[] = [];
  if (names.length < minimum) problems.push(`a machine needs at least one ${kind}`);
  const twice = names.filter((name, index) => names.indexOf(name) !== index);
  if (twice.length > 0) problems.push(`${kind} ${[...new Set(twice)].join(", ")} is declared twice`);
  for (const name of names) if (!/^[A-Za-z][A-Za-z0-9_]*$/u.test(name)) problems.push(`${kind} '${name}' is not a plain name`);
  return problems;
}

/** Law 1 for cells: each names declared states, input and guards, has a stable unique id, and can match at all. */
function cellProblems(machine: Machine): string[] {
  const problems: string[] = [];
  const ids = machine.cells.map(({ id }) => id);
  for (const id of new Set(ids.filter((id, index) => ids.indexOf(id) !== index))) problems.push(`cell id '${id}' is used twice`);
  for (const cell of machine.cells) {
    try {
      requireWireId(cell.id, "machine cell");
    } catch (error) {
      problems.push((error as Error).message);
    }
    if (!machine.states.includes(cell.from)) problems.push(`cell ${cell.id} leaves '${cell.from}', which is not a declared state`);
    if (!machine.states.includes(cell.to)) problems.push(`cell ${cell.id} goes to '${cell.to}', which is not a declared state`);
    if (!machine.inputs.includes(cell.on)) problems.push(`cell ${cell.id} is on '${cell.on}', which is not a declared input`);
    for (const guard of [...cell.requires, ...cell.forbids]) {
      if (!machine.guards.includes(guard)) problems.push(`cell ${cell.id} names guard '${guard}', which is not a declared guard`);
    }
    const both = cell.requires.filter((guard) => cell.forbids.includes(guard));
    if (both.length > 0) problems.push(`cell ${cell.id} both requires and forbids ${both.join(", ")}, so it can never match`);
  }
  return problems;
}

/** Laws 1 and 6 for inputs: updates and ignored inputs are declared, and every input is accounted for exactly one way. */
function inputProblems(machine: Machine): string[] {
  const problems: string[] = [];
  const onCells = new Set(machine.cells.map(({ on }) => on));
  const updated = machine.updates.map(({ on }) => on);
  for (const { on, fields } of machine.updates) {
    if (!machine.inputs.includes(on)) problems.push(`update on '${on}' names an input that is not declared`);
    if (fields.length === 0) problems.push(`update on '${on}' names no field`);
    if (onCells.has(on)) problems.push(`input ${on} moves the state on a cell and is also listed as an update that never does`);
  }
  for (const on of new Set(updated.filter((input, index) => updated.indexOf(input) !== index))) problems.push(`input ${on} is listed as an update twice`);
  for (const on of machine.ignored) {
    if (!machine.inputs.includes(on)) problems.push(`ignored input '${on}' is not declared`);
    if (onCells.has(on) || updated.includes(on)) problems.push(`input ${on} is ignored but also on a cell or an update`);
  }
  const unaccounted = machine.inputs.filter((input) => !onCells.has(input) && !updated.includes(input) && !machine.ignored.includes(input));
  if (unaccounted.length > 0) problems.push(`input ${unaccounted.join(", ")} is on no cell or update and not listed under ignored`);
  return problems;
}

/** Laws 2 and 3: how two cells for one (from, on) are told apart. */
function orderingProblems(machine: Machine): string[] {
  const problems: string[] = [];
  machine.cells.forEach((earlier, index) => {
    for (const later of machine.cells.slice(index + 1)) {
      if (earlier.from !== later.from || earlier.on !== later.on) continue;
      if (machine.ordering === "exclusive" && !excludes(earlier, later)) {
        problems.push(`cells ${earlier.id} and ${later.id} both take ${earlier.on} in ${earlier.from} and no guard one requires is one the other forbids; `
          + "tell them apart by a guard, or declare ordering first-match");
      }
      if (machine.ordering === "first-match" && alwaysWinsOver(earlier, later)) {
        problems.push(`cell ${later.id} can never match: with ordering first-match the declared order decides, and ${earlier.id} comes first `
          + `and matches whenever ${later.id} does`);
      }
    }
  });
  return problems;
}

/** One cell requires a guard the other forbids, so no set of held guards matches both. */
function excludes(a: Required<MachineCell>, b: Required<MachineCell>): boolean {
  return a.requires.some((guard) => b.forbids.includes(guard)) || a.forbids.some((guard) => b.requires.includes(guard));
}

/** Every guard set [later] matches, [earlier] matches too: its requires and forbids are a subset of [later]'s. */
function alwaysWinsOver(earlier: Required<MachineCell>, later: Required<MachineCell>): boolean {
  return earlier.requires.every((guard) => later.requires.includes(guard)) && earlier.forbids.every((guard) => later.forbids.includes(guard));
}
