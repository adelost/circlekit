import {
  decide,
  decisionPoints,
  type DecisionColumn,
  type DecisionTable,
  type ScalarColumn,
} from "@v1d/product-spec";
import { kotlinEnumToken, kotlinStringLiteral } from "./kotlin-syntax.js";

/**
 * A decision table as Kotlin: one constant per cell carrying its id and its
 * values, and a lookup that is an exhaustive `when` per axis in declared order.
 * A native enum value the table does not name fails to compile instead of
 * falling back, and the lookup returns the cell, so the caller always has the
 * id of the cell that decided.
 *
 * Where every point under a branch belongs to one cell the branch returns that
 * cell directly, so a region over several values reads as one line. A table
 * whose cells are all single points emits the full nested `when`.
 *
 * The product keeps its own file around these fragments: the cell class, its
 * accessors and any constants are product vocabulary, not this shape's.
 */
export interface DecisionTableKotlinNames {
  /** The Kotlin class or factory a cell constant is built with. */
  readonly cellType: string;
  /** Per axis, the lookup parameter and the Kotlin enum it takes. */
  readonly axes: Readonly<Record<string, { readonly parameter: string; readonly enumType: string }>>;
  /** Per column, the constructor argument and how its value is written. */
  readonly columns: Readonly<Record<string, DecisionColumnKotlin>>;
  /** When set, each cell also gets `<ordinalArgument> = <index>`: a compact number mapped from the id, never the identity. */
  readonly ordinalArgument?: string;
}

export type DecisionColumnKotlin =
  /** A choice, boolean or integer column; [enumType] writes a choice value, [choiceEnumType] the per-choice keys. */
  | { readonly argument: string; readonly enumType?: string; readonly choiceEnumType?: string }
  /** A column the product writes itself, such as a record built by a native constructor. */
  | { readonly argument: string; readonly literal: (value: never) => string };

/** `ground.lit` → `GROUND_LIT`: the constant a cell is emitted as. */
export function decisionCellConstant(cellId: string): string {
  return kotlinEnumToken(cellId);
}

const KOTLIN_STEP = "    ";

/** One `val` per cell, in declared order. [indent] is where each `val` line starts. */
export function emitDecisionCellsKotlin(table: DecisionTable, names: DecisionTableKotlinNames, indent = "    "): string {
  requireNames(table, names);
  return table.cells.map((cell, index) => {
    const values = cell.values as Readonly<Record<string, unknown>>;
    const argumentsOfCell = [
      `id = ${kotlinStringLiteral(cell.id)}`,
      ...(names.ordinalArgument === undefined ? [] : [`${names.ordinalArgument} = ${index}`]),
      ...Object.entries(table.columns).map(([column, declared]) =>
        `${names.columns[column]!.argument} = ${columnLiteral(column, declared, names.columns[column]!, values[column])}`),
    ];
    return `${indent}val ${decisionCellConstant(cell.id)} = ${names.cellType}(\n`
      + argumentsOfCell.map((argument) => `${indent}    ${argument},\n`).join("")
      + `${indent})`;
  }).join("\n");
}

/**
 * `fun <functionName>(<axes>): <cellType> = when (...) { ... }` over every axis in declared order. [indent] is where
 * the `fun` line starts; each nested `when` steps in by four spaces from there.
 */
