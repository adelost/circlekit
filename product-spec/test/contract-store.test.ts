import assert from 'node:assert/strict';
import test from 'node:test';
import { ContractPayloadError, contractRef, contractStore, contractStoreSamples, field, finiteValueRef, finiteValues, listOf,
  proveContractStore, readContractPayload, type ContractPayload, type ContractStore, type ContractStoreProbe, type LegoContract,
  type LegoFiniteValueDeclaration } from '../src/index.js';

// contractStore keeps one wire contract in one SQL table: refused at declaration when a field could not be kept, read
// back through the contract, and proven against the product's own table and write path by one generated proof.

const sizes = finiteValues('shop.size', ['S', 'M', 'L']);
const address = { id: 'shop.address', kind: 'snapshot', boundary: 'wire',
  fields: [field('street', 'string'), field('floor', 'integer', { nullable: true, min: 0, max: 200 })] } as const;
/** Every field kind: the first four in columns, a boolean, a list, a nested record and an optional nullable in rest. */
const order = { id: 'shop.order', kind: 'event', boundary: 'wire', fields: [
  field('sequence', 'integer', { min: 0 }), field('size', finiteValueRef('shop.size')),
  field('tipPercent', 'number', { nullable: true, min: 0, max: 100 }), field('coupon', 'string', { optional: true }),
  field('express', 'boolean'), field('notes', listOf('string'), { optional: true }),
  field('deliverTo', contractRef(address), { nullable: true }), field('day', 'string', { optional: true, nullable: true }),
] } as const;
const orderColumns = { sequence: 'sequence', size: 'size', tipPercent: 'tip_percent', coupon: 'coupon' } as const;
const orders = contractStore(order, [sizes], { table: 'shop_orders', columns: orderColumns, rest: 'rest_json' });

/** A live point whose first four fields were born with columns; headingDeg, declared later, lives in rest. */
const point = { id: 'live.point', kind: 'observation', boundary: 'wire', unknownFields: 'ignore', fields: [
  field('sequence', 'integer', { min: 0 }), field('latitude', 'number', { min: -90, max: 90 }),
  field('longitude', 'number', { min: -180, max: 180 }), field('phase', 'string', { nullable: true }),
  field('headingDeg', 'number', { optional: true, min: 0, max: 360 })] } as const;
const points = contractStore(point, [], { table: 'latest_points',
  columns: { sequence: 'sequence', latitude: 'latitude', longitude: 'longitude', phase: 'phase' }, rest: 'rest_json' });

type Values = readonly LegoFiniteValueDeclaration[];
/** A SQL table in memory: the route reads the body, a write keeps one cell per column, a read hands the row back. */
const roundTrip = <C extends LegoContract, V extends Values>(store: ContractStore<C, V>, payload: unknown,
  keep = (cells: readonly unknown[]) => cells) => {
  const cells = keep(store.cells(readContractPayload(store.contract, payload, store.finiteValues)));
  return store.payload(Object.fromEntries(store.columns.map((column, index) => [column, cells[index]])));
};
const tableOf = <C extends LegoContract, V extends Values>(store: ContractStore<C, V>) =>
  store.columns.map((name, index) => ({ name, type: store.types[index]! }));
const probe = <C extends LegoContract, V extends Values>(store: ContractStore<C, V>,
  overrides: Partial<ContractStoreProbe> = {}): ContractStoreProbe => ({
  columnsOf: async () => tableOf(store), roundTrip: async (payload) => roundTrip(store, payload), ...overrides });

type Order = Parameters<typeof orders.cells>[0];
const fullOrder: Order = { sequence: 7, size: 'M', tipPercent: 12.5, coupon: 'TEA', express: true, notes: ['ring twice'],
  deliverTo: { street: 'Main 1', floor: null }, day: null };
const bareOrder: Order = { sequence: 8, size: 'S', tipPercent: null, express: false, deliverTo: null };
const released: Parameters<typeof points.cells>[0] = { sequence: 1790848805123, latitude: 56.18, longitude: 12.5, phase: null };

test('a store keeps each column field in its column and every other field in one JSON rest column', () => {
  assert.deepEqual(orders.columns, ['sequence', 'size', 'tip_percent', 'coupon', 'rest_json']);
  assert.deepEqual(orders.types, ['INTEGER', 'TEXT', 'REAL', 'TEXT', 'TEXT']);
  assert.deepEqual(orders.cells(fullOrder), [7, 'M', 12.5, 'TEA',
    '{"express":true,"notes":["ring twice"],"deliverTo":{"street":"Main 1","floor":null},"day":null}']);
  assert.deepEqual(orders.cells(bareOrder), [8, 'S', null, null, '{"express":false,"deliverTo":null}']);
  assert.deepEqual(points.cells(released), [1790848805123, 56.18, 12.5, null, null], 'a point with no rest field leaves rest NULL');
  assert.deepEqual(points.cells({ ...released, headingDeg: 90 }), [1790848805123, 56.18, 12.5, null, '{"headingDeg":90}']);
});

