/**
 * How one wire contract is kept in one SQL table, derived from its declaration: the columns, the cells a write binds,
 * the payload a stored row reads back as, and one generated proof that a product's table and write path keep every
 * declared field. It builds no SQL statement: a product builds its own from `columns`, so no engine is involved.
 */
import { ContractPayloadError, readContractPayload } from './contract-law-model.js';
import type { ContractPayload } from './contract-payload.js';
import { isContractRef, isFiniteRef, isListRef, isRecord } from './field-kinds.js';
import { validateContract, type LegoContract, type LegoField, type LegoFiniteValueDeclaration } from './node-model.js';

type FieldName<C extends LegoContract> = C['fields'][number]['name'];
type Values = readonly LegoFiniteValueDeclaration[];
export type ContractStoreCell = string | number | null;
export type ContractStoreType = 'INTEGER' | 'REAL' | 'TEXT';

/**
 * WHAT: How one wire contract is kept in one SQL table. WHY: Columns, cells and the read back come from the
 * declaration, so no hand column list can leave a field out. With `rest`, each field without its own column is kept
 * in that one JSON column; without `rest`, every field needs a column, a type error otherwise.
 */
export type ContractStoreDeclaration<C extends LegoContract> =
  | { readonly table: string; readonly columns: { readonly [N in FieldName<C>]?: string }; readonly rest: string }
  | { readonly table: string; readonly columns: { readonly [N in FieldName<C>]: string }; readonly rest?: never };

export interface ContractStore<C extends LegoContract, V extends Values> {
  readonly contract: C;
  readonly finiteValues: V;
  readonly table: string;
  /** The column-kept fields' columns in contract order, then the rest column. */
  readonly columns: readonly string[];
  /** One per column: integer INTEGER, number REAL, string and finite TEXT, the rest column TEXT. */
  readonly types: readonly ContractStoreType[];
  /**
   * One cell per column, from the contract's own read of the payload: a field's value, NULL for an absent optional key,
   * the declared rest fields present as one JSON object in contract order. A payload the read refuses (NaN, an undeclared
   * nested key, an undefined value) is a plain Error naming the store, so no value is stored that could not come back.
   */
  cells(payload: ContractPayload<C, V>): readonly ContractStoreCell[];
  /** The payload a stored row holds, read by the contract; a row the contract refuses is a storage fault (plain Error). */
  payload(row: Readonly<Record<string, unknown>>): ContractPayload<C, V>;
  /** The first declared field whose presence or value differs between what was sent and what was kept. */
  lost(sent: ContractPayload<C, V>, kept: ContractPayload<C, V>): FieldName<C> | undefined;
}

const SQL_NAME = /^[a-z_][a-z0-9_]*$/u;

