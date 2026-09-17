import { requireUnique, requireWireId } from "./node-model.js";

/**
 * A decision table: which values hold at each point of a few finite axes.
 *
 * A product that decides "in this phase and this display state, do this" wrote
 * it three ways before this shape existed, each with its own validator, and a
 * reader had to run helper functions in the head to see the matrix. Here the
 * matrix is the declaration: axes list every value, each cell names a region
 * of those axes and the values that hold there, and the shape refuses a table
 * that is not one answer per point.
 *
 * Laws the shape owns, which no product can switch off:
 * - total: every point of the axes has a cell;
 * - one cell per point: no two cells claim the same point;
 * - a region names only declared axes and declared values, and matches at least one point;
 * - every cell carries exactly the declared columns, each value of its column's type;
 * - cells and regions are data: a function anywhere in them is refused.
 * A product adds its own laws as `invariants: [{ refuse, when }]`; it can only add.
 * Invariants are build-time code: they run once over every point when the
 * table is defined and are not part of the table that comes back, so no
 * callback ever reaches an emitter.
 *
 * An axis the platform works out from events (the wearer "just arrived" at
 * the face) is not a free input: it is declared beside the cells as a
 * [DerivedAxis], a named fact with its source, its window and the events that
 * start, restart and end it. The table only selects on it; the fact has an owner.
 *
 * Portability: the table is plain data, so every platform reads the same
 * cells. Kotlin gets an exhaustive `when` per axis (product-emit), Swift a
 * `switch` over enums, Monkey C a constant array indexed by axis ordinals.
 * Nothing here names a platform type.
 */

/** A column whose value is one of a closed list of names. */
export interface ChoiceColumn<Value extends string = string> {
  readonly kind: "choice";
  readonly values: readonly Value[];
}

export interface BooleanColumn {
  readonly kind: "boolean";
}

export interface IntegerColumn {
  readonly kind: "integer";
}

export type ScalarColumn = ChoiceColumn | BooleanColumn | IntegerColumn;

/** A column holding a few named scalar fields, like a sample rate and its batch. */
export interface RecordColumn<Fields extends Readonly<Record<string, ScalarColumn>> = Readonly<Record<string, ScalarColumn>>> {
  readonly kind: "record";
  readonly fields: Fields;
}

/**
 * A column that may answer differently under each value of a user choice: one
 * value for every choice, or one value per choice. Only scalars vary per
 * choice, so a per-choice map can never be mistaken for a record.
 */
export interface PerChoiceColumn<Choice extends string = string, Inner extends ScalarColumn = ScalarColumn> {
  readonly kind: "per-choice";
  readonly choices: readonly Choice[];
  readonly value: Inner;
}

export type DecisionColumn = ScalarColumn | RecordColumn | PerChoiceColumn;

export type ColumnValue<Column> =
  Column extends ChoiceColumn<infer Value> ? Value
    : Column extends BooleanColumn ? boolean
      : Column extends IntegerColumn ? number
        : Column extends RecordColumn<infer Fields> ? { readonly [Field in keyof Fields]: ColumnValue<Fields[Field]> }
          : Column extends PerChoiceColumn<infer Choice, infer Inner>
            ? ColumnValue<Inner> | { readonly [Key in Choice]: ColumnValue<Inner> }
            : never;

export type DecisionAxes = Readonly<Record<string, readonly string[]>>;
export type DecisionColumns = Readonly<Record<string, DecisionColumn>>;

/** One value per axis. */
export type DecisionPoint<Axes extends DecisionAxes> = { readonly [Axis in keyof Axes]: Axes[Axis][number] };

/** Per axis, the value or values a cell covers. An axis left out covers all its values. */
export type DecisionRegion<Axes extends DecisionAxes> = {
  readonly [Axis in keyof Axes]?: Axes[Axis][number] | readonly Axes[Axis][number][];
};

export type DecisionValues<Columns extends DecisionColumns> = { readonly [Column in keyof Columns]: ColumnValue<Columns[Column]> };

export interface DecisionCell<Axes extends DecisionAxes = DecisionAxes, Columns extends DecisionColumns = DecisionColumns> {
  /** Stable: a recorded decision names the cell that made it. */
  readonly id: string;
  readonly region: DecisionRegion<Axes>;
  readonly values: DecisionValues<Columns>;
}

/** What the table decided at one point, and which cell decided it. */
export interface Decision<Axes extends DecisionAxes = DecisionAxes, Columns extends DecisionColumns = DecisionColumns> {
  readonly at: DecisionPoint<Axes>;
  readonly cell: string;
  readonly values: DecisionValues<Columns>;
}

