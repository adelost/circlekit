import { defineMachine, step, type Machine } from "@v1d/product-spec";
import { swiftEnumCase, swiftGeneratedHeader, swiftStringArray, swiftStringLiteral } from "./swift-syntax.js";

/**
 * A machine as one self-contained Swift file: `State` and `Guard` as String
 * enums, the inputs, rests, deadlines, updates and ignored inputs as lists, the
 * cells as data in declared order, and `declaredNext`, which answers as
 * product-spec's `step()` does.
 *
 * The caller works out which guards hold, exactly as it does for `step()` and
 * for the Kotlin `declaredNext`; nothing here runs a predicate. Under
 * `otherwise: refuse` the function throws, which is `step()`'s own answer to an
 * input that may move the state and has no cell; under `stay` it cannot fail
 * and is not marked `throws`.
 *
 * A machine that breaks a law is refused before any Swift is written.
 */
export interface MachineSwiftOptions {
  /** The Swift type the machine becomes: `RecordingSession` gives `RecordingSessionState` and `RecordingSessionMachine`. */
  readonly typeName: string;
  /** Repo-relative path of the declaration, named in the header. */
  readonly sourceFile: string;
}

export function emitMachineSwift(machine: Machine, options: MachineSwiftOptions): string {
  defineMachine({ ...machine } as Parameters<typeof defineMachine>[0]);
  const { typeName } = options;
  const state = `${typeName}State`;
  const guard = `${typeName}Guard`;
  const cell = `${typeName}Cell`;
  const refuses = machine.otherwise === "refuse";
  return [
    ...swiftGeneratedHeader(options.sourceFile),
    `// Machine ${machine.id}: ordering ${machine.ordering}, otherwise ${machine.otherwise}. Guards are names; the caller supplies the facts.`,
    "",
    ...enumLines(state, machine.states, `The states of machine ${machine.id}.`),
    "",
    ...enumLines(guard, machine.guards, `The facts a cell of machine ${machine.id} may require or forbid; the caller works out which hold.`),
    "",
    "/** One declared move: from a state on an input, named by its class, to a state, under the guards it requires and forbids. */",
    `public struct ${cell}: Equatable {`,
    "    public let id: String",
    `    public let from: ${state}`,
    "    public let on: String",
    `    public let to: ${state}`,
    `    public let requires: Set<${guard}>`,
    `    public let forbids: Set<${guard}>`,
    "}",
    "",
    ...(refuses ? refusalTypeLines(machine, typeName) : []),
    `/** Machine ${machine.id}: ordering ${machine.ordering}, otherwise ${machine.otherwise}. */`,
    `public enum ${typeName}Machine {`,
    `    public static let initial: ${state} = .${swiftEnumCase(machine.initial)}`,
    "",
    `    public static let inputs: [String] = ${swiftStringArray(machine.inputs)}`,
    "",
    "    /** Inputs that only update fields and never move the state. */",
    `    public static let updates: [String] = ${swiftStringArray(machine.updates.map(({ on }) => on))}`,
    "",
    "    /** Inputs the machine takes no notice of. */",
    `    public static let ignored: [String] = ${swiftStringArray(machine.ignored)}`,
    "",
    "    /** States where staying forever is correct. */",
    `    public static let rests: [String] = ${swiftStringArray(machine.rests)}`,
    "",
    "    /** Inputs the caller raises from a clock; law 7 gave one of them a cell out of every state that is not a rest. */",
    `    public static let deadlines: [String] = ${swiftStringArray(machine.deadlines)}`,
    "",
    `    public static let cells: [${cell}] = [`,
    ...machine.cells.map((declared) =>
      `        ${cell}(id: ${swiftStringLiteral(declared.id)}, from: .${swiftEnumCase(declared.from)}, on: ${swiftStringLiteral(declared.on)}, `
      + `to: .${swiftEnumCase(declared.to)}, requires: ${guardSet(guard, declared.requires)}, forbids: ${guardSet(guard, declared.forbids)}),`),
    "    ]",
    "",
    ...declaredNextLines(machine, typeName),
    "}",
    "",
  ].join("\n");
}