/** WHAT: Declares where one wire contract is kept, refusing a field it could not keep. WHY: An unkept field is a 500. */
export function contractStore<const C extends LegoContract, const V extends Values>(
  contract: C, finiteValues: V, declaration: ContractStoreDeclaration<C>): ContractStore<C, V> {
  validateContract(contract);
  const { table, rest } = declaration;
  const where = `contract store '${table}' of '${contract.id}'`;
  const named = Object.entries(declaration.columns as Readonly<Record<string, string | undefined>>)
    .filter((entry): entry is [string, string] => entry[1] !== undefined);
  refuseDeclaration(contract, where, table, named, rest);
  const columnOf = new Map(named);
  const kept = contract.fields.flatMap((field) => {
    const column = columnOf.get(field.name);
    return column === undefined ? [] : [{ field, column }];
  });
  const loose = contract.fields.filter((field) => !columnOf.has(field.name));
  const columns = [...kept.map(({ column }) => column), ...(rest === undefined ? [] : [rest])];
  const storageFault = (message: string) => new Error(`${where}: a stored row breaks the contract: ${message}`);
  const toStore = (payload: unknown): Readonly<Record<string, unknown>> => {
    try {
      return readContractPayload(contract, payload, finiteValues) as Readonly<Record<string, unknown>>;
    } catch (error) {
      if (error instanceof ContractPayloadError) throw new Error(`${where}: the payload to store breaks the contract: ${error.message}`);
      throw error;
    }
  };
  const restOf = (cell: unknown): readonly (readonly [string, unknown])[] => {
    if (cell === null) return [];
    let parsed: unknown;
    try {
      parsed = typeof cell === 'string' ? JSON.parse(cell) : undefined;
    } catch (error) {
      throw storageFault(`rest column '${rest}' holds no JSON: ${(error as Error).message}`);
    }
    if (!isRecord(parsed)) throw storageFault(`rest column '${rest}' holds no JSON object`);
    const twice = Object.keys(parsed).find((name) => columnOf.has(name));
    if (twice !== undefined) throw storageFault(`rest column '${rest}' holds '${twice}', which column '${columnOf.get(twice)}' keeps`);
    return Object.entries(parsed);
  };
  return {
    contract, finiteValues, table, columns,
    types: [...kept.map(({ field }) => sqlType(field)), ...(rest === undefined ? [] : ['TEXT' as const])],
    cells(payload) {
      const record = toStore(payload);
      const cells = kept.map(({ field }) => (Object.hasOwn(record, field.name) ? record[field.name] : null) as ContractStoreCell);
      if (rest === undefined) return cells;
      const present = loose.filter((field) => Object.hasOwn(record, field.name));
      return [...cells, present.length === 0 ? null
        : JSON.stringify(Object.fromEntries(present.map((field) => [field.name, record[field.name]])))];
    },
    payload(row) {
      const missing = columns.find((column) => !Object.hasOwn(row, column));
      if (missing !== undefined) throw new Error(`${where}: the row has no column '${missing}'; select store.columns`);
      const assembled = Object.fromEntries([
        ...kept.filter(({ field, column }) => !(row[column] === null && field.optional === true))
          .map(({ field, column }) => [field.name, row[column]] as const),
        ...(rest === undefined ? [] : restOf(row[rest])),
      ]);
      try {
        return readContractPayload(contract, assembled, finiteValues);
      } catch (error) {
        if (error instanceof ContractPayloadError) throw storageFault(error.message);
        throw error;
      }
    },
    lost: (sent, back) => firstLost(contract, sent, back)?.name as FieldName<C> | undefined,
  };
}

/** The declaration refusals, each over the whole declaration before the next. */
function refuseDeclaration(contract: LegoContract, where: string, table: unknown,
  named: readonly (readonly [string, string])[], rest: unknown): void {
  if (contract.boundary !== 'wire') {
    throw new Error(`${where}: a store keeps a wire contract, and '${contract.id}' has boundary '${contract.boundary}'`);
  }
  const used = [...named.map(([, column]) => column), ...(rest === undefined ? [] : [rest])];
  const unplain = [table, ...used].findIndex((name) => typeof name !== 'string' || !SQL_NAME.test(name));
  if (unplain >= 0) throw new Error(`${where}: '${String([table, ...used][unplain])}' is not a plain SQL name`);
  const declared = new Set(contract.fields.map((field) => field.name));
  const unknown = named.find(([name]) => !declared.has(name));
  if (unknown !== undefined) throw new Error(`${where} keeps '${unknown[0]}' in a column, but the contract declares no such field`);
  const twice = used.find((column, index) => used.indexOf(column) !== index);
  if (twice !== undefined) throw new Error(`${where} keeps two values in column '${String(twice)}'`);
  const kept = contract.fields.filter((field) => named.some(([name]) => name === field.name));
  const refuse = (breaks: (field: LegoField) => boolean, tail: string) => {
    const field = kept.find(breaks);
    if (field !== undefined) throw new Error(`${where} field '${field.name}' ${tail}`);
  };
  refuse((field) => isListRef(field.value) || isContractRef(field.value), 'is a list or a record: keep it in the rest column');
  refuse((field) => field.value === 'boolean', 'is boolean, which SQL returns as 0 or 1: keep it in the rest column');
  refuse((field) => field.optional === true && field.nullable,
    'is optional and nullable, and one NULL cannot say both: keep it in the rest column');
  const homeless = rest === undefined ? contract.fields.find((field) => !kept.includes(field)) : undefined;
  if (homeless !== undefined) throw new Error(`${where} has no column for field '${homeless.name}' and no rest column: `
    + 'give it a column with an additive migration, or declare rest');
}

