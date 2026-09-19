import assert from "node:assert/strict";
import test from "node:test";
import { defineMachine } from "@v1d/product-spec";
import { emitMachineParitySwift, emitMachineSwift, machineCases } from "../src/core/index.js";
import { runSwift, swiftcSkip } from "./swift-toolchain.js";

/** Skyvw row 202: the same door the Kotlin and Mermaid tests use, so one declaration's three projections read alike. */
const door = defineMachine({
  id: "acme.door",
  states: ["CLOSED", "OPEN", "LOCKED"],
  initial: "CLOSED",
  inputs: ["Open", "Close", "Lock", "Unlock", "Knock", "Wave"],
  guards: ["HAS_KEY", "ALARMED"],
  cells: [
    { id: "closed.open", from: "CLOSED", on: "Open", to: "OPEN", forbids: ["ALARMED"] },
    { id: "open.close", from: "OPEN", on: "Close", to: "CLOSED" },
    { id: "closed.lock", from: "CLOSED", on: "Lock", to: "LOCKED", requires: ["HAS_KEY"] },
    { id: "locked.unlock", from: "LOCKED", on: "Unlock", to: "CLOSED", requires: ["HAS_KEY"], forbids: ["ALARMED"] },
  ],
  updates: [{ on: "Knock", fields: ["knocks"] }],
  ignored: ["Wave"],
  rests: ["CLOSED", "OPEN", "LOCKED"],
  deadlines: [],
  ordering: "exclusive",
  otherwise: "refuse",
});

/**
 * A spring door, where the declared order is the only thing that tells two cells for one move apart: with a key it
 * opens, without one the spring holds it shut. Nothing about the guards decides which cell wins, so emitting the cells
 * in any other order changes the answer, and the cases file catches it.
 */
const springDoor = defineMachine({
  id: "acme.spring-door",
  states: ["CLOSED", "OPEN"],
  initial: "CLOSED",
  inputs: ["Push", "SpringDeadline"],
  guards: ["HAS_KEY", "SPRING_PASSED"],
  cells: [
    { id: "push.with-key", from: "CLOSED", on: "Push", to: "OPEN", requires: ["HAS_KEY"] },
    { id: "push.held-shut", from: "CLOSED", on: "Push", to: "CLOSED" },
    { id: "spring.shuts", from: "OPEN", on: "SpringDeadline", to: "CLOSED", requires: ["SPRING_PASSED"] },
  ],
  rests: ["CLOSED"],
  deadlines: ["SpringDeadline"],
  ordering: "first-match",
  otherwise: "stay",
});

const options = { typeName: "AcmeDoor", sourceFile: "appspec/products/acme/runtime/door.ts" };
const springOptions = { typeName: "AcmeSpringDoor", sourceFile: "appspec/products/acme/runtime/spring-door.ts" };

const parityMain = (typeName: string) => [
  "import Foundation",
  `let checked = try ${typeName}Parity.check(CommandLine.arguments[1])`,
  `print("equal \\(checked)")`,
  "",
].join("\n");

test("the Swift is the machine's states, guards and cells as data, and declaredNext answers as step() does", () => {
  assert.equal(emitMachineSwift(door, options), `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM appspec/products/acme/runtime/door.ts
// Machine acme.door: ordering exclusive, otherwise refuse. Guards are names; the caller supplies the facts.

/** The states of machine acme.door. */
public enum AcmeDoorState: String, CaseIterable {
    case CLOSED = "CLOSED"
    case OPEN = "OPEN"
    case LOCKED = "LOCKED"
}

/** The facts a cell of machine acme.door may require or forbid; the caller works out which hold. */
public enum AcmeDoorGuard: String, CaseIterable {
    case HAS_KEY = "HAS_KEY"
    case ALARMED = "ALARMED"
}

/** One declared move: from a state on an input, named by its class, to a state, under the guards it requires and forbids. */
public struct AcmeDoorCell: Equatable {
    public let id: String
    public let from: AcmeDoorState
    public let on: String
    public let to: AcmeDoorState
    public let requires: Set<AcmeDoorGuard>
    public let forbids: Set<AcmeDoorGuard>
}

/** What machine acme.door throws when an input that may move the state matches no cell. */
public struct AcmeDoorRefusal: Error, Equatable {
    public let state: AcmeDoorState
    public let input: String
    public let held: Set<AcmeDoorGuard>
}

/** Machine acme.door: ordering exclusive, otherwise refuse. */
public enum AcmeDoorMachine {
    public static let initial: AcmeDoorState = .CLOSED

    public static let inputs: [String] = ["Open", "Close", "Lock", "Unlock", "Knock", "Wave"]

    /** Inputs that only update fields and never move the state. */
    public static let updates: [String] = ["Knock"]

    /** Inputs the machine takes no notice of. */
    public static let ignored: [String] = ["Wave"]

    /** States where staying forever is correct. */
    public static let rests: [String] = ["CLOSED", "OPEN", "LOCKED"]

    /** Inputs the caller raises from a clock; law 7 gave one of them a cell out of every state that is not a rest. */
    public static let deadlines: [String] = []

    public static let cells: [AcmeDoorCell] = [
        AcmeDoorCell(id: "closed.open", from: .CLOSED, on: "Open", to: .OPEN, requires: [], forbids: [.ALARMED]),
        AcmeDoorCell(id: "open.close", from: .OPEN, on: "Close", to: .CLOSED, requires: [], forbids: []),
        AcmeDoorCell(id: "closed.lock", from: .CLOSED, on: "Lock", to: .LOCKED, requires: [.HAS_KEY], forbids: []),
        AcmeDoorCell(id: "locked.unlock", from: .LOCKED, on: "Unlock", to: .CLOSED, requires: [.HAS_KEY], forbids: [.ALARMED]),
    ]

    /**
     * The first cell, in declared order, from [state] on [input] whose requires all hold in [held] and whose forbids
     * none hold. With no such cell the state stays and the cell id is nil, except that an input which may move it is thrown on.
     */
    public static func declaredNext(_ state: AcmeDoorState, _ input: String, _ held: Set<AcmeDoorGuard>) throws -> (to: AcmeDoorState, cellId: String?) {
        precondition(inputs.contains(input), "machine acme.door has no input " + input)
        let cell = cells.first { $0.from == state && $0.on == input && $0.requires.isSubset(of: held) && $0.forbids.isDisjoint(with: held) }
        if cell == nil && !updates.contains(input) && !ignored.contains(input) {
            throw AcmeDoorRefusal(state: state, input: input, held: held)
        }
        return (to: cell?.to ?? state, cellId: cell?.id)
    }
}
`);
});