/** A product law: a decision for which [when] holds is refused, and [refuse] says why. */
export interface DecisionInvariant<Axes extends DecisionAxes = DecisionAxes, Columns extends DecisionColumns = DecisionColumns> {
  readonly refuse: string;
  readonly when: (decision: Decision<Axes, Columns>) => boolean;
}

/**
 * An axis whose value comes from a time window the platform keeps: [inside]
 * from a start event for [windowMs], restarted by each restart event and closed
 * early by an end event, [outside] otherwise. [source] is where the rule is
 * written for people (a decision note), so the window has one owner.
 */
export interface DerivedAxis<Value extends string = string> {
  readonly source: string;
  readonly inside: Value;
  readonly outside: Value;
  readonly windowMs: number;
  readonly startsOn: readonly string[];
  readonly restartsOn: readonly string[];
  readonly endsOn: readonly string[];
}

export type DerivedAxes<Axes extends DecisionAxes> = { readonly [Axis in keyof Axes]?: DerivedAxis<Axes[Axis][number]> };

export interface DecisionTableDeclaration<Axes extends DecisionAxes, Columns extends DecisionColumns> {
  readonly id: string;
  /** Axis names to their values, in the order every emitter walks them. */
  readonly axes: Axes;
  readonly derived?: DerivedAxes<NoInfer<Axes>>;
  readonly columns: Columns;
  readonly cells: readonly DecisionCell<NoInfer<Axes>, NoInfer<Columns>>[];
  readonly invariants?: readonly DecisionInvariant<NoInfer<Axes>, NoInfer<Columns>>[];
}

/**
 * A table that passed every law: plain data. The product's invariants are kept
 * by what they refuse, so the product graph can list them; their functions ran
 * at definition and are gone.
 */
export interface DecisionTable<Axes extends DecisionAxes = DecisionAxes, Columns extends DecisionColumns = DecisionColumns> {
  readonly id: string;
  readonly axes: Axes;
  readonly derived: DerivedAxes<Axes>;
  readonly columns: Columns;
  readonly cells: readonly DecisionCell<Axes, Columns>[];
  readonly invariants: readonly string[];
}

export const choice = <const Value extends string>(values: readonly Value[]): ChoiceColumn<Value> => ({ kind: "choice", values });
export const bool: BooleanColumn = { kind: "boolean" };
export const integer: IntegerColumn = { kind: "integer" };
export const record = <const Fields extends Readonly<Record<string, ScalarColumn>>>(fields: Fields): RecordColumn<Fields> =>
  ({ kind: "record", fields });
export const perChoice = <const Choice extends string, const Inner extends ScalarColumn>(
  choices: readonly Choice[],
  value: Inner,
): PerChoiceColumn<Choice, Inner> => ({ kind: "per-choice", choices, value });

/** One cell: its stable id, the region it covers, and the values that hold there. */
export function on<const Region, const Values>(id: string, region: Region, values: Values): {
  readonly id: string;
  readonly region: Region;
  readonly values: Values;
} {
  return { id, region, values };
}

/**
 * Checks every law, then returns the table unchanged. All problems are named
 * in one error, so a table with three holes is fixed in one pass.
 */
export function defineDecisionTable<const Axes extends DecisionAxes, const Columns extends DecisionColumns>(
  declaration: DecisionTableDeclaration<Axes, Columns>,
): DecisionTable<Axes, Columns> {
  const { id, axes, columns, cells, derived = {}, invariants = [] } = declaration;
  const table = { id, axes, derived, columns, cells, invariants: invariants.map(({ refuse }) => refuse) } as DecisionTable<Axes, Columns>;
  const problems = decisionTableProblems(table as unknown as DecisionTable, invariants as unknown as readonly DecisionInvariant[]);
  if (problems.length > 0) {
    throw new Error(`decision table '${id}' is refused:\n- ${problems.join("\n- ")}`);
  }
  return table;
}

/** A product's tables for its IR, unique by id; none adds nothing, so a product without tables emits what it always did. */
export function decisionTablesIr(tables: readonly DecisionTable[]): { readonly decisionTables?: readonly DecisionTable[] } {
  if (tables.length === 0) return {};
  requireUnique(tables.map(({ id }) => id), "decision table");
  return { decisionTables: tables };
}

/** Every point of the axes, the first axis slowest, in declared value order. */
export function decisionPoints<Axes extends DecisionAxes>(axes: Axes): readonly DecisionPoint<Axes>[] {
  let points: Record<string, string>[] = [{}];
  for (const [axis, values] of Object.entries(axes)) {
    points = points.flatMap((point) => values.map((value) => ({ ...point, [axis]: value })));
  }
  return points as unknown as readonly DecisionPoint<Axes>[];
}

