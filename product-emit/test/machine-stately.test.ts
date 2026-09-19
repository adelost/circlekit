import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { defineMachine, step } from "@v1d/product-spec";
import { emitMachineStately } from "../src/core/index.js";

/** Skyvw row 173: a machine's Stately Studio source, byte for byte, and read back by XState v5 as the same moves. */

const door = defineMachine({
  id: "acme.door",
  states: ["CLOSED", "OPEN", "LOCKED", "BROKEN"],
  initial: "CLOSED",
  inputs: ["Open", "Close", "Lock", "Unlock", "Kick", "Knock", "Wave"],
  guards: ["HAS_KEY", "ALARMED", "HARD"],
  cells: [
    { id: "closed.open", from: "CLOSED", on: "Open", to: "OPEN", forbids: ["ALARMED"] },
    { id: "open.close", from: "OPEN", on: "Close", to: "CLOSED" },
    { id: "closed.lock", from: "CLOSED", on: "Lock", to: "LOCKED", requires: ["HAS_KEY"] },
    { id: "locked.unlock", from: "LOCKED", on: "Unlock", to: "CLOSED", requires: ["HAS_KEY"], forbids: ["ALARMED"] },
    { id: "locked.kick.hard", from: "LOCKED", on: "Kick", to: "BROKEN", requires: ["HARD"] },
    { id: "locked.kick.soft", from: "LOCKED", on: "Kick", to: "LOCKED", forbids: ["HARD"] },
  ],
  updates: [{ on: "Knock", fields: ["knocks"] }],
  ignored: ["Wave"],
  rests: ["CLOSED", "OPEN", "LOCKED", "BROKEN"],
  deadlines: [],
  ordering: "exclusive",
  otherwise: "stay",
});

/** Skyvw row 200: a door that may not stand ajar, so Studio gets a state the clock leaves and says so. */
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

const options = { sourceFile: "appspec/products/acme/runtime/door.ts" };

test("the Stately source is the machine's states and cells in declared order, guards as names", () => {
  assert.equal(emitMachineStately(door, options), `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM appspec/products/acme/runtime/door.ts
// Machine acme.door for Stately Studio: ordering exclusive, otherwise stay. Guards are names; the caller supplies the facts.
// Rests, where staying forever is correct: CLOSED, OPEN, LOCKED, BROKEN. Deadlines, the inputs a clock raises: none.
import { and, createMachine, not } from "xstate";

export const machine = createMachine({
  id: "acme.door",
  initial: "CLOSED",
  states: {
    CLOSED: {
      on: {
        Open: [{ guard: not("ALARMED"), target: "OPEN" }],
        Lock: [{ guard: "HAS_KEY", target: "LOCKED" }],
      },
    },
    OPEN: {
      on: {
        Close: [{ target: "CLOSED" }],
      },
    },
    LOCKED: {
      on: {
        Unlock: [{ guard: and(["HAS_KEY", not("ALARMED")]), target: "CLOSED" }],
        Kick: [{ guard: "HARD", target: "BROKEN" }, { guard: not("HARD"), target: "LOCKED" }],
      },
    },
    BROKEN: {},
  },
});
`);
});

test("XState v5 reads the source as a machine that moves as step() does, for every state, input and guard set", async () => {
  // Written beside this test so `xstate` resolves from product-emit's devDependencies; the runtime never imports it.
  const file = join(import.meta.dirname, "door.machine.stately.mjs");
  await writeFile(file, emitMachineStately(door, options));
  const { machine } = await import(file) as { machine: import("xstate").AnyStateMachine };
  const { transition } = await import("xstate");
  assert.equal(machine.id, "acme.door");

  const guardSets = [[], ["HAS_KEY"], ["ALARMED"], ["HARD"], ["HAS_KEY", "ALARMED"], ["HAS_KEY", "HARD"]] as const;
  let compared = 0;
  for (const state of door.states) for (const input of door.inputs) for (const held of guardSets) {
    const facts = new Set<string>(held);
    const provided = machine.provide({ guards: Object.fromEntries(door.guards.map((guard) => [guard, () => facts.has(guard)])) });
    const [next] = transition(provided, provided.resolveState({ value: state, context: {} }), { type: input });
    const expected = step(door, state, input, facts as ReadonlySet<(typeof door.guards)[number]>);
    assert.equal(next.value, expected.to, `${state} on ${input} holding ${[...held].join(", ") || "none"}`);
    compared += 1;
  }
  assert.equal(compared, door.states.length * door.inputs.length * guardSets.length);
});

test("a deadline is named in the header and stays an ordinary event in the states", () => {
  const source = emitMachineStately(springDoor, options);
  assert.match(source, /\n\/\/ Rests, where staying forever is correct: CLOSED\. Deadlines, the inputs a clock raises: SpringDeadline\.\n/u);
  assert.match(source, /\n\/\/ A deadline stays an ordinary event here: XState's `after` wants a duration, and the form declares none\.\n/u);
  assert.match(source, /\n {8}SpringDeadline: \[\{ guard: "SPRING_PASSED", target: "CLOSED" \}\],\n/u);
  assert.doesNotMatch(source, /after: \{/u);
});

test("a machine that breaks a law is refused before any source is written", () => {
  const unreachable = { ...door, cells: door.cells.filter(({ to }) => to !== "BROKEN") };
  assert.throws(() => emitMachineStately(unreachable, options), /BROKEN/u);
});
