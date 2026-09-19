import {
  decide,
  decisionPoints,
  defineDecisionTable,
  type DecisionCell,
  type DecisionColumn,
  type DecisionTable,
  type ScalarColumn,
} from "@v1d/product-spec";
import { swiftEnumCase, swiftGeneratedHeader, swiftIdentifier, swiftPropertyName, swiftStringArray, swiftStringLiteral } from "./swift-syntax.js";

/**
 * A decision table as one self-contained Swift file: an enum per axis, a type
 * per column that needs one, a `Row` struct, and `decide` as a single switch
 * over the tuple of the axes with the cells in declared order, each case
 * carrying the cell's id in a comment above it.
 *
 * Swift reads a switch first match, as `decide()` does, so the declared cell
 * order IS the emitted order and an earlier cell wins exactly where it wins in
 * TypeScript. An axis a cell leaves free, or names every value of, is a `_`:
 * with no wildcard left uncovered Swift proves the switch exhaustive itself,
 * so there is no `default` and no fallback to hide a hole.
 *
 * Unlike the Kotlin emitter, which writes fragments the product wraps in its own
 * vocabulary, this writes the whole file: the iPhone slice has no hand-written
 * Swift to wrap it in, and a fact that is not emitted would have to be typed
 * twice.
 *
 * `describe` renders a row as one canonical string. The parity cases file
 * carries the same string from the TypeScript side, so the two languages are
 * compared on the values themselves and not on a codec.
 */
export interface DecisionTableSwiftOptions {
  /** The Swift type the table becomes: `PowerPressure` gives `PowerPressureRow`, `PowerPressurePhase` and so on. */
  readonly typeName: string;
  /** Repo-relative path of the declaration, named in the header. */
  readonly sourceFile: string;
}

export function emitDecisionTableSwift(table: DecisionTable, options: DecisionTableSwiftOptions): string {
  requireLawful(table);
  const { typeName } = options;
  const axes = Object.entries(table.axes);
  const columns = Object.entries(table.columns);
  const lines = [
    ...swiftGeneratedHeader(options.sourceFile),
    `// Decision table ${table.id}: axes ${axes.map(([axis]) => axis).join(", ")}; cells in declared order, first match wins.`,
    "",
    ...axes.flatMap(([axis, values]) => [...enumLines(axisType(typeName, axis), values), ""]),
    ...columns.flatMap(([column, declared]) => columnTypeLines(typeName, column, declared)),
    ...rowLines(typeName, columns),
    "",
    `public enum ${typeName} {`,
    `    public static let cellIds: [String] = ${swiftStringArray(table.cells.map(({ id }) => id))}`,
    "",
    ...decideLines(table, typeName),
    "",
    ...describeLines(typeName, columns),
    "}",
    "",
  ];
  return lines.join("\n");
}

/** `PowerPressure` + `phase` → `PowerPressurePhase`, the enum an axis or a named column becomes. */
export function swiftDecisionMemberType(typeName: string, name: string): string {
  return `${typeName}${swiftIdentifier(name)}`;
}

const axisType = swiftDecisionMemberType;

/**
 * The structural laws again, before a line is written, as the Kotlin and Mermaid
 * emitters do. The product's own invariants ran at definition and are kept here
 * only by name, so they are not re-run; a table that reaches this point has
 * already survived them.
 */
function requireLawful(table: DecisionTable): void {
  defineDecisionTable({ id: table.id, axes: table.axes, derived: table.derived, columns: table.columns, cells: table.cells } as never);
}

function enumLines(name: string, values: readonly string[]): readonly string[] {
  return [
    `public enum ${name}: String, CaseIterable {`,
    ...values.map((value) => `    case ${swiftEnumCase(value)} = ${swiftStringLiteral(value)}`),
    "}",
  ];
}

function columnTypeLines(typeName: string, column: string, declared: DecisionColumn): readonly string[] {
  const name = swiftDecisionMemberType(typeName, column);
  switch (declared.kind) {
    case "choice":
      return [...enumLines(name, declared.values), ""];
    case "record":
      return [
        `public struct ${name}: Equatable {`,
        ...Object.entries(declared.fields).map(([field, scalar]) => `    public let ${swiftPropertyName(field)}: ${scalarType(name, field, scalar)}`),
        "}",
        "",
        ...Object.entries(declared.fields)
          .flatMap(([field, scalar]) => (scalar.kind === "choice" ? [...enumLines(`${name}${swiftIdentifier(field)}`, scalar.values), ""] : [])),
      ];
    case "per-choice":
      return [
        ...enumLines(`${name}Key`, declared.choices),
        "",
        ...(declared.value.kind === "choice" ? [...enumLines(`${name}Value`, declared.value.values), ""] : []),
      ];
    default:
      return [];
  }
}

function scalarType(owner: string, name: string, scalar: ScalarColumn): string {
  switch (scalar.kind) {
    case "choice":
      return `${owner}${swiftIdentifier(name)}`;
    case "boolean":
      return "Bool";
    case "integer":
      return "Int";
  }
}