/** The one cell at [at] and its values. The table has already proved there is exactly one. */
export function decide<Axes extends DecisionAxes, Columns extends DecisionColumns>(
  table: DecisionTable<Axes, Columns>,
  at: DecisionPoint<Axes>,
): Decision<Axes, Columns> {
  const cell = table.cells.find((candidate) => regionCovers(candidate.region, at));
  if (cell === undefined) throw new Error(`decision table '${table.id}' has no cell at ${pointName(at)}`);
  return { at, cell: cell.id, values: cell.values as DecisionValues<Columns> };
}

/** Whether [region] covers [point]: every axis the region names holds the point's value. */
export function regionCovers(region: DecisionRegion<DecisionAxes>, point: DecisionPoint<DecisionAxes>): boolean {
  return Object.entries(region).every(([axis, covered]) => covered === undefined || valuesOf(covered).includes(point[axis]!));
}

function decisionTableProblems(table: DecisionTable, invariants: readonly DecisionInvariant[]): string[] {
  const problems: string[] = [];
  const attempt = (check: () => void) => {
    try {
      check();
    } catch (error) {
      problems.push((error as Error).message);
    }
  };
  attempt(() => requireWireId(table.id, "decision table"));
  problems.push(...axisProblems(table.axes));
  problems.push(...columnProblems(table.columns), ...derivedProblems(table.axes, table.derived));
  attempt(() => requireUnique(table.cells.map(({ id }) => id), `cell id in decision table '${table.id}'`));
  for (const cell of table.cells) {
    attempt(() => requireWireId(cell.id, "decision cell"));
    problems.push(...regionProblems(table.axes, cell), ...valueProblems(table.columns, cell));
  }
  if (problems.length > 0) return problems;
  for (const at of decisionPoints(table.axes)) {
    const covering = table.cells.filter((cell) => regionCovers(cell.region, at));
    if (covering.length === 0) problems.push(`no cell covers ${pointName(at)}`);
    if (covering.length > 1) problems.push(`${pointName(at)} is covered by ${covering.length} cells: ${covering.map(({ id }) => id).join(", ")}`);
  }
  if (problems.length > 0) return problems;
  for (const at of decisionPoints(table.axes)) {
    const decision = decide(table, at);
    for (const invariant of invariants) {
      if (invariant.when(decision)) problems.push(`cell ${decision.cell} at ${pointName(at)}: ${invariant.refuse}`);
    }
  }
  return problems;
}

function axisProblems(axes: DecisionAxes): string[] {
  const problems: string[] = [];
  if (Object.keys(axes).length === 0) problems.push("a decision table needs at least one axis");
  for (const [axis, values] of Object.entries(axes)) {
    if (!isSymbol(axis)) problems.push(`axis '${axis}' is not a plain name`);
    if (values.length === 0) problems.push(`axis '${axis}' has no values`);
    if (new Set(values).size !== values.length) problems.push(`axis '${axis}' lists a value twice`);
    for (const value of values) if (!isSymbol(value)) problems.push(`axis '${axis}' value '${value}' is not a plain name`);
  }
  return problems;
}

function derivedProblems(axes: DecisionAxes, derived: DerivedAxes<DecisionAxes>): string[] {
  const problems: string[] = [];
  for (const [axis, fact] of Object.entries(derived)) {
    if (fact === undefined) continue;
    const values = axes[axis];
    if (values === undefined) {
      problems.push(`derived axis '${axis}' is not an axis of the table`);
      continue;
    }
    if (fact.source.trim() === "") problems.push(`derived axis '${axis}' names no source`);
    const pair = [fact.inside, fact.outside];
    if (values.length !== 2 || fact.inside === fact.outside || !pair.every((value) => values.includes(value))) {
      problems.push(`derived axis '${axis}' must have exactly its two values, inside and outside the window: has ${values.join(", ")}`);
    }
    if (!Number.isInteger(fact.windowMs) || fact.windowMs <= 0) problems.push(`derived axis '${axis}' window ${fact.windowMs} ms is not a positive whole number`);
    if (fact.startsOn.length === 0) problems.push(`derived axis '${axis}' names nothing that starts its window`);
    for (const event of [...fact.startsOn, ...fact.restartsOn, ...fact.endsOn]) {
      if (!/^[a-z][a-z0-9.-]*$/u.test(event)) problems.push(`derived axis '${axis}' event '${event}' is not a plain event name`);
    }
  }
  return problems;
}