test('a row reads back as exactly what was written: an absent key stays absent and null stays null', () => {
  for (const sent of [fullOrder, bareOrder]) assert.deepEqual(roundTrip(orders, sent), sent);
  for (const sent of [released, { ...released, headingDeg: 90 }]) assert.deepEqual(roundTrip(points, sent), sent);
  assert.equal('coupon' in (roundTrip(orders, bareOrder) as object), false);
});

test('a rest key the contract does not declare is decided by the contract: ignored, or refused', () => {
  const row = { ...released, rest_json: '{"headingDeg":90,"speedMs":52.4}' };
  assert.deepEqual(points.payload(row), { ...released, headingDeg: 90 });
  const stored = { sequence: 8, size: 'S', tip_percent: null, coupon: null, rest_json: '{"express":false,"deliverTo":null,"colour":1}' };
  assert.throws(() => orders.payload(stored), { message: "contract store 'shop_orders' of 'shop.order': a stored row breaks the "
    + "contract: contract 'shop.order' has undeclared field 'colour'" });
});

test('lost names the first declared field whose presence or value was not kept', () => {
  assert.equal(points.lost({ ...released, headingDeg: 90 }, released), 'headingDeg');
  assert.equal(points.lost(released, { ...released, phase: 'FREEFALL' }), 'phase');
  assert.equal(points.lost({ ...released, headingDeg: 90 }, { ...released, headingDeg: 90 }), undefined);
});

test('a payload the contract refuses is never stored: NaN, Infinity, undefined and an undeclared nested key', () => {
  const refused = <C extends LegoContract, V extends Values>(store: ContractStore<C, V>, payload: unknown, message: string) =>
    assert.throws(() => store.cells(payload as ContractPayload<C, V>),
    (error: Error) => !(error instanceof ContractPayloadError) && error.message === message);
  const point = "contract store 'latest_points' of 'live.point': the payload to store breaks the contract: "
    + "contract 'live.point' field 'headingDeg' must be number";
  for (const headingDeg of [NaN, Infinity, undefined]) refused(points, { ...released, headingDeg }, point);
  refused(orders, { ...fullOrder, deliverTo: { street: 'Main 1', floor: null, gate: 'B' } }, "contract store 'shop_orders' of "
    + "'shop.order': the payload to store breaks the contract: contract 'shop.address' has undeclared field 'gate'");
});

test('the rest cell holds only declared fields, in contract order', () => {
  assert.equal(points.cells({ headingDeg: 90, speedMs: 52.4, ...released } as never).at(-1), '{"headingDeg":90}');
  const reversed = Object.fromEntries(Object.entries(fullOrder).reverse()) as Order;
  assert.equal(orders.cells(reversed).at(-1), '{"express":true,"notes":["ring twice"],"deliverTo":{"street":"Main 1","floor":null},"day":null}');
});