function enumLines(name: string, values: readonly string[], doc: string): readonly string[] {
  return [
    `/** ${doc} */`,
    `public enum ${name}: String, CaseIterable {`,
    ...values.map((value) => `    case ${swiftEnumCase(value)} = ${swiftStringLiteral(value)}`),
    "}",
  ];
}

function guardSet(guard: string, guards: readonly string[]): string {
  return guards.length === 0 ? "[]" : `[${guards.map((name) => `.${swiftEnumCase(name)}`).join(", ")}]`;
}

function refusalTypeLines(machine: Machine, typeName: string): readonly string[] {
  return [
    `/** What machine ${machine.id} throws when an input that may move the state matches no cell. */`,
    `public struct ${typeName}Refusal: Error, Equatable {`,
    `    public let state: ${typeName}State`,
    "    public let input: String",
    `    public let held: Set<${typeName}Guard>`,
    "}",
    "",
  ];
}

/**
 * The first cell, in declared order, whose requires all hold and whose forbids none hold. With no such cell the state
 * stays and the cell id is nil, except that under `otherwise: refuse` an input that may move the state is thrown on.
 */
function declaredNextLines(machine: Machine, typeName: string): readonly string[] {
  const state = `${typeName}State`;
  const guard = `${typeName}Guard`;
  const refuses = machine.otherwise === "refuse";
  const signature = `    public static func declaredNext(_ state: ${state}, _ input: String, _ held: Set<${guard}>)`
    + `${refuses ? " throws" : ""} -> (to: ${state}, cellId: String?) {`;
  const refusal = refuses
    ? [
      "        if cell == nil && !updates.contains(input) && !ignored.contains(input) {",
      `            throw ${typeName}Refusal(state: state, input: input, held: held)`,
      "        }",
    ]
    : [];
  return [
    "    /**",
    "     * The first cell, in declared order, from [state] on [input] whose requires all hold in [held] and whose forbids",
    `     * none hold. With no such cell the state stays and the cell id is nil${refuses ? ", except that an input which may move it is thrown on" : ""}.`,
    "     */",
    signature,
    `        precondition(inputs.contains(input), ${swiftStringLiteral(`machine ${machine.id} has no input `)} + input)`,
    "        let cell = cells.first { $0.from == state && $0.on == input && $0.requires.isSubset(of: held) && $0.forbids.isDisjoint(with: held) }",
    ...refusal,
    "        return (to: cell?.to ?? state, cellId: cell?.id)",
    "    }",
  ];
}

/** One case of the parity fixture: a state, an input, the guards held, and what `step()` answered. */
export interface MachineCase {
  readonly state: string;
  readonly input: string;
  readonly held: readonly string[];
  readonly to: string;
  readonly cellId: string | null;
  /** True where `step()` refuses the input instead of answering; the Swift throws there. */
  readonly refused: boolean;
}

/**
 * Every state, every input and every subset of the declared guards, with `step()`'s answer: the TypeScript oracle both
 * Kotlin and Swift are held to. The subsets are 2^guards, so a machine wide enough to make that unreadable is refused
 * by name rather than quietly cut short.
 */
export function machineCases(machine: Machine): readonly MachineCase[] {
  const total = machine.states.length * machine.inputs.length * 2 ** machine.guards.length;
  if (total > MACHINE_CASE_CEILING) {
    throw new Error(`machine '${machine.id}' would need ${total} parity cases `
      + `(${machine.states.length} states x ${machine.inputs.length} inputs x 2^${machine.guards.length} guard sets); `
      + `the ceiling is ${MACHINE_CASE_CEILING}, so this machine needs a narrower fixture, not a truncated one`);
  }
  const subsets = guardSubsets(machine.guards);
  const cases: MachineCase[] = [];
  for (const state of machine.states) {
    for (const input of machine.inputs) {
      for (const held of subsets) {
        cases.push(oneCase(machine, state, input, held));
      }
    }
  }
  return cases;
}