/** After the refusals a column holds an integer, a number, a string or a finite member. */
const sqlType = (field: LegoField): ContractStoreType =>
  field.value === 'integer' ? 'INTEGER' : field.value === 'number' ? 'REAL' : 'TEXT';

/** A field's value as JSON, or `nothing` when the key is absent. */
const shown = (record: unknown, name: string): string =>
  isRecord(record) && Object.hasOwn(record, name) ? JSON.stringify(record[name]) : 'nothing';

/** The first declared field whose presence or JSON value differs between two records. */
const firstLost = (contract: LegoContract, sent: unknown, kept: unknown): LegoField | undefined =>
  contract.fields.find((field) => shown(sent, field.name) !== shown(kept, field.name));

/** What a proof reads from the product: its table's columns and its own write path. */
export interface ContractStoreProbe {
  /** The table's columns as the database reports them, such as SQLite's `SELECT name,type FROM pragma_table_info(?1)`. */
  columnsOf(table: string): Promise<readonly { readonly name: string; readonly type: string }[]>;
  /** The product's own write of `payload`, then what that write reports it kept. */
  roundTrip(payload: Readonly<Record<string, unknown>>): Promise<unknown>;
}

/**
 * WHAT: Proves one store: each column exists at its type, and every declared field comes back, once with every
 * field present and once with every optional field absent and every nullable one null. WHY: One proof per store
 * declaration; a field declared tomorrow is in the samples the moment it is declared.
 */
export async function proveContractStore<const C extends LegoContract, const V extends Values>(
  store: ContractStore<C, V>, probe: ContractStoreProbe): Promise<void> {
  const { table, contract } = store;
  const actual = new Map((await probe.columnsOf(table)).map(({ name, type }) => [name.toLowerCase(), type]));
  store.columns.forEach((column, index) => {
    const type = actual.get(column), expected = store.types[index]!;
    if (type === undefined) throw new Error(`table '${table}' has no column '${column}', where the store keeps '${contract.id}': `
      + 'add an additive migration and install it with the test schema');
    if (affinity(type) !== expected) throw new Error(`table '${table}' column '${column}' is ${type}, and the store keeps a ${expected} value there`);
  });
  const { full, bare } = contractStoreSamples(store);
  for (const sample of [full, bare] as readonly unknown[]) {
    const back = await probe.roundTrip(sample as Readonly<Record<string, unknown>>);
    const lost = firstLost(contract, sample, back);
    if (lost !== undefined) throw new Error(`table '${table}' did not keep field '${lost.name}' of '${contract.id}': `
      + `wrote ${shown(sample, lost.name)}, read back ${shown(back, lost.name)}`);
  }
}

/** SQLite's affinity of a declared column type (sqlite.org/datatype3.html 3.1), so INT and BIGINT keep an INTEGER. */
function affinity(declared: string): string {
  const type = declared.toUpperCase();
  if (type.includes('INT')) return 'INTEGER';
  if (/CHAR|CLOB|TEXT/u.test(type)) return 'TEXT';
  if (type === '' || type.includes('BLOB')) return 'BLOB';
  return /REAL|FLOA|DOUB/u.test(type) ? 'REAL' : 'NUMERIC';
}

/**
 * WHAT: The two payloads the proof writes: `full` with every declared field set, `bare` with every optional field
 * absent and every nullable one null. Every top-level number and finite member differs from every other, so a swapped
 * column shows; a range too narrow for that is a named error, never a repeat.
 * WHY: A product test can leave a full row behind and check its own tombstone with the same samples.
 */
export function contractStoreSamples<const C extends LegoContract, const V extends Values>(
  store: ContractStore<C, V>): { readonly full: ContractPayload<C, V>; readonly bare: ContractPayload<C, V> } {
  const where = `contract store '${store.table}' of '${store.contract.id}'`;
  const read = (shape: 'full' | 'bare') => {
    const sample = sampleOf(store.contract, store.finiteValues, shape, where, new Set());
    try {
      return readContractPayload(store.contract, sample, store.finiteValues);
    } catch (error) {
      throw new Error(`${where} has no ${shape} sample its contract accepts: ${(error as Error).message}`);
    }
  };
  return { full: read('full'), bare: read('bare') };
}

