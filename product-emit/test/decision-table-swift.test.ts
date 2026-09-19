import assert from "node:assert/strict";
import test from "node:test";
import { bool, choice, defineDecisionTable, integer, on, perChoice, record } from "@v1d/product-spec";
import { decisionTableCases, emitDecisionTableParitySwift, emitDecisionTableSwift } from "../src/core/index.js";
import { runSwift, swiftcSkip } from "./swift-toolchain.js";

/**
 * Skyvw row 202: the same power table the Kotlin emitter's test uses, so the two projections of one declaration can be
 * read side by side. Its three column kinds are the ones a product actually declares: a value that varies per user
 * choice, a flag, and a record.
 */
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

const options = { typeName: "AcmePowerRules", sourceFile: "appspec/products/acme/settings/power-rules.ts" };

test("the Swift is an enum per axis, a type per column that needs one, and decide as one switch in declared cell order", () => {
  assert.equal(emitDecisionTableSwift(table, options), `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM appspec/products/acme/settings/power-rules.ts
// Decision table power.rules: axes phase, display, arrived; cells in declared order, first match wins.

public enum AcmePowerRulesPhase: String, CaseIterable {
    case GROUND = "GROUND"
    case ASCENT = "ASCENT"
    case FREEFALL = "FREEFALL"
}

public enum AcmePowerRulesDisplay: String, CaseIterable {
    case LIT = "LIT"
    case DARK = "DARK"
}

public enum AcmePowerRulesArrived: String, CaseIterable {
    case JUST_NOW = "JUST_NOW"
    case SETTLED = "SETTLED"
}

public enum AcmePowerRulesBrightnessKey: String, CaseIterable {
    case ADAPTIVE = "ADAPTIVE"
    case MAX = "MAX"
}

public enum AcmePowerRulesBrightnessValue: String, CaseIterable {
    case FULL = "FULL"
    case SYSTEM = "SYSTEM"
}

public struct AcmePowerRulesPressure: Equatable {
    public let hz: Int
    public let batchMs: Int
}

public struct AcmePowerRulesRow: Equatable {
    /** The cell that decided, so a recorded decision can name it, as the Kotlin lookup does. */
    public let cellId: String
    public let brightness: [AcmePowerRulesBrightnessKey: AcmePowerRulesBrightnessValue]
    public let held: Bool
    public let pressure: AcmePowerRulesPressure
}

public enum AcmePowerRules {
    public static let cellIds: [String] = ["air", "ground.lit.arrived", "ground.lit", "ground.dark"]

    public static func decide(phase: AcmePowerRulesPhase, display: AcmePowerRulesDisplay, arrived: AcmePowerRulesArrived) -> AcmePowerRulesRow {
        switch (phase, display, arrived) {
        // air
        case (.ASCENT, _, _), (.FREEFALL, _, _):
            return AcmePowerRulesRow(cellId: "air", brightness: [.ADAPTIVE: AcmePowerRulesBrightnessValue.FULL, .MAX: AcmePowerRulesBrightnessValue.FULL], held: true, pressure: AcmePowerRulesPressure(hz: 20, batchMs: 0))
        // ground.lit.arrived
        case (.GROUND, .LIT, .JUST_NOW):
            return AcmePowerRulesRow(cellId: "ground.lit.arrived", brightness: [.ADAPTIVE: AcmePowerRulesBrightnessValue.SYSTEM, .MAX: AcmePowerRulesBrightnessValue.FULL], held: false, pressure: AcmePowerRulesPressure(hz: 20, batchMs: 0))
        // ground.lit
        case (.GROUND, .LIT, .SETTLED):
            return AcmePowerRulesRow(cellId: "ground.lit", brightness: [.ADAPTIVE: AcmePowerRulesBrightnessValue.SYSTEM, .MAX: AcmePowerRulesBrightnessValue.FULL], held: false, pressure: AcmePowerRulesPressure(hz: 5, batchMs: 0))
        // ground.dark
        case (.GROUND, .DARK, _):
            return AcmePowerRulesRow(cellId: "ground.dark", brightness: [.ADAPTIVE: AcmePowerRulesBrightnessValue.SYSTEM, .MAX: AcmePowerRulesBrightnessValue.SYSTEM], held: false, pressure: AcmePowerRulesPressure(hz: 1, batchMs: 1000))
        }
    }

    /** The row as one line, in declared column order: what the parity cases file compares against. */
    public static func describe(_ row: AcmePowerRulesRow) -> String {
        var parts: [String] = []
        parts.append("brightness=" + "{" + ["ADAPTIVE:" + row.brightness[.ADAPTIVE]!.rawValue, "MAX:" + row.brightness[.MAX]!.rawValue].joined(separator: ",") + "}")
        parts.append("held=" + String(row.held))
        parts.append("pressure=" + "{" + ["hz:" + String(row.pressure.hz), "batchMs:" + String(row.pressure.batchMs)].joined(separator: ",") + "}")
        return parts.joined(separator: ";")
    }
}
`);
});

test("the cases are every point of the axes with the cell that decides it and its row", () => {
  const cases = decisionTableCases(table);
  assert.equal(cases.length, 3 * 2 * 2);
  assert.deepEqual(cases[0], {
    at: { phase: "GROUND", display: "LIT", arrived: "JUST_NOW" },
    cell: "ground.lit.arrived",
    row: "brightness={ADAPTIVE:SYSTEM,MAX:FULL};held=false;pressure={hz:20,batchMs:0}",
  });
  // An axis the cell leaves free answers the same at every value of it.
  const air = cases.filter(({ at }) => at["phase"] === "FREEFALL");
  assert.equal(air.length, 4);
  assert.equal(new Set(air.map(({ row }) => row)).size, 1);
});

test("a table that breaks a law is refused before any Swift is written", () => {
  const holed = { ...table, cells: table.cells.filter(({ id }) => id !== "ground.dark") };
  assert.throws(() => emitDecisionTableSwift(holed as never, options), /decision table 'power\.rules' is refused/u);
});

test("swiftc compiles the emitted table and answers every case as decide() does", swiftcSkip, () => {
  const printed = runSwift(
    { "AcmePowerRules.swift": emitDecisionTableSwift(table, options), "AcmePowerRulesParity.swift": emitDecisionTableParitySwift(table, options) },
    ["import Foundation",
      "let checked = try AcmePowerRulesParity.check(CommandLine.arguments[1])",
      "print(\"equal \\(checked)\")", ""].join("\n"),
    { "power.rules.cases.json": JSON.stringify({ id: table.id, axes: Object.keys(table.axes), cases: decisionTableCases(table) }) },
  );
  assert.equal(printed, "equal 12");
});

test("swiftc sees a disagreement: one point's expected row edited in the cases file is refused by that point", swiftcSkip, () => {
  const cases = decisionTableCases(table).map((point) => (point.cell === "ground.dark" ? { ...point, row: point.row.replace("hz:1,", "hz:2,") } : point));
  assert.throws(() => runSwift(
    { "AcmePowerRules.swift": emitDecisionTableSwift(table, options), "AcmePowerRulesParity.swift": emitDecisionTableParitySwift(table, options) },
    ["import Foundation",
      "let checked = try AcmePowerRulesParity.check(CommandLine.arguments[1])",
      "print(\"equal \\(checked)\")", ""].join("\n"),
    { "power.rules.cases.json": JSON.stringify({ id: table.id, axes: Object.keys(table.axes), cases }) },
  ), /phase.*GROUND|DARK/su);
});
