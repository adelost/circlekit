import assert from "node:assert/strict";
import test from "node:test";
import { choice, decide, defineDecisionTable, defineLanes, on } from "../src/index.js";

/** Row 150 (fourth review KIT-01, KIT-L1): the laws run once, so neither a later write nor an unchecked point may get past them. */

const axes = { state: ["IDLE", "BUSY"] } as const;
const columns = { level: choice(["LOW", "HIGH"]) } as const;

test("a declaration changed after it was defined cannot be: the write throws and the result is unchanged", () => {
  const cells = [on("any", {}, { level: "LOW" })];
  const table = defineDecisionTable({ id: "fixture.frozen", axes, columns, cells });
  assert.throws(() => { (cells[0]!.values as { level: string }).level = "HIGH"; }, TypeError);
  const rides: Record<string, string> = { "service.work": "work" };
  const lanes = defineLanes({
    id: "fixture.lanes",
    lanes: { work: { isolation: "shared", lifetime: "process", ordering: "serial", reason: "off the hot path" } },
    streams: [],
    rides: rides as { "service.work": "work" },
  });
  assert.throws(() => { rides["service.work"] = "ui"; }, TypeError);

  assert.equal(decide(table, { state: "BUSY" }).values.level, "LOW");
  assert.equal(lanes.rides["service.work"], "work");
});

test("writing to what define returned throws, at any depth", () => {
  const table = defineDecisionTable({ id: "fixture.frozen", axes, columns, cells: [on("any", {}, { level: "LOW" })] });
  assert.throws(() => { (table as { id: string }).id = "other"; }, TypeError);
  assert.throws(() => { (table.cells[0]!.values as { level: string }).level = "HIGH"; }, TypeError);
  assert.throws(() => { (table.axes.state as unknown as string[]).push("TYPO"); }, TypeError);
});

test("decide refuses a point whose value or axis is not declared, even where a wildcard cell would answer", () => {
  const table = defineDecisionTable({ id: "fixture.frozen", axes, columns, cells: [on("any", {}, { level: "LOW" })] });
  assert.throws(() => decide(table, { state: "TYPO" } as never), /decision table 'fixture\.frozen': state 'TYPO' is not one of IDLE, BUSY/u);
  assert.throws(() => decide(table, { state: "IDLE", mode: "X" } as never), /has no axis 'mode'; its axes are state/u);
  assert.throws(() => decide(table, {} as never), /was asked without state; one of IDLE, BUSY/u);
});

test("a library catalog is frozen where it stands, so an exact import is still the catalog's own object", async () => {
  const { defineProductLibraryCatalog } = await import("../src/index.js");
  const contract = { id: "fixture.frozen-contract", kind: "event", boundary: "service-internal", fields: [] } as const;
  const catalog = defineProductLibraryCatalog({ id: "fixture.frozen-library", contracts: [contract], nodeTypes: [], finiteValues: [] });
  assert.equal(catalog.contracts[0], contract);
  assert.throws(() => { (contract as { id: string }).id = "renamed"; }, TypeError);
});