const refusals: readonly (readonly [string, () => unknown, string])[] = [
  ['a contract that is not wire', () => contractStore({ ...address, boundary: 'presentation' }, [],
    { table: 'shop_addresses', columns: { street: 'street', floor: 'floor' } }),
  "contract store 'shop_addresses' of 'shop.address': a store keeps a wire contract, and 'shop.address' has boundary 'presentation'"],
  ['E1 a table name that is not plain SQL', () => contractStore(order, [sizes], { table: 'Shop Orders', columns: orderColumns, rest: 'rest_json' }),
    "contract store 'Shop Orders' of 'shop.order': 'Shop Orders' is not a plain SQL name"],
  ['E1 a column name that is not plain SQL', () => contractStore(order, [sizes], { table: 'shop_orders',
    columns: { ...orderColumns, tipPercent: 'tip-percent' }, rest: 'rest_json' }),
  "contract store 'shop_orders' of 'shop.order': 'tip-percent' is not a plain SQL name"],
  ['E1 a rest name that is not plain SQL', () => contractStore(order, [sizes], { table: 'shop_orders', columns: orderColumns, rest: 'rest json' }),
    "contract store 'shop_orders' of 'shop.order': 'rest json' is not a plain SQL name"],
  ['E2 a column for a field the contract does not declare', () => contractStore(order, [sizes], { table: 'shop_orders',
    columns: { ...orderColumns, colour: 'colour' } as never, rest: 'rest_json' }),
  "contract store 'shop_orders' of 'shop.order' keeps 'colour' in a column, but the contract declares no such field"],
  ['E3 two fields in one column', () => contractStore(order, [sizes], { table: 'shop_orders',
    columns: { ...orderColumns, coupon: 'sequence' }, rest: 'rest_json' }),
  "contract store 'shop_orders' of 'shop.order' keeps two values in column 'sequence'"],
  ['E3 a field in the rest column', () => contractStore(order, [sizes], { table: 'shop_orders', columns: orderColumns, rest: 'coupon' }),
    "contract store 'shop_orders' of 'shop.order' keeps two values in column 'coupon'"],
  ['E4 a list in a column', () => contractStore(order, [sizes], { table: 'shop_orders', columns: { notes: 'notes' }, rest: 'rest_json' }),
    "contract store 'shop_orders' of 'shop.order' field 'notes' is a list or a record: keep it in the rest column"],
  ['E4 a nested record in a column', () => contractStore(order, [sizes], { table: 'shop_orders', columns: { deliverTo: 'deliver_to' },
    rest: 'rest_json' }), "contract store 'shop_orders' of 'shop.order' field 'deliverTo' is a list or a record: keep it in the rest column"],
  ['E5 a boolean in a column', () => contractStore(order, [sizes], { table: 'shop_orders', columns: { express: 'express' }, rest: 'rest_json' }),
    "contract store 'shop_orders' of 'shop.order' field 'express' is boolean, which SQL returns as 0 or 1: keep it in the rest column"],
  ['E6 an optional nullable field in a column', () => contractStore(order, [sizes], { table: 'shop_orders', columns: { day: 'day' },
    rest: 'rest_json' }), "contract store 'shop_orders' of 'shop.order' field 'day' is optional and nullable, and one NULL cannot say "
    + 'both: keep it in the rest column'],
  ['E7 a field with no column and no rest column', () => contractStore(order, [sizes], { table: 'shop_orders', columns: orderColumns } as never),
    "contract store 'shop_orders' of 'shop.order' has no column for field 'express' and no rest column: give it a column with an "
    + 'additive migration, or declare rest'],
];

for (const [law, declare, message] of refusals) {
  test(`a declaration is refused by name: ${law}`, () => assert.throws(declare, { message }));
}

// Compiled with the public API: the type checker refuses the same holes before the declaration runs.
function storeTypeProof() {
  // @ts-expect-error a misspelt column key names no field of the contract
  const misspelt = contractStore(point, [], { table: 'latest_points', columns: { sequnce: 'sequence' }, rest: 'rest_json' });
  // @ts-expect-error without a rest column, every field needs its own column
  const homeless = contractStore(point, [], { table: 'latest_points', columns: { sequence: 'sequence', latitude: 'latitude',
    longitude: 'longitude', phase: 'phase' } });
  const read: ContractPayload<typeof point> = points.payload({});
  const heading: number | undefined = read.headingDeg;
  return { misspelt, homeless, heading };
}
void storeTypeProof;

test('a stored row the contract refuses is a storage fault, never a payload fault a route answers 400 for', () => {
  const fault = (row: Record<string, unknown>, message: string) => assert.throws(() => points.payload(row),
    (error: Error) => !(error instanceof ContractPayloadError) && error.message === message);
  const prefix = "contract store 'latest_points' of 'live.point'";
  fault({ ...released }, `${prefix}: the row has no column 'rest_json'; select store.columns`);
  fault({ ...released, latitude: null, rest_json: null },
    `${prefix}: a stored row breaks the contract: contract 'live.point' field 'latitude' must be number`);
  fault({ ...released, rest_json: '[90]' }, `${prefix}: a stored row breaks the contract: rest column 'rest_json' holds no JSON object`);
  fault({ ...released, rest_json: '{"latitude":3}' },
    `${prefix}: a stored row breaks the contract: rest column 'rest_json' holds 'latitude', which column 'latitude' keeps`);
  assert.throws(() => points.payload({ ...released, rest_json: '{' }), { message: /^contract store 'latest_points' of 'live\.point': a stored row breaks the contract: rest column 'rest_json' holds no JSON: /u });
});

test('the proof passes a table and a write path that keep every field, reading a column type by its SQLite affinity', async () => {
  await proveContractStore(orders, probe(orders));
  const declared = ['BIGINT', 'VARCHAR(8)', 'DOUBLE PRECISION', 'text', 'TEXT'];
  await proveContractStore(orders, probe(orders, { columnsOf: async () => tableOf(orders).map((column, index) => ({ ...column, type: declared[index]! })) }));
  await proveContractStore(points, probe(points));
});

