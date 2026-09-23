import assert from "node:assert/strict";
import test from "node:test";
import { defineMachine } from "@v1d/product-spec";
import { emitMachineKotlin, emitMachineMermaid, emitStudioTraceSinkKotlin } from "../src/core/index.js";

/** Skyvw row 171: the machine form's two projections, byte for byte, on a door small enough to read whole. */

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

/** Skyvw row 200: a door that may not stand ajar. AJAR is no rest, and the spring is the clock that leaves it. */
const springDoor = defineMachine({
  id: "acme.spring-door",
  states: ["CLOSED", "AJAR"],
  initial: "CLOSED",
  inputs: ["Push", "SpringDeadline"],
  guards: ["SPRING_PASSED"],
  cells: [
    { id: "closed.push", from: "CLOSED", on: "Push", to: "AJAR" },
    { id: "ajar.spring", from: "AJAR", on: "SpringDeadline", to: "CLOSED", requires: ["SPRING_PASSED"] },
  ],
  rests: ["CLOSED"],
  deadlines: ["SpringDeadline"],
  ordering: "exclusive",
  otherwise: "stay",
});

const options = {
  packageName: "com.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "appspec/products/acme/runtime/door.ts",
  sourceSha: "test",
  machineName: "Door",
};

test("a traced generated machine records the real cell and all guards only during a Studio test", () => {
  const kotlin = emitMachineKotlin(door, { ...options, traceSink: "GeneratedAcmeStudioTrace", traceBuildGuard: "BuildConfig.DEBUG" });
  assert.match(kotlin, /if \(BuildConfig\.DEBUG && GeneratedAcmeStudioTrace\.enabled\) GeneratedAcmeStudioTrace\.transition\("acme\.door"/u);
  assert.match(kotlin, /GeneratedAcmeDoorGuard\.entries\.associate \{ it\.name to \(it in guards\) \}/u);
  assert.match(kotlin, /System\.getenv\("V1D_STUDIO_TRACE_DIR"\)/u);
  assert.match(emitStudioTraceSinkKotlin("FixtureTrace"), /fun transition\(facetId: String, cellId: String\?/u);
  assert.match(emitStudioTraceSinkKotlin("FixtureTrace"), /var observer: \(\(String\) -> Unit\)\?/u);
  assert.match(emitStudioTraceSinkKotlin("FixtureTrace"), /enabled: Boolean get\(\) = output != null \|\| observer != null/u);
  assert.throws(() => emitMachineKotlin(door, { ...options, traceSink: "UnsafeTrace" }), /release-false build guard/u);
});

test("the Kotlin is the machine's states, guards and cells as data, and declaredNext answers as step() does", () => {
  assert.equal(emitMachineKotlin(door, options), `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM appspec/products/acme/runtime/door.ts
// Generator SHA-256: test
package com.acme.generated

/** The states of machine acme.door. */
internal enum class GeneratedAcmeDoorState { CLOSED, OPEN, LOCKED }

/** The facts a cell of machine acme.door may require or forbid; the caller works out which hold. */
internal enum class GeneratedAcmeDoorGuard { HAS_KEY, ALARMED }

/** One declared move: from a state on an input, named by its class, to a state, under the guards it requires and forbids. */
internal data class GeneratedAcmeDoorCell(
    val id: String,
    val from: GeneratedAcmeDoorState,
    val on: String,
    val to: GeneratedAcmeDoorState,
    val requires: Set<GeneratedAcmeDoorGuard>,
    val forbids: Set<GeneratedAcmeDoorGuard>,
)

/** Machine acme.door: ordering exclusive, otherwise refuse. */
internal object GeneratedAcmeDoorMachine {
    val initial = GeneratedAcmeDoorState.CLOSED

    val inputs: List<String> = listOf("Open", "Close", "Lock", "Unlock", "Knock", "Wave")

    /** Inputs that only update fields and never move the state. */
    val updates: List<String> = listOf("Knock")

    /** Inputs the machine takes no notice of. */
    val ignored: List<String> = listOf("Wave")

    /** States where staying forever is correct. */
    val rests: List<String> = listOf("CLOSED", "OPEN", "LOCKED")

    /** Inputs the caller raises from a clock; law 7 gave one of them a cell out of every state that is not a rest. */
    val deadlines: List<String> = listOf()

    val cells: List<GeneratedAcmeDoorCell> = listOf(
        GeneratedAcmeDoorCell("closed.open", GeneratedAcmeDoorState.CLOSED, "Open", GeneratedAcmeDoorState.OPEN, setOf(), setOf(GeneratedAcmeDoorGuard.ALARMED)),
        GeneratedAcmeDoorCell("open.close", GeneratedAcmeDoorState.OPEN, "Close", GeneratedAcmeDoorState.CLOSED, setOf(), setOf()),
        GeneratedAcmeDoorCell("closed.lock", GeneratedAcmeDoorState.CLOSED, "Lock", GeneratedAcmeDoorState.LOCKED, setOf(GeneratedAcmeDoorGuard.HAS_KEY), setOf()),
        GeneratedAcmeDoorCell("locked.unlock", GeneratedAcmeDoorState.LOCKED, "Unlock", GeneratedAcmeDoorState.CLOSED, setOf(GeneratedAcmeDoorGuard.HAS_KEY), setOf(GeneratedAcmeDoorGuard.ALARMED)),
    )

    /**
     * The first cell, in declared order, from [stage] on [inputName] whose requires all hold in [guards] and whose
     * forbids none hold. Null when there is none: the state stays, except that an input which may move it is refused.
     */
    fun declaredNext(stage: GeneratedAcmeDoorState, inputName: String, guards: Set<GeneratedAcmeDoorGuard>): GeneratedAcmeDoorCell? {
        require(inputName in inputs) { "machine acme.door has no input $inputName" }
        val cell = cells.firstOrNull { it.from == stage && it.on == inputName && guards.containsAll(it.requires) && it.forbids.none { held -> held in guards } }
        check(cell != null || inputName in updates || inputName in ignored) {
            "machine acme.door refuses $inputName in $stage: no cell matches the guards held"
        }
        return cell
    }
}
`);
});

test("a machine that stays writes no refusal, and says so", () => {
  const staying = emitMachineKotlin(defineMachine({ ...door, otherwise: "stay" } as never), options);
  assert.doesNotMatch(staying, /check\(cell != null/u);
  assert.match(staying, /Null when there is none: the state stays\.\n/u);
  assert.match(staying, /\n {8}val cell = cells\.firstOrNull \{[^\n]*\}\n {8}return cell\n/u);
});

test("the Mermaid is one arrow per cell, labelled with its input and guards", () => {
  assert.equal(emitMachineMermaid(door), [
    "stateDiagram-v2",
    "    %% machine acme.door: ordering exclusive, otherwise refuse",
    "    %% a state noted rest may stay forever; a deadline input leaves every other state",
    "    [*] --> CLOSED",
    "    CLOSED --> OPEN : Open [!ALARMED]",
    "    OPEN --> CLOSED : Close",
    "    CLOSED --> LOCKED : Lock [HAS_KEY]",
    "    LOCKED --> CLOSED : Unlock [HAS_KEY, !ALARMED]",
    "    note right of CLOSED : rest",
    "    note right of OPEN : rest",
    "    note right of LOCKED : rest",
    "",
  ].join("\n"));
});

test("both projections carry the rests and the deadlines, and only a rest is noted", () => {
  const kotlin = emitMachineKotlin(springDoor, { ...options, machineName: "SpringDoor" });
  assert.match(kotlin, /\n {4}val rests: List<String> = listOf\("CLOSED"\)\n/u);
  assert.match(kotlin, /\n {4}val deadlines: List<String> = listOf\("SpringDeadline"\)\n/u);
  assert.equal(emitMachineMermaid(springDoor), [
    "stateDiagram-v2",
    "    %% machine acme.spring-door: ordering exclusive, otherwise stay",
    "    %% a state noted rest may stay forever; a deadline input leaves every other state",
    "    [*] --> CLOSED",
    "    CLOSED --> AJAR : Push",
    "    AJAR --> CLOSED : SpringDeadline [SPRING_PASSED]",
    "    note right of CLOSED : rest",
    "",
  ].join("\n"));
});

test("a machine that breaks a law is refused before anything is written", () => {
  const overlapping = { ...door, cells: [...door.cells, { id: "closed.open-anyway", from: "CLOSED", on: "Open", to: "OPEN", requires: [], forbids: [] }] } as never;
  const refusal = /machine 'acme\.door' is refused:\n- cells closed\.open and closed\.open-anyway both take Open in CLOSED/u;
  assert.throws(() => emitMachineKotlin(overlapping, options), refusal);
  assert.throws(() => emitMachineMermaid(overlapping), refusal);
});
