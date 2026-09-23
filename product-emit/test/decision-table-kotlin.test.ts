import assert from "node:assert/strict";
import test from "node:test";
import { bool, choice, defineDecisionTable, integer, on, perChoice, record } from "@v1d/product-spec";
import {
  emitDecisionCellsKotlin,
  emitDecisionLookupKotlin,
  emitFullGraph,
  type DecisionTableKotlinNames,
} from "../src/core/index.js";
import { fixtureProduct } from "./capability-fixture.js";

const table = defineDecisionTable({
  id: "power.rules",
  axes: { phase: ["GROUND", "ASCENT", "FREEFALL"], display: ["LIT", "DARK"], arrived: ["JUST_NOW", "SETTLED"] },
  columns: {
    brightness: perChoice(["ADAPTIVE", "MAX"], choice(["FULL", "SYSTEM"])),
    held: bool,
    pressure: record({ hz: integer, batchMs: integer }),
  },
  cells: [
    on("air", { phase: ["ASCENT", "FREEFALL"] }, { brightness: "FULL", held: true, pressure: { hz: 20, batchMs: 0 } }),
    on("ground.lit.arrived", { phase: "GROUND", display: "LIT", arrived: "JUST_NOW" },
      { brightness: { ADAPTIVE: "SYSTEM", MAX: "FULL" }, held: false, pressure: { hz: 20, batchMs: 0 } }),
    on("ground.lit", { phase: "GROUND", display: "LIT", arrived: "SETTLED" },
      { brightness: { ADAPTIVE: "SYSTEM", MAX: "FULL" }, held: false, pressure: { hz: 5, batchMs: 0 } }),
    on("ground.dark", { phase: "GROUND", display: "DARK" }, { brightness: "SYSTEM", held: false, pressure: { hz: 1, batchMs: 1_000 } }),
  ],
});

const names: DecisionTableKotlinNames = {
  cellType: "AcmePowerRule",
  axes: {
    phase: { parameter: "phase", enumType: "FlightPhase" },
    display: { parameter: "display", enumType: "DisplayState" },
    arrived: { parameter: "arrived", enumType: "Arrival" },
  },
  columns: {
    brightness: { argument: "brightnessOf", enumType: "Brightness", choiceEnumType: "BrightnessMode" },
    held: { argument: "screenHold" },
    pressure: {
      argument: "pressure",
      literal: ({ hz, batchMs }: { hz: number; batchMs: number }) =>
        `Profile(samplePeriodUs = ${1_000_000 / hz}, maxReportLatencyUs = ${batchMs * 1_000})`,
    },
  },
};

test("the lookup is an exhaustive when per axis, and a branch one cell owns returns that cell", () => {
  assert.equal(emitDecisionLookupKotlin(table, names, "ruleFor"), [
    "    fun ruleFor(phase: FlightPhase, display: DisplayState, arrived: Arrival): AcmePowerRule = when (phase) {",
    "        FlightPhase.GROUND -> when (display) {",
    "            DisplayState.LIT -> when (arrived) {",
    "                Arrival.JUST_NOW -> GROUND_LIT_ARRIVED",
    "                Arrival.SETTLED -> GROUND_LIT",
    "            }",
    "            DisplayState.DARK -> GROUND_DARK",
    "        }",
    "        FlightPhase.ASCENT -> AIR",
    "        FlightPhase.FREEFALL -> AIR",
    "    }",
  ].join("\n"));
});