test('the proof refuses a table without a column the store keeps (P1)', async () => {
  await assert.rejects(proveContractStore(points, probe(points, { columnsOf: async () => tableOf(points).slice(0, -1) })),
    { message: "table 'latest_points' has no column 'rest_json', where the store keeps 'live.point': add an additive migration and "
      + 'install it with the test schema' });
});

test('the proof refuses a column whose type cannot keep its value (P2)', async () => {
  const text = tableOf(orders).map((column) => column.name === 'tip_percent' ? { ...column, type: 'TEXT' } : column);
  await assert.rejects(proveContractStore(orders, probe(orders, { columnsOf: async () => text })),
    { message: "table 'shop_orders' column 'tip_percent' is TEXT, and the store keeps a REAL value there" });
});

test('the proof refuses a write path that does not keep a field (P3)', async () => {
  const dropsRest = (payload: unknown) => roundTrip(points, payload, (cells) => [...cells.slice(0, -1), null]);
  await assert.rejects(proveContractStore(points, probe(points, { roundTrip: async (payload) => dropsRest(payload) })),
    { message: "table 'latest_points' did not keep field 'headingDeg' of 'live.point': wrote 5.625, read back nothing" });
});

test('the samples give every number its own value, so a swapped latitude and longitude cannot pass', async () => {
  const { full, bare } = contractStoreSamples(points);
  assert.deepEqual(full, { sequence: 1, latitude: -87.1875, longitude: -174.375, phase: 'sample phase', headingDeg: 5.625 });
  assert.deepEqual(bare, { sequence: 1, latitude: -87.1875, longitude: -174.375, phase: null });
  const swaps = (payload: unknown) => roundTrip(points, payload, ([sequence, latitude, longitude, ...rest]) => [sequence, longitude, latitude, ...rest]);
  await assert.rejects(proveContractStore(points, probe(points, { roundTrip: async (payload) => swaps(payload) })),
    { message: "contract store 'latest_points' of 'live.point': a stored row breaks the contract: contract 'live.point' field "
      + "'latitude'=-174.375 violates -90..90" });
});

test('numbers in one narrow range sample apart, so a write path that swaps two of them cannot pass', async () => {
  const paint = { id: 'paint.colour', kind: 'snapshot', boundary: 'wire', fields: [field('red', 'number', { min: 0, max: 1 }),
    field('green', 'number', { min: 0, max: 1 }), field('blue', 'number', { min: 0, max: 1 })] } as const;
  const colours = contractStore(paint, [], { table: 'paints', columns: { red: 'red', green: 'green', blue: 'blue' } });
  assert.deepEqual(contractStoreSamples(colours).full, { red: 0.015625, green: 0.03125, blue: 0.046875 });
  const swaps = (payload: unknown) => roundTrip(colours, payload, ([red, green, blue]) => [red, blue, green]);
  await assert.rejects(proveContractStore(colours, probe(colours, { roundTrip: async (payload) => swaps(payload) })),
    { message: "table 'paints' did not keep field 'green' of 'paint.colour': wrote 0.03125, read back 0.046875" });
});

test('the narrowest range takes its value first, and a range too narrow for its fields is a named error, never a repeat', () => {
  const versions = { id: 'api.versions', kind: 'snapshot', boundary: 'wire', fields: [field('sequence', 'integer', { min: 0 }),
    field('schemaVersion', 'integer', { min: 1, max: 1 })] } as const;
  const columns = { sequence: 'sequence', schemaVersion: 'schema_version' } as const;
  assert.deepEqual(contractStoreSamples(contractStore(versions, [], { table: 'versions', columns })).full,
    { sequence: 2, schemaVersion: 1 });
  const crowded = { ...versions, fields: [...versions.fields, field('apiVersion', 'integer', { min: 1, max: 1 })] } as const;
  assert.throws(() => contractStoreSamples(contractStore(crowded, [], { table: 'versions',
    columns: { ...columns, apiVersion: 'api_version' } })), { message: "contract store 'versions' of 'api.versions' cannot give "
    + "field 'apiVersion' a sample no other field holds: 1..1 is too narrow for every field to differ" });
});

test('a field whose gteField names a later field is sampled after it, so the contract stays provable', async () => {
  const span = { id: 'jump.span', kind: 'snapshot', boundary: 'wire', fields: [
    field('endMs', 'integer', { min: 0, gteField: 'startMs' }), field('startMs', 'integer', { min: 0 })] } as const;
  const spans = contractStore(span, [], { table: 'spans', columns: { endMs: 'end_ms', startMs: 'start_ms' } });
  assert.deepEqual(contractStoreSamples(spans).full, { endMs: 2, startMs: 1 });
  await proveContractStore(spans, probe(spans));
});