const MACHINE_CASE_CEILING = 200_000;

function oneCase(machine: Machine, state: string, input: string, held: readonly string[]): MachineCase {
  try {
    const { to, cellId } = step(machine, state, input, new Set(held));
    return { state, input, held, to, cellId, refused: false };
  } catch {
    return { state, input, held, to: state, cellId: null, refused: true };
  }
}

function guardSubsets(guards: readonly string[]): readonly (readonly string[])[] {
  return Array.from({ length: 2 ** guards.length }, (_, bits) => guards.filter((_, index) => (bits >> index) & 1));
}

/**
 * A Swift function that runs a machine's cases file through the emitted `declaredNext` and returns how many it
 * checked, or throws on the first disagreement with its case named. Emitted rather than typed for the same reason the
 * machine is: the state names, the input names and whether the machine refuses are declared facts.
 */
export function emitMachineParitySwift(machine: Machine, options: MachineSwiftOptions): string {
  defineMachine({ ...machine } as Parameters<typeof defineMachine>[0]);
  const { typeName } = options;
  const refuses = machine.otherwise === "refuse";
  const answer = [
    `            let answered = ${refuses ? "try " : ""}${typeName}Machine.declaredNext(state, one.input, held)`,
    "            let read = answered.to.rawValue + \" \" + (answered.cellId ?? \"-\")",
    "            guard read == expected else { throw Disagreement(on: one, answered: read) }",
  ];
  const body = refuses
    ? [
      "            do {",
      ...answer.map((line) => `    ${line}`),
      `                guard !one.refused else { throw Disagreement(on: one, answered: read) }`,
      `            } catch let refusal as ${typeName}Refusal {`,
      "                guard one.refused else { throw Disagreement(on: one, answered: \"refused \\(refusal)\") }",
      "            }",
    ]
    : [
      "            guard !one.refused else { throw Disagreement(on: one, answered: \"this machine stays, it never refuses\") }",
      ...answer,
    ];
  return [
    ...swiftGeneratedHeader(options.sourceFile),
    `// Parity for machine ${machine.id}: the TypeScript answer in the cases file is the oracle.`,
    "",
    "import Foundation",
    "",
    `public enum ${typeName}Parity {`,
    "    public struct Move: Decodable {",
    "        public let state: String",
    "        public let input: String",
    "        public let held: [String]",
    "        public let to: String",
    "        public let cellId: String?",
    "        public let refused: Bool",
    "    }",
    "",
    "    public struct Cases: Decodable {",
    "        public let id: String",
    "        public let cases: [Move]",
    "    }",
    "",
    "    public struct Disagreement: Error, CustomStringConvertible {",
    "        public let on: Move",
    "        public let answered: String",
    "        public var description: String {",
    "            \"\\(on.state) on \\(on.input) holding \\(on.held): expected \\(on.to) \\(on.cellId ?? \"-\"), answered \\(answered)\"",
    "        }",
    "    }",
    "",
    "    /// Checks every case in the file at [path] and returns how many were equal.",
    "    public static func check(_ path: String) throws -> Int {",
    "        let loaded = try JSONDecoder().decode(Cases.self, from: Data(contentsOf: URL(fileURLWithPath: path)))",
    "        for one in loaded.cases {",
    `            let state = ${typeName}State(rawValue: one.state)!`,
    `            let held = Set(one.held.map { ${typeName}Guard(rawValue: $0)! })`,
    "            let expected = one.to + \" \" + (one.cellId ?? \"-\")",
    ...body,
    "        }",
    "        return loaded.cases.count",
    "    }",
    "}",
    "",
  ].join("\n");
}