test("a machine that stays never refuses, and its declaredNext is not marked throws", () => {
  const staying = emitMachineSwift(defineMachine({ ...door, otherwise: "stay" } as never), options);
  assert.doesNotMatch(staying, /throw AcmeDoorRefusal/u);
  assert.doesNotMatch(staying, /struct AcmeDoorRefusal/u);
  assert.match(staying, /public static func declaredNext\(_ state: AcmeDoorState, _ input: String, _ held: Set<AcmeDoorGuard>\) -> \(to: AcmeDoorState, cellId: String\?\) \{/u);
});

test("the cases are every state, input and subset of the guards, with step()'s answer", () => {
  const cases = machineCases(door);
  assert.equal(cases.length, 3 * 6 * 4);
  assert.deepEqual(cases.find(({ state, input, held }) => state === "CLOSED" && input === "Open" && held.length === 0),
    { state: "CLOSED", input: "Open", held: [], to: "OPEN", cellId: "closed.open", refused: false });
  // Under otherwise refuse, an input that may move the state and has no cell is a refusal, not a stay.
  assert.equal(cases.find(({ state, input, held }) => state === "OPEN" && input === "Open" && held.length === 0)?.refused, true);
  // An ignored input always stays, whatever is held.
  assert.deepEqual([...new Set(cases.filter(({ input }) => input === "Wave").map(({ refused }) => refused))], [false]);
});

test("a machine too wide for a full guard sweep is refused by name, never cut short", () => {
  const wide = { ...door, guards: Array.from({ length: 20 }, (_, index) => `G${index}`) };
  assert.throws(() => machineCases(wide as never), /would need \d+ parity cases .*2\^20 guard sets.*narrower fixture, not a truncated one/su);
});

test("a machine that breaks a law is refused before any Swift is written", () => {
  const overlapping = { ...door, cells: [...door.cells, { id: "closed.open-anyway", from: "CLOSED", on: "Open", to: "OPEN", requires: [], forbids: [] }] };
  assert.throws(() => emitMachineSwift(overlapping as never, options),
    /cells closed\.open and closed\.open-anyway both take Open in CLOSED/u);
});

test("swiftc compiles the emitted machine and answers every case as step() does, refusals included", swiftcSkip, () => {
  const printed = runSwift(
    { "AcmeDoor.swift": emitMachineSwift(door, options), "AcmeDoorParity.swift": emitMachineParitySwift(door, options) },
    parityMain("AcmeDoor"),
    { "acme.door.cases.json": JSON.stringify({ id: door.id, cases: machineCases(door) }) },
  );
  assert.equal(printed, "equal 72");
});

test("the form refuses a first-match machine whose cells are declared in the other order, by name", () => {
  // The row asked for the reversal as an emitter mutation; law 3 never lets one reach an emitter.
  assert.throws(() => defineMachine({ ...springDoor, cells: [...springDoor.cells].reverse() } as never),
    /cell push\.with-key can never match: with ordering first-match the declared order decides, and push\.held-shut comes first/u);
});

test("swiftc holds a first-match machine to the declared cell order, and the order swapped in the Swift disagrees by case", swiftcSkip, () => {
  const swift = emitMachineSwift(springDoor, springOptions);
  const parity = emitMachineParitySwift(springDoor, springOptions);
  const cases = { "acme.spring-door.cases.json": JSON.stringify({ id: springDoor.id, cases: machineCases(springDoor) }) };
  assert.equal(runSwift({ "AcmeSpringDoor.swift": swift, "AcmeSpringDoorParity.swift": parity }, parityMain("AcmeSpringDoor"), cases), "equal 16");
  // The same mutation, made where it can be made: the two Push cells swapped in the emitted array.
  const lines = swift.split("\n");
  const withKey = lines.findIndex((line) => line.includes("id: \"push.with-key\""));
  const heldShut = lines.findIndex((line) => line.includes("id: \"push.held-shut\""));
  [lines[withKey], lines[heldShut]] = [lines[heldShut]!, lines[withKey]!];
  assert.throws(() => runSwift({ "AcmeSpringDoor.swift": lines.join("\n"), "AcmeSpringDoorParity.swift": parity }, parityMain("AcmeSpringDoor"), cases),
    /CLOSED on Push holding \["HAS_KEY"\]: expected OPEN push\.with-key, answered CLOSED push\.held-shut/u);
});