export function emitDecisionLookupKotlin(
  table: DecisionTable,
  names: DecisionTableKotlinNames,
  functionName: string,
  indent = "    ",
  traceSink?: string,
  traceBuildGuard?: string,
): string {
  requireNames(table, names);
  if (traceSink && !traceBuildGuard) throw new Error("a traced Kotlin decision table needs a release-false build guard");
  const axisNames = Object.keys(table.axes);
  const parameters = axisNames.map((axis) => `${names.axes[axis]!.parameter}: ${names.axes[axis]!.enumType}`).join(", ");
  const points = decisionPoints(table.axes) as readonly Readonly<Record<string, string>>[];
  const body = (depth: number, fixed: Readonly<Record<string, string>>): string => {
    const under = points.filter((point) => Object.entries(fixed).every(([axis, value]) => point[axis] === value));
    const cells = new Set(under.map((point) => decide(table, point as never).cell));
    if (cells.size === 1) return decisionCellConstant([...cells][0]!);
    const axis = axisNames[depth]!;
    const { parameter, enumType } = names.axes[axis]!;
    const pad = indent + KOTLIN_STEP.repeat(depth + 1);
    const branches = table.axes[axis]!
      .map((value) => `${pad}${enumType}.${value} -> ${body(depth + 1, { ...fixed, [axis]: value })}`)
      .join("\n");
    return `when (${parameter}) {\n${branches}\n${indent + KOTLIN_STEP.repeat(depth)}}`;
  };
  const lookup = body(0, {});
  if (!traceSink) return `${indent}fun ${functionName}(${parameters}): ${names.cellType} = ${lookup}`;
  const facts = axisNames.map(axis => `${kotlinStringLiteral(axis)} to ${names.axes[axis]!.parameter}.name`).join(", ");
  const values = table.cells.map(cell => `${indent}        ${kotlinStringLiteral(cell.id)} -> ${kotlinStringLiteral(JSON.stringify(cell.values))}`)
    .join("\n");
  return `${indent}fun ${functionName}(${parameters}): ${names.cellType} {
${indent}    val answer = ${lookup}
${indent}    if (${traceBuildGuard} && ${traceSink}.enabled) ${traceSink}.decision(${kotlinStringLiteral(table.id)}, answer.id,
${indent}        mapOf(${facts}), when (answer.id) {
${values}
${indent}            else -> error("Unknown declared cell " + answer.id)
${indent}        })
${indent}    return answer
${indent}}`;
}

function columnLiteral(column: string, declared: DecisionColumn, kotlin: DecisionColumnKotlin, value: unknown): string {
  if ("literal" in kotlin) return kotlin.literal(value as never);
  switch (declared.kind) {
    case "record":
      throw new Error(`decision column '${column}' is a record; give it a literal`);
    case "per-choice": {
      if (kotlin.choiceEnumType === undefined) throw new Error(`decision column '${column}' varies per choice; give it a choiceEnumType`);
      if (typeof value !== "object" || value === null) return `{ _ -> ${scalarLiteral(column, declared.value, kotlin, value)} }`;
      const byChoice = value as Readonly<Record<string, unknown>>;
      const branches = declared.choices
        .map((choice) => `${kotlin.choiceEnumType}.${choice} -> ${scalarLiteral(column, declared.value, kotlin, byChoice[choice])}`)
        .join("; ");
      return `{ mode -> when (mode) { ${branches} } }`;
    }
    default:
      return scalarLiteral(column, declared, kotlin, value);
  }
}

function scalarLiteral(column: string, declared: ScalarColumn, kotlin: { readonly enumType?: string }, value: unknown): string {
  switch (declared.kind) {
    case "choice":
      if (kotlin.enumType === undefined) throw new Error(`decision column '${column}' is a choice; give it an enumType`);
      return `${kotlin.enumType}.${String(value)}`;
    case "boolean":
    case "integer":
      return String(value);
  }
}

/** The names cover exactly the table's axes and columns, so nothing is emitted under a guessed name. */
function requireNames(table: DecisionTable, names: DecisionTableKotlinNames): void {
  const exact = (what: string, declared: readonly string[], named: readonly string[]) => {
    const missing = declared.filter((name) => !named.includes(name));
    const extra = named.filter((name) => !declared.includes(name));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(`decision table '${table.id}' Kotlin names: ${what} missing [${missing.join(", ")}], unknown [${extra.join(", ")}]`);
    }
  };
  exact("axes", Object.keys(table.axes), Object.keys(names.axes));
  exact("columns", Object.keys(table.columns), Object.keys(names.columns));
}
