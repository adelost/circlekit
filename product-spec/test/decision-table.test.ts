import assert from "node:assert/strict";
import test from "node:test";
import {
  bool,
  choice,
  decide,
  decisionPoints,
  defineDecisionTable,
  integer,
  on,
  perChoice,
  record,
  type DecisionInvariant,
} from "../src/index.js";

const axes = {
  phase: ["GROUND", "AIR"],
  display: ["LIT", "DARK"],
  arrived: ["JUST_NOW", "SETTLED"],
} as const;

const columns = {
  level: perChoice(["SMART", "MAX"], choice(["FULL", "SYSTEM"])),
  held: bool,
  rate: record({ hz: integer, batchMs: integer }),
} as const;

const cells = [
  on("air", { phase: "AIR" }, { level: "FULL", held: true, rate: { hz: 20, batchMs: 0 } }),
  on("ground.lit.arrived", { phase: "GROUND", display: "LIT", arrived: "JUST_NOW" },
    { level: { SMART: "SYSTEM", MAX: "FULL" }, held: false, rate: { hz: 20, batchMs: 0 } }),
  on("ground.lit.settled", { phase: "GROUND", display: "LIT", arrived: "SETTLED" },
    { level: { SMART: "SYSTEM", MAX: "FULL" }, held: false, rate: { hz: 5, batchMs: 0 } }),
  on("ground.dark", { phase: "GROUND", display: "DARK" }, { level: "SYSTEM", held: false, rate: { hz: 1, batchMs: 1_000 } }),
] as const;

const airIsLive: DecisionInvariant<typeof axes, typeof columns> = {
  refuse: "the air must read 20 Hz",
  when: ({ at, values }) => at.phase === "AIR" && values.rate.hz < 20,
};

/** A declaration the type system would refuse, handed to the runtime laws as it would arrive from JSON. */
function untyped(overrides: Record<string, unknown>): () => unknown {
  return () => defineDecisionTable({ id: "fixture.power", axes, columns, cells, ...overrides } as never);
}

test("a total table with one cell per point decides every point and names the cell that decided", () => {
  const table = defineDecisionTable({
    id: "fixture.power", axes, columns, cells,
    // Typed from the table itself: `at.phase` and `values.rate.hz` need no annotation.
    invariants: [airIsLive, { refuse: "the dark ground never holds", when: ({ at, values }) => at.phase === "GROUND" && at.display === "DARK" && values.held }],
  });

  assert.equal(decisionPoints(table.axes).length, 8);
  const settled = decide(table, { phase: "GROUND", display: "LIT", arrived: "SETTLED" });
  assert.equal(settled.cell, "ground.lit.settled");
  assert.deepEqual(settled.values.rate, { hz: 5, batchMs: 0 });
  assert.equal(decide(table, { phase: "AIR", display: "DARK", arrived: "JUST_NOW" }).cell, "air");
});

test("total: a point no cell covers is refused by name", () => {
  assert.throws(untyped({ cells: cells.filter(({ id }) => id !== "ground.dark") }),
    /no cell covers phase=GROUND display=DARK arrived=JUST_NOW/);
});

test("one cell per point: two cells on one point are refused with both ids", () => {
  const overlap = on("air.lit", { phase: "AIR", display: "LIT" }, { level: "FULL", held: true, rate: { hz: 20, batchMs: 0 } });
  assert.throws(untyped({ cells: [...cells, overlap] }),
    /phase=AIR display=LIT arrived=JUST_NOW is covered by 2 cells: air, air\.lit/);
});

test("a region names only declared axes and values, and covers at least one point", () => {
  const unknownValue = on("space", { phase: "SPACE" }, { level: "FULL", held: true, rate: { hz: 20, batchMs: 0 } });
  assert.throws(untyped({ cells: [...cells, unknownValue] }), /cell space names phase 'SPACE', not one of GROUND, AIR/);
  const unknownAxis = on("high", { altitude: "HIGH" }, { level: "FULL", held: true, rate: { hz: 20, batchMs: 0 } });
  assert.throws(untyped({ cells: [...cells, unknownAxis] }), /cell high names axis 'altitude', which the table does not declare/);
  const nowhere = on("nowhere", { display: [] }, { level: "FULL", held: true, rate: { hz: 20, batchMs: 0 } });
  assert.throws(untyped({ cells: [...cells, nowhere] }), /cell nowhere covers no value of 'display', so it can never decide/);
});

test("every cell value is of its column's type", () => {
  const replaced = (values: Record<string, unknown>) =>
    untyped({ cells: cells.map((cell) => cell.id === "air" ? { ...cell, values: { ...cell.values, ...values } } : cell) });
  assert.throws(replaced({ held: "yes" }), /cell air 'held' is 'yes', not a boolean/);
  assert.throws(replaced({ level: "DIM" }), /cell air 'level' is 'DIM', not one of FULL, SYSTEM/);
  assert.throws(replaced({ level: { SMART: "FULL" } }), /cell air 'level' says nothing for choice MAX/);
  assert.throws(replaced({ rate: { hz: 2.5, batchMs: 0 } }), /cell air 'rate' field 'hz' is 2\.5, not an integer/);
  assert.throws(replaced({ rate: { hz: 20, batchMs: 0, jitter: 1 } }), /cell air 'rate' has field jitter/);
  assert.throws(replaced({ volume: 3 }), /cell air sets 'volume', which is not a column/);
});

test("cells and regions are data: a function in either is refused", () => {
  const withValues = (values: Record<string, unknown>) =>
    untyped({ cells: cells.map((cell) => cell.id === "air" ? { ...cell, values: { ...cell.values, ...values } } : cell) });
  assert.throws(withValues({ held: () => true }), /cell air 'held' is a function; a cell is data/);
  assert.throws(withValues({ level: { SMART: () => "FULL", MAX: "FULL" } }), /cell air 'level' under SMART is a function; a cell is data/);
  const regionFunction = cells.map((cell) => cell.id === "air" ? { ...cell, region: { phase: () => "AIR" } } : cell);
  assert.throws(untyped({ cells: regionFunction }), /cell air covers phase with a function; a region is data/);
});

test("cell ids are unique wire ids, so a recorded decision names exactly one cell", () => {
  assert.throws(untyped({ cells: [...cells, { ...cells[0], region: { phase: "AIR", display: "LIT" } }] }),
    /duplicate cell id in decision table 'fixture.power'/);
  assert.throws(untyped({ cells: cells.map((cell) => cell.id === "air" ? { ...cell, id: "Air Cell" } : cell) }),
    /decision cell has invalid wire id 'Air Cell'/);
});

test("a product invariant refuses every decision it matches, naming cell and point", () => {
  const slowAir = cells.map((cell) => cell.id === "air" ? { ...cell, values: { ...cell.values, rate: { hz: 5, batchMs: 0 } } } : cell);
  assert.throws(untyped({ cells: slowAir, invariants: [airIsLive] }),
    /cell air at phase=AIR display=LIT arrived=JUST_NOW: the air must read 20 Hz/);
});