function columnType(typeName: string, column: string, declared: DecisionColumn): string {
  const name = swiftDecisionMemberType(typeName, column);
  switch (declared.kind) {
    case "choice":
    case "record":
      return name;
    case "per-choice":
      return `[${name}Key: ${declared.value.kind === "choice" ? `${name}Value` : scalarType(name, column, declared.value)}]`;
    default:
      return scalarType(typeName, column, declared);
  }
}

function rowLines(typeName: string, columns: readonly [string, DecisionColumn][]): readonly string[] {
  return [
    `public struct ${typeName}Row: Equatable {`,
    "    /** The cell that decided, so a recorded decision can name it, as the Kotlin lookup does. */",
    "    public let cellId: String",
    ...columns.map(([column, declared]) => `    public let ${swiftPropertyName(column)}: ${columnType(typeName, column, declared)}`),
    "}",
  ];
}

function decideLines(table: DecisionTable, typeName: string): readonly string[] {
  const axes = Object.keys(table.axes);
  const parameters = axes.map((axis) => `${swiftPropertyName(axis)}: ${axisType(typeName, axis)}`).join(", ");
  const subject = axes.map((axis) => swiftPropertyName(axis)).join(", ");
  const cases = table.cells.flatMap((cell) => [
    `        // ${cell.id}`,
    `        case ${cellPatterns(table, cell).join(", ")}:`,
    `            return ${rowLiteral(table, typeName, cell)}`,
  ]);
  return [
    `    public static func decide(${parameters}) -> ${typeName}Row {`,
    `        switch (${subject}) {`,
    ...cases,
    "        }",
    "    }",
  ];
}

/** Every tuple a cell's region covers, an axis it leaves free or names whole written as `_`. */
function cellPatterns(table: DecisionTable, cell: DecisionCell): readonly string[] {
  const region = cell.region as Readonly<Record<string, string | readonly string[] | undefined>>;
  let patterns: string[][] = [[]];
  for (const [axis, values] of Object.entries(table.axes)) {
    const covered = region[axis];
    const named = covered === undefined ? values : (Array.isArray(covered) ? covered : [covered as string]);
    const choices = named.length === values.length && values.every((value) => named.includes(value))
      ? ["_"]
      : named.map((value) => `.${swiftEnumCase(value)}`);
    patterns = patterns.flatMap((prefix) => choices.map((choice) => [...prefix, choice]));
  }
  return patterns.map((pattern) => `(${pattern.join(", ")})`);
}

function rowLiteral(table: DecisionTable, typeName: string, cell: DecisionCell): string {
  const values = cell.values as Readonly<Record<string, unknown>>;
  const fields = Object.entries(table.columns)
    .map(([column, declared]) => `${swiftPropertyName(column)}: ${columnLiteral(typeName, column, declared, values[column])}`);
  return `${typeName}Row(cellId: ${swiftStringLiteral(cell.id)}, ${fields.join(", ")})`;
}

function columnLiteral(typeName: string, column: string, declared: DecisionColumn, value: unknown): string {
  const name = swiftDecisionMemberType(typeName, column);
  switch (declared.kind) {
    case "record": {
      const held = value as Readonly<Record<string, unknown>>;
      const fields = Object.entries(declared.fields)
        .map(([field, scalar]) => `${swiftPropertyName(field)}: ${scalarLiteral(`${name}${swiftIdentifier(field)}`, scalar, held[field])}`);
      return `${name}(${fields.join(", ")})`;
    }
    case "per-choice": {
      const inner = declared.value.kind === "choice" ? `${name}Value` : "";
      const perChoice = typeof value === "object" && value !== null ? value as Readonly<Record<string, unknown>> : undefined;
      const entries = declared.choices
        .map((choice) => `.${swiftEnumCase(choice)}: ${scalarLiteral(inner, declared.value, perChoice === undefined ? value : perChoice[choice])}`);
      return `[${entries.join(", ")}]`;
    }
    default:
      return scalarLiteral(name, declared, value);
  }
}

function scalarLiteral(enumType: string, scalar: ScalarColumn, value: unknown): string {
  switch (scalar.kind) {
    case "choice":
      return `${enumType}.${swiftEnumCase(String(value))}`;
    case "boolean":
      return String(value === true);
    case "integer":
      return String(value);
  }
}

/** One canonical string per row: `column=value` in declared order, the same string the cases file carries. */
function describeLines(typeName: string, columns: readonly [string, DecisionColumn][]): readonly string[] {
  const parts = columns.map(([column, declared]) => {
    const read = `row.${swiftPropertyName(column)}`;
    return `        parts.append("${column}=" + ${describeValue(read, declared)})`;
  });
  return [
    `    /** The row as one line, in declared column order: what the parity cases file compares against. */`,
    `    public static func describe(_ row: ${typeName}Row) -> String {`,
    "        var parts: [String] = []",
    ...parts,
    `        return parts.joined(separator: ";")`,
    "    }",
  ];
}