/**
 * One sample record. The narrowest range takes its value first, and the field a gteField names is sampled before the
 * field that names it. `used` keeps the record's values apart; a nested record or list element lives in the rest
 * column, where no column can swap it, so it takes its first value.
 */
function sampleOf(contract: LegoContract, values: Values, shape: 'full' | 'bare', where: string,
  used?: Set<unknown>): Record<string, unknown> {
  const fields = new Map(contract.fields.map((field) => [field.name, field]));
  const sample = new Map<string, unknown>();
  const visit = (field: LegoField, waiting: readonly string[]): void => {
    if (sample.has(field.name) || shape === 'bare' && field.optional === true) return;
    const sibling = field.gteField === undefined ? undefined : fields.get(field.gteField);
    if (sibling !== undefined && !waiting.includes(sibling.name)) visit(sibling, [...waiting, field.name]);
    const floor = sibling === undefined ? undefined : sample.get(sibling.name);
    sample.set(field.name, shape === 'bare' && field.nullable ? null
      : valueSample(field, field.value, values, where, used, typeof floor === 'number' ? floor : -Infinity));
  };
  [...contract.fields].sort((a, b) => width(a) - width(b) || 0).forEach((field) => visit(field, []));
  return Object.fromEntries(contract.fields.filter((field) => sample.has(field.name))
    .map((field) => [field.name, sample.get(field.name)]));
}

/** How wide a field's range is; a field without both bounds is infinitely wide. */
const width = (field: LegoField): number => (field.max ?? Infinity) - (field.min ?? -Infinity);

/** One field's sample: the first choice no other sample in the record holds; `sample <name>`, true, one element. */
function valueSample(field: LegoField, kind: LegoField['value'], values: Values, where: string, used: Set<unknown> | undefined,
  floor = -Infinity): unknown {
  if (kind === 'boolean') return true;
  if (kind === 'string') return `sample ${field.name}`;
  if (isListRef(kind)) return [valueSample(field, kind.list, values, where, undefined)];
  if (isContractRef(kind)) return sampleOf(kind.contract, values, 'full', where);
  const choices = choicesOf(field, kind, values, where, floor);
  if (choices === undefined) return undefined; // a finite declaration was not passed: the contract's read names it
  const free = choices.values.find((value) => used === undefined || !used.has(value));
  if (free === undefined) throw new Error(`${where} cannot give field '${field.name}' a sample no other field holds: `
    + `${choices.range} is too narrow for every field to differ`);
  used?.add(free);
  return free;
}

/** What a number or a finite field may sample, best first, and its range as a refusal names it. */
function choicesOf(field: LegoField, kind: LegoField['value'], values: Values, where: string, floor: number):
  { readonly values: readonly unknown[]; readonly range: string } | undefined {
  if (kind === 'integer' || kind === 'number') {
    return { values: numberCandidates(field, kind, floor), range: `${field.min ?? '-∞'}..${field.max ?? '∞'}` };
  }
  if (typeof kind === 'string' || !isFiniteRef(kind)) {
    throw new Error(`${where} field '${field.name}' holds '${typeof kind === 'string' ? kind : kind.ref}', which no store samples`);
  }
  const members = values.find(({ id }) => id === kind.ref)?.values ?? [];
  return members.length === 0 ? undefined : { values: [...members].reverse(), range: `finite '${kind.ref}'` };
}

/**
 * A number's candidates, best first, inside its range and at or above the field its gteField names: an integer counts
 * up from its low end + 1 and ends on the low end; a bounded number takes `low + (max - low) * k / 64` from k = 1 and
 * ends on `low`; a number without max counts up from `low + 0.25`.
 */
function numberCandidates(field: LegoField, kind: 'integer' | 'number', floor: number): readonly number[] {
  const max = field.max;
  const low = Math.max(field.min ?? (max === undefined ? 0 : Math.min(0, max - 64)), floor);
  const steps = Array.from({ length: 64 }, (_, step) => step);
  const candidates = kind === 'integer' ? [...steps.map((step) => Math.ceil(low) + 1 + step), Math.ceil(low)]
    : max === undefined ? steps.map((step) => low + 0.25 + step)
      : [...steps.slice(1).map((k) => low + (max - low) * k / 64), low];
  return candidates.filter((value) => max === undefined || value <= max);
}