function columnProblems(columns: DecisionColumns): string[] {
  const problems: string[] = [];
  if (Object.keys(columns).length === 0) problems.push("a decision table needs at least one column");
  const listProblems = (owner: string, values: readonly string[]) => {
    if (values.length === 0) problems.push(`${owner} has no values`);
    if (new Set(values).size !== values.length) problems.push(`${owner} lists a value twice`);
  };
  for (const [name, column] of Object.entries(columns)) {
    if (column.kind === "choice") listProblems(`column '${name}'`, column.values);
    if (column.kind === "per-choice") {
      listProblems(`column '${name}' choices`, column.choices);
      if (column.value.kind === "choice") listProblems(`column '${name}' values`, column.value.values);
    }
    if (column.kind === "record" && Object.keys(column.fields).length === 0) problems.push(`column '${name}' has no fields`);
  }
  return problems;
}

function regionProblems(axes: DecisionAxes, cell: DecisionCell): string[] {
  const problems: string[] = [];
  for (const [axis, covered] of Object.entries(cell.region as Record<string, unknown>)) {
    const declared = axes[axis];
    if (declared === undefined) {
      problems.push(`cell ${cell.id} names axis '${axis}', which the table does not declare`);
      continue;
    }
    if (typeof covered === "function") {
      problems.push(`cell ${cell.id} covers ${axis} with a function; a region is data`);
      continue;
    }
    const values = valuesOf(covered as string | readonly string[]);
    if (values.length === 0) problems.push(`cell ${cell.id} covers no value of '${axis}', so it can never decide`);
    for (const value of values) {
      if (!declared.includes(value)) problems.push(`cell ${cell.id} names ${axis} '${value}', not one of ${declared.join(", ")}`);
    }
  }
  return problems;
}

function valueProblems(columns: DecisionColumns, cell: DecisionCell): string[] {
  const values = cell.values as Record<string, unknown>;
  const problems = Object.keys(values)
    .filter((name) => columns[name] === undefined)
    .map((name) => `cell ${cell.id} sets '${name}', which is not a column`);
  for (const [name, column] of Object.entries(columns)) {
    if (!(name in values)) {
      problems.push(`cell ${cell.id} has no value for '${name}'`);
      continue;
    }
    const wrong = columnValueProblem(column, values[name]);
    if (wrong !== undefined) problems.push(`cell ${cell.id} '${name}' ${wrong}`);
  }
  return problems;
}

/** Why [value] is not a value of [column], or undefined when it is. */
function columnValueProblem(column: DecisionColumn, value: unknown): string | undefined {
  if (typeof value === "function") return "is a function; a cell is data";
  switch (column.kind) {
    case "choice":
      return typeof value === "string" && column.values.includes(value)
        ? undefined : `is ${describe(value)}, not one of ${column.values.join(", ")}`;
    case "boolean":
      return typeof value === "boolean" ? undefined : `is ${describe(value)}, not a boolean`;
    case "integer":
      return Number.isInteger(value) ? undefined : `is ${describe(value)}, not an integer`;
    case "record":
      return recordValueProblem(column, value);
    case "per-choice":
      return perChoiceValueProblem(column, value);
  }
}

function recordValueProblem(column: RecordColumn, value: unknown): string | undefined {
  if (!isPlainObject(value)) return `is ${describe(value)}, not a record of ${Object.keys(column.fields).join(", ")}`;
  const extra = Object.keys(value).filter((field) => column.fields[field] === undefined);
  if (extra.length > 0) return `has field ${extra.join(", ")}, not one of ${Object.keys(column.fields).join(", ")}`;
  for (const [field, fieldColumn] of Object.entries(column.fields)) {
    if (!(field in value)) return `has no field '${field}'`;
    const wrong = columnValueProblem(fieldColumn, value[field]);
    if (wrong !== undefined) return `field '${field}' ${wrong}`;
  }
  return undefined;
}

function perChoiceValueProblem(column: PerChoiceColumn, value: unknown): string | undefined {
  if (!isPlainObject(value)) return columnValueProblem(column.value, value);
  const unknown = Object.keys(value).filter((key) => !column.choices.includes(key));
  if (unknown.length > 0) return `names ${unknown.join(", ")}, not one of the choices ${column.choices.join(", ")}`;
  for (const key of column.choices) {
    if (!(key in value)) return `says nothing for choice ${key}`;
    const wrong = columnValueProblem(column.value, value[key]);
    if (wrong !== undefined) return `under ${key} ${wrong}`;
  }
  return undefined;
}

function valuesOf(covered: string | readonly string[]): readonly string[] {
  return typeof covered === "string" ? [covered] : covered;
}

function pointName(point: Readonly<Record<string, string>>): string {
  return Object.entries(point).map(([axis, value]) => `${axis}=${value}`).join(" ");
}

function isSymbol(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/u.test(name);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  return typeof value === "string" ? `'${value}'` : JSON.stringify(value) ?? String(value);
}