function describeValue(read: string, declared: DecisionColumn): string {
  switch (declared.kind) {
    case "record": {
      const fields = Object.entries(declared.fields)
        .map(([field, scalar]) => `"${field}:" + ${describeScalar(`${read}.${swiftPropertyName(field)}`, scalar)}`);
      return `"{" + [${fields.join(", ")}].joined(separator: ",") + "}"`;
    }
    case "per-choice": {
      const entries = declared.choices
        .map((choice) => `"${choice}:" + ${describeScalar(`${read}[.${swiftEnumCase(choice)}]!`, declared.value)}`);
      return `"{" + [${entries.join(", ")}].joined(separator: ",") + "}"`;
    }
    default:
      return describeScalar(read, declared);
  }
}

function describeScalar(read: string, scalar: ScalarColumn): string {
  return scalar.kind === "choice" ? `${read}.rawValue` : `String(${read})`;
}

/** The same rendering from the declaration, so the cases file and the Swift agree by construction. */
export function describeDecisionRow(table: DecisionTable, values: Readonly<Record<string, unknown>>): string {
  return Object.entries(table.columns)
    .map(([column, declared]) => `${column}=${describedValue(declared, values[column])}`)
    .join(";");
}

function describedValue(declared: DecisionColumn, value: unknown): string {
  switch (declared.kind) {
    case "record": {
      const held = value as Readonly<Record<string, unknown>>;
      return `{${Object.entries(declared.fields).map(([field, scalar]) => `${field}:${describedScalar(scalar, held[field])}`).join(",")}}`;
    }
    case "per-choice": {
      const perChoice = typeof value === "object" && value !== null ? value as Readonly<Record<string, unknown>> : undefined;
      const entries = declared.choices
        .map((choice) => `${choice}:${describedScalar(declared.value, perChoice === undefined ? value : perChoice[choice])}`);
      return `{${entries.join(",")}}`;
    }
    default:
      return describedScalar(declared, value);
  }
}

function describedScalar(scalar: ScalarColumn, value: unknown): string {
  switch (scalar.kind) {
    case "choice":
      return String(value);
    case "boolean":
      return String(value === true);
    case "integer":
      return String(value);
  }
}

/** Every point of the axes with the cell that decides it and its row, the TypeScript answer both other languages are held to. */
export function decisionTableCases(table: DecisionTable): readonly { readonly at: Readonly<Record<string, string>>; readonly cell: string; readonly row: string }[] {
  return decisionPoints(table.axes).map((at) => {
    const decision = decide(table, at);
    return { at: at as Readonly<Record<string, string>>, cell: decision.cell, row: describeDecisionRow(table, decision.values as Readonly<Record<string, unknown>>) };
  });
}

/**
 * A Swift function that runs a cases file through the emitted `decide` and returns how many points it checked, or
 * throws on the first disagreement with its point named. Emitted, not typed, because the axis names and their order
 * are declared facts: a hand-written checker would be the second place they live.
 *
 * Both the kit's own swiftc test and the product's XCTest call this, so the two languages are compared by one
 * implementation.
 */
export function emitDecisionTableParitySwift(table: DecisionTable, options: DecisionTableSwiftOptions): string {
  requireLawful(table);
  const { typeName } = options;
  const axes = Object.keys(table.axes);
  const call = axes
    .map((axis) => `${swiftPropertyName(axis)}: ${axisType(typeName, axis)}(rawValue: one.at[${swiftStringLiteral(axis)}]!)!`)
    .join(", ");
  return [
    ...swiftGeneratedHeader(options.sourceFile),
    `// Parity for decision table ${table.id}: the TypeScript answer in the cases file is the oracle.`,
    "",
    "import Foundation",
    "",
    `public enum ${typeName}Parity {`,
    "    public struct Point: Decodable {",
    "        public let at: [String: String]",
    "        public let cell: String",
    "        public let row: String",
    "    }",
    "",
    "    public struct Cases: Decodable {",
    "        public let id: String",
    "        public let axes: [String]",
    "        public let cases: [Point]",
    "    }",
    "",
    "    public struct Disagreement: Error, CustomStringConvertible {",
    "        public let at: [String: String]",
    "        public let expected: String",
    "        public let answered: String",
    "        public var description: String { \"at \\(at): expected \\(expected), answered \\(answered)\" }",
    "    }",
    "",
    "    /// Checks every point in the file at [path] and returns how many were equal.",
    "    public static func check(_ path: String) throws -> Int {",
    "        let loaded = try JSONDecoder().decode(Cases.self, from: Data(contentsOf: URL(fileURLWithPath: path)))",
    `        guard loaded.id == ${swiftStringLiteral(table.id)} else {`,
    `            throw Disagreement(at: [:], expected: ${swiftStringLiteral(table.id)}, answered: loaded.id)`,
    "        }",
    "        for one in loaded.cases {",
    `            let row = ${typeName}.decide(${call})`,
    "            let answered = row.cellId + \" \" + " + `${typeName}.describe(row)`,
    "            let expected = one.cell + \" \" + one.row",
    "            guard answered == expected else { throw Disagreement(at: one.at, expected: expected, answered: answered) }",
    "        }",
    "        return loaded.cases.count",
    "    }",
    "}",
    "",
  ].join("\n");
}
