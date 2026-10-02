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
  /** One cell per column: a field's value, NULL for an absent optional key; the rest fields present as one JSON object. */
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
      const record = payload as Readonly<Record<string, unknown>>;
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
 * absent and every nullable one null. Numbers are distinct whenever their ranges allow, so a swapped column shows.
 * WHY: A product test can leave a full row behind and check its own tombstone with the same samples.
 */
export function contractStoreSamples<const C extends LegoContract, const V extends Values>(
  store: ContractStore<C, V>): { readonly full: ContractPayload<C, V>; readonly bare: ContractPayload<C, V> } {
  const read = (shape: 'full' | 'bare') => {
    try {
      return readContractPayload(store.contract, sampleOf(store.contract, store.finiteValues, shape, new Set()), store.finiteValues);
    } catch (error) {
      throw new Error(`contract store '${store.table}' of '${store.contract.id}' has no ${shape} sample its contract accepts: `
        + (error as Error).message);
    }
  };
  return { full: read('full'), bare: read('bare') };
}

function sampleOf(contract: LegoContract, values: Values, shape: 'full' | 'bare', used: Set<unknown>): Record<string, unknown> {
  const sample: Record<string, unknown> = {};
  for (const field of contract.fields) {
    if (shape === 'bare' && field.optional === true) continue;
    const floor = field.gteField === undefined ? undefined : sample[field.gteField];
    sample[field.name] = shape === 'bare' && field.nullable ? null
      : valueSample(field, field.value, values, used, typeof floor === 'number' ? floor : -Infinity);
  }
  return sample;
}

/**
 * One field's sample: an integer from `(min ?? 0) + 1` upward and a number from `min + 0.25` upward, the first value
 * no other sample holds; `sample <name>` for a string, true, the last finite member not yet used, one list element,
 * a nested record's own full sample.
 */
function valueSample(field: LegoField, kind: LegoField['value'], values: Values, used: Set<unknown>, floor = -Infinity): unknown {
  if (kind === 'boolean') return true;
  if (kind === 'string') return `sample ${field.name}`;
  if (kind === 'integer' || kind === 'number') {
    const low = Math.max(field.min ?? (field.max === undefined ? 0 : Math.min(0, field.max - 64)), floor);
    for (let step = 0; step < 64; step += 1) {
      const value = (kind === 'integer' ? Math.ceil(low) + 1 : low + 0.25) + step;
      if (field.max !== undefined && value > field.max) break;
      if (used.has(value)) continue;
      used.add(value);
      return value;
    }
    return field.min ?? field.max ?? 0;
  }
  if (isListRef(kind)) return [valueSample(field, kind.list, values, used)];
  if (isContractRef(kind)) return sampleOf(kind.contract, values, 'full', used);
  if (!isFiniteRef(kind)) throw new Error(`field '${field.name}' holds opaque '${kind.ref}', which no store samples`);
  const members = values.find(({ id }) => id === kind.ref)?.values ?? [];
  const member = [...members].reverse().find((value) => !used.has(`${kind.ref}:${value}`)) ?? members.at(-1);
  used.add(`${kind.ref}:${member}`);
  return member;
}