test("a lookup inside a nested object starts at its indent and steps in by four spaces", () => {
  const nested = emitDecisionLookupKotlin(table, names, "at", "        ").split("\n");
  assert.deepEqual(nested.slice(0, 5), [
    "        fun at(phase: FlightPhase, display: DisplayState, arrived: Arrival): AcmePowerRule = when (phase) {",
    "            FlightPhase.GROUND -> when (display) {",
    "                DisplayState.LIT -> when (arrived) {",
    "                    Arrival.JUST_NOW -> GROUND_LIT_ARRIVED",
    "                    Arrival.SETTLED -> GROUND_LIT",
  ]);
  assert.equal(nested.at(-1), "        }");
  assert.match(emitDecisionCellsKotlin(table, names, "        "), /^ {8}val AIR = AcmePowerRule\(\n {12}id = "air",/u);
});

test("a traced lookup records the selected cell with source values and input facts", () => {
  const kotlin = emitDecisionLookupKotlin(table, names, "ruleFor", "    ", "GeneratedAcmeStudioTrace");
  assert.match(kotlin, /val answer = when \(phase\)/u);
  assert.match(kotlin, /GeneratedAcmeStudioTrace\.decision\("power\.rules", answer\.id/u);
  assert.match(kotlin, /"phase" to phase\.name/u);
  assert.match(kotlin, /"ground\.lit" -> "\{\\"brightness\\"/u);
});

test("a cell is a constant with its id first, then every column as its argument", () => {
  const cells = emitDecisionCellsKotlin(table, names);
  assert.ok(cells.startsWith([
    "    val AIR = AcmePowerRule(",
    '        id = "air",',
    "        brightnessOf = { _ -> Brightness.FULL },",
    "        screenHold = true,",
    "        pressure = Profile(samplePeriodUs = 50000, maxReportLatencyUs = 0),",
    "    )",
    "    val GROUND_LIT_ARRIVED = AcmePowerRule(",
    '        id = "ground.lit.arrived",',
    "        brightnessOf = { mode -> when (mode) { BrightnessMode.ADAPTIVE -> Brightness.SYSTEM; BrightnessMode.MAX -> Brightness.FULL } },",
    "        screenHold = false,",
    "        pressure = Profile(samplePeriodUs = 50000, maxReportLatencyUs = 0),",
    "    )",
  ].join("\n")), cells);
  assert.equal(cells.split("\n").filter((line) => line.startsWith("    val ")).length, 4);
  assert.match(emitDecisionCellsKotlin(table, { ...names, ordinalArgument: "ordinal" }), /id = "ground\.lit\.arrived",\n {8}ordinal = 1,/u);
});

test("a table of single points emits the full nested when", () => {
  const points = defineDecisionTable({
    id: "screen.rules",
    axes: { phase: ["GROUND", "AIR"], display: ["LIT", "DARK"] },
    columns: { held: bool },
    cells: [
      on("ground.lit", { phase: "GROUND", display: "LIT" }, { held: false }),
      on("ground.dark", { phase: "GROUND", display: "DARK" }, { held: false }),
      on("air.lit", { phase: "AIR", display: "LIT" }, { held: true }),
      on("air.dark", { phase: "AIR", display: "DARK" }, { held: true }),
    ],
  });
  const lookup = emitDecisionLookupKotlin(points, {
    cellType: "Rule",
    axes: { phase: { parameter: "phase", enumType: "Phase" }, display: { parameter: "display", enumType: "Display" } },
    columns: { held: { argument: "held" } },
  }, "ruleFor");
  assert.deepEqual(lookup.split("\n").filter((line) => line.includes(" -> ")), [
    "        Phase.GROUND -> when (display) {",
    "            Display.LIT -> GROUND_LIT",
    "            Display.DARK -> GROUND_DARK",
    "        Phase.AIR -> when (display) {",
    "            Display.LIT -> AIR_LIT",
    "            Display.DARK -> AIR_DARK",
  ]);
});

test("names that miss or invent an axis or column, or cannot write a value, are refused before anything is emitted", () => {
  const { arrived: _arrived, ...twoAxes } = names.axes;
  assert.throws(() => emitDecisionLookupKotlin(table, { ...names, axes: twoAxes }, "ruleFor"),
    /decision table 'power\.rules' Kotlin names: axes missing \[arrived\], unknown \[\]/u);
  assert.throws(() => emitDecisionCellsKotlin(table, { ...names, columns: { ...names.columns, volume: { argument: "volume" } } }),
    /columns missing \[\], unknown \[volume\]/u);
  assert.throws(() => emitDecisionCellsKotlin(table, { ...names, columns: { ...names.columns, pressure: { argument: "pressure" } } }),
    /decision column 'pressure' is a record; give it a literal/u);
  assert.throws(() => emitDecisionCellsKotlin(table, { ...names, columns: { ...names.columns, brightness: { argument: "brightnessOf", enumType: "Brightness" } } }),
    /decision column 'brightness' varies per choice; give it a choiceEnumType/u);
});

test("the full product graph draws each decision table as one node in its domain, listing its cell ids", () => {
  const withTable = emitFullGraph({ ...fixtureProduct, decisionTables: [table] }, "generated/fixture.product.json");
  assert.match(withTable, /^ {2}subgraph power\["power"\]\n {4}n_power_rules\{\{"rules<br\/><i>decision table<\/i><br\/>air<br\/>ground\.lit\.arrived<br\/>ground\.lit<br\/>ground\.dark"\}\}\n {2}end$/mu);
  assert.equal(emitFullGraph({ ...fixtureProduct, decisionTables: [] }, "generated/fixture.product.json"),
    emitFullGraph(fixtureProduct, "generated/fixture.product.json"), "a product without tables draws what it always did");
});
