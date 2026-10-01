import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContractPayload, contractFingerprint, contractRef, defineProductLibraryCatalog, field, finiteSetRef,
  finiteValueRef, finiteValues, readContractPayload, validateContract, valueRef, type ContractPayload, type LegoContract,
  type LegoField } from '../src/index.js';

// The wire laws of the C1 plan: what a finite value may be, set and nested fields, the unknown-field policy, optional
// keys, and one read that applies them all.

test('a finite value may hold capitals and colons, as wire values are written', () => {
  assert.deepEqual(finiteValues('device.scope', ['jumps:read', 'jumps:write']).values, ['jumps:read', 'jumps:write']);
  assert.deepEqual(finiteValues('live.sharing', ['ON', 'OFF', 'wear-os', 'v1.0', 'snake_case']).values,
    ['ON', 'OFF', 'wear-os', 'v1.0', 'snake_case']);
});

test('a finite value refuses whitespace, control characters and any character outside the closed rule', () => {
  for (const value of ['jumps read', 'ON\n', 'ON\u0000', '\tON', 'O N', '', ':read', '1st', 'jumps/read', 'é']) {
    assert.throws(() => finiteValues('device.scope', [value]), /value in finite declaration 'device\.scope' has invalid wire value/u);
  }
});

test('a finite declaration id keeps the id rule', () => {
  assert.throws(() => finiteValues('Device.Scope', ['ON']), /finite value declaration has invalid wire id 'Device\.Scope'/u);
});

test('a library catalog reads its finite values by the same value rule', () => {
  const library = (values: readonly string[]) => () => defineProductLibraryCatalog({ id: 'fixture-wire', contracts: [],
    nodeTypes: [], finiteValues: [{ id: 'live.sharing', values }] });
  assert.doesNotThrow(library(['ON', 'OFF']));
  assert.throws(library(['O N']), /value in finite declaration 'live\.sharing' has invalid wire value "O N"/u);
});

const scopes = finiteValues('device.scope', ['jumps:read', 'jumps:write']);
const access = { id: 'device.access', kind: 'event', boundary: 'wire',
  fields: [field('scopes', finiteSetRef(scopes.id))] } as const;
const scopesOf = (value: unknown) => () => assertContractPayload(access, { scopes: value }, [scopes]);

test('a finite set accepts distinct declared members in any order, and the empty set', () => {
  for (const value of [['jumps:write'], ['jumps:write', 'jumps:read'], []]) assert.doesNotThrow(scopesOf(value));
});

test('a finite set refuses a repeated member', () => {
  assert.throws(scopesOf(['jumps:write', 'jumps:write']), /contract 'device\.access' field 'scopes' repeats 'jumps:write'/u);
});

test('a finite set refuses an undeclared or non-string member and a value that is not an array', () => {
  for (const value of [['jumps:admin'], [null], [1], ['jumps:write', 'JUMPS:READ']]) {
    assert.throws(scopesOf(value), /contract 'device\.access' field 'scopes' must belong to finite 'device\.scope'/u);
  }
  for (const value of ['jumps:write', { 0: 'jumps:write' }, null]) {
    assert.throws(scopesOf(value), /contract 'device\.access' field 'scopes' must be a set of finite 'device\.scope'/u);
  }
  assert.throws(() => assertContractPayload(access, { scopes: [] }), /finite 'device\.scope' needs exactly one nonempty value declaration/u);
});

test('a finite set is a wire field, and a set field is part of the contract identity', () => {
  assert.throws(() => validateContract({ ...access, boundary: 'service-internal' }),
    /contract 'device\.access' field 'scopes' is a finite set, which only a wire contract carries: use boundary 'wire'/u);
  const opaque = { ...access, boundary: 'service-internal', fields: [field('scopes', valueRef(scopes.id))] } as const;
  assert.notEqual(contractFingerprint(access), contractFingerprint({ ...opaque, boundary: 'wire' }));
});

// Compiled with the public API: a set field reads as a readonly array of its declared members.
function setTypeProof(input: unknown) {
  assertContractPayload(access, input, [scopes]);
  const members: readonly ('jumps:read' | 'jumps:write')[] = input.scopes;
  // @ts-expect-error a set is not one member
  const one: 'jumps:read' | 'jumps:write' = input.scopes;
  const payload: ContractPayload<typeof access, [typeof scopes]> = { scopes: ['jumps:read'] };
  // @ts-expect-error an undeclared member is not a set member
  const wrong: ContractPayload<typeof access, [typeof scopes]> = { scopes: ['jumps:admin'] };
  return { members, one, payload, wrong };
}
void setTypeProof;

const point = { id: 'live.point', kind: 'observation', boundary: 'wire',
  fields: [field('latitude', 'number', { min: -90, max: 90 }), field('phase', 'string', { nullable: true })] } as const;
const receipt = { id: 'live.receipt', kind: 'snapshot', boundary: 'wire', fields: [field('accepted', 'boolean'),
  field('position', contractRef(point)), field('previous', contractRef(point), { nullable: true })] } as const;
const receiptOf = (position: unknown, previous: unknown = null) => () =>
  assertContractPayload(receipt, { accepted: true, position, previous });

test('a nested record is checked by its own contract', () => {
  assert.doesNotThrow(receiptOf({ latitude: 56.18, phase: null }));
  assert.doesNotThrow(receiptOf({ latitude: 56.18, phase: null }, { latitude: -33.87, phase: 'canopy' }));
  assert.throws(receiptOf({ latitude: 91, phase: null }), /contract 'live\.point' field 'latitude'=91 violates -90\.\.90/u);
  assert.throws(receiptOf({ latitude: 1 }), /contract 'live\.point' is missing field 'phase'/u);
  assert.throws(receiptOf({ latitude: 1, phase: null, heading: 3 }), /contract 'live\.point' has undeclared field 'heading'/u);
  for (const position of [null, [], 'here', 3]) {
    assert.throws(receiptOf(position), /contract 'live\.receipt' field 'position' must be a 'live\.point' record/u);
  }
});

test('a nested contract is a wire contract inside a wire contract, checked by every wire law', () => {
  assert.throws(() => validateContract({ ...receipt, boundary: 'service-internal' }),
    /contract 'live\.receipt' field 'position' nests contract 'live\.point', which only a wire contract carries: use boundary 'wire'/u);
  assert.throws(() => validateContract({ ...receipt, fields: [field('position', contractRef({ ...point, boundary: 'presentation' }))] }),
    /contract 'live\.receipt' field 'position' nests 'live\.point', which is not a wire contract/u);
  assert.throws(() => validateContract({ ...receipt, fields: [field('position', contractRef({ ...point,
    fields: [field('handle', valueRef('native.handle'))] }))] }), /wire contract 'live\.point' field 'handle' has opaque value ref/u);
});

test('a contract that nests itself is refused, directly or through another', () => {
  const a = { id: 'loop.a', kind: 'snapshot', boundary: 'wire', fields: [] as LegoField[] } satisfies LegoContract;
  const b = { id: 'loop.b', kind: 'snapshot', boundary: 'wire', fields: [field('a', contractRef(a))] } satisfies LegoContract;
  a.fields.push(field('b', contractRef(b)));
  assert.throws(() => validateContract(a), /contract 'loop\.a' nests itself: loop\.a -> loop\.b -> loop\.a/u);
  const holder = { id: 'loop.holder', kind: 'snapshot', boundary: 'wire', fields: [field('b', contractRef(b))] } as const;
  assert.throws(() => validateContract(holder), /contract 'loop\.b' nests itself: loop\.b -> loop\.a -> loop\.b/u);
  const self = { id: 'loop.self', kind: 'snapshot', boundary: 'wire', fields: [] as LegoField[] } satisfies LegoContract;
  self.fields.push(field('self', contractRef(self), { nullable: true }));
  assert.throws(() => validateContract(self), /contract 'loop\.self' nests itself: loop\.self -> loop\.self/u);
});

test('a nested contract is part of the identity of the contract that holds it', () => {
  const wider = { ...receipt, fields: [receipt.fields[0], field('position', contractRef({ ...point,
    fields: [field('latitude', 'number', { min: -91, max: 91 }), point.fields[1]] })), receipt.fields[2]] } as const;
  assert.notEqual(contractFingerprint(receipt), contractFingerprint(wider));
});

// Compiled with the public API: a nested field reads as its own contract's payload.
function nestedTypeProof(input: unknown) {
  assertContractPayload(receipt, input);
  const latitude: number = input.position.latitude;
  const previous: number | undefined = input.previous?.latitude;
  // @ts-expect-error a nullable nested record may be null
  const always: number = input.previous.latitude;
  // @ts-expect-error the nested contract declares no heading
  const heading: unknown = input.position.heading;
  return { latitude, previous, always, heading };
}
void nestedTypeProof;

test('only a wire contract may ignore unknown fields, and the policy is refuse or ignore', () => {
  assert.doesNotThrow(() => validateContract({ ...receipt, unknownFields: 'ignore' }));
  assert.doesNotThrow(() => validateContract({ ...receipt, unknownFields: 'refuse' }));
  assert.throws(() => validateContract({ id: 'live.card', kind: 'state', boundary: 'presentation', unknownFields: 'ignore',
    fields: [field('accepted', 'boolean')] }),
  /contract 'live\.card' unknownFields 'ignore' is for a wire contract only: remove it or use boundary 'wire'/u);
  assert.throws(() => validateContract({ ...receipt, unknownFields: 'drop' } as never),
    /contract 'live\.receipt' unknownFields must be 'refuse' or 'ignore'/u);
});

test('an optional field must be nullable, refused where it is declared', () => {
  assert.throws(() => field('scopes', finiteSetRef(scopes.id), { optional: true }),
    /field 'scopes' is optional, so it must be nullable: add nullable: true/u);
  const optional = field('scopes', finiteSetRef(scopes.id), { nullable: true, optional: true });
  assert.doesNotThrow(() => validateContract({ ...access, fields: [optional] }));
  assert.throws(() => validateContract({ ...access, fields: [{ ...optional, nullable: false }] }),
    /contract 'device\.access' field 'scopes' is optional, so it must be nullable: add nullable: true/u);
});

test('the unknown-field policy and an optional key are part of the contract identity', () => {
  assert.notEqual(contractFingerprint(receipt), contractFingerprint({ ...receipt, unknownFields: 'ignore' }));
  assert.equal(contractFingerprint(receipt), contractFingerprint({ ...receipt, unknownFields: 'refuse' }));
  const nullable = { ...access, fields: [field('scopes', finiteSetRef(scopes.id), { nullable: true })] } as const;
  const optional = { ...access, fields: [field('scopes', finiteSetRef(scopes.id), { nullable: true, optional: true })] } as const;
  assert.notEqual(contractFingerprint(nullable), contractFingerprint(optional));
});

// A request the server reads (refuse) and a response clients read (ignore), shaped like the C1 pairing start.
const platforms = finiteValues('device.platform', ['wear-os', 'apple-watch', 'garmin']);
const pairing = { id: 'pairing.start', kind: 'event', boundary: 'wire', fields: [
  field('platform', finiteValueRef(platforms.id)), field('label', 'string'),
  field('operationId', 'string', { nullable: true, optional: true }),
  field('scopes', finiteSetRef(scopes.id), { nullable: true, optional: true })] } as const;
const echo = { ...point, id: 'live.echo', unknownFields: 'ignore' } as const;
const started = { id: 'pairing.started', kind: 'snapshot', boundary: 'wire', unknownFields: 'ignore', fields: [
  field('id', 'string'), field('requestedScopes', finiteSetRef(scopes.id)), field('position', contractRef(point)),
  field('echo', contractRef(echo), { nullable: true })] } as const;
const values = [platforms, scopes] as const;
const startedOf = (extra: Record<string, unknown> = {}) => ({ id: 'op_1', requestedScopes: ['jumps:write'],
  position: { latitude: 1, phase: null }, echo: null, ...extra });

test('a read fills an absent optional key with null and returns a copy of the declared keys', () => {
  const released = { platform: 'wear-os', label: 'Skydive Altimeter' };
  const read = readContractPayload(pairing, released, values);
  assert.deepEqual(read, { platform: 'wear-os', label: 'Skydive Altimeter', operationId: null, scopes: null });
  assert.notEqual(read, released);
  const scoped = { ...released, operationId: 'op_1', scopes: ['jumps:read', 'jumps:write'] };
  assert.deepEqual(readContractPayload(pairing, scoped, values), scoped);
});

test('a request with an unknown field is refused', () => {
  assert.throws(() => readContractPayload(pairing, { platform: 'wear-os', label: 'x', surprise: true }, values),
    /contract 'pairing\.start' has undeclared field 'surprise'/u);
});

test('a response with an unknown field parses, and the copy leaves it out', () => {
  const read = readContractPayload(started, startedOf({ addedLater: 1, echo: { latitude: 2, phase: null, heading: 9 } }), values);
  assert.deepEqual(read, startedOf({ echo: { latitude: 2, phase: null } }));
});

test('a nested record keeps its own policy inside a response', () => {
  assert.throws(() => readContractPayload(started, startedOf({ position: { latitude: 1, phase: null, heading: 9 } }), values),
    /contract 'live\.point' has undeclared field 'heading'/u);
});

test('a missing non-optional field is refused in both directions', () => {
  assert.throws(() => readContractPayload(pairing, { label: 'x' }, values), /contract 'pairing\.start' is missing field 'platform'/u);
  const { id: _, ...withoutId } = startedOf();
  assert.throws(() => readContractPayload(started, withoutId, values), /contract 'pairing\.started' is missing field 'id'/u);
  assert.throws(() => readContractPayload(started, startedOf({ position: { latitude: 1 } }), values),
    /contract 'live\.point' is missing field 'phase'/u);
});

test('an undeclared finite member and a repeated set member are refused', () => {
  assert.throws(() => readContractPayload(pairing, { platform: 'pebble', label: 'x' }, values),
    /contract 'pairing\.start' field 'platform' must belong to finite 'device\.platform'/u);
  assert.throws(() => readContractPayload(pairing, { platform: 'wear-os', label: 'x', scopes: ['jumps:admin'] }, values),
    /contract 'pairing\.start' field 'scopes' must belong to finite 'device\.scope'/u);
  assert.throws(() => readContractPayload(started, startedOf({ requestedScopes: ['jumps:write', 'jumps:write'] }), values),
    /contract 'pairing\.started' field 'requestedScopes' repeats 'jumps:write'/u);
});

test('every finite declaration the contract names is needed before a value is read, nested ones included', () => {
  assert.throws(() => readContractPayload(pairing, { platform: 'wear-os', label: 'x' }, [platforms]),
    /finite 'device\.scope' needs exactly one nonempty value declaration/u);
  const nested = { id: 'pairing.holder', kind: 'snapshot', boundary: 'wire', fields: [field('start', contractRef(pairing))] } as const;
  assert.throws(() => readContractPayload(nested, { start: { platform: 'wear-os', label: 'x' } }, [scopes]),
    /finite 'device\.platform' needs exactly one nonempty value declaration/u);
});

test('assert stays exact: an absent optional key or an unknown key is refused whatever the policy', () => {
  assert.throws(() => assertContractPayload(pairing, { platform: 'wear-os', label: 'x' }, values),
    /contract 'pairing\.start' is missing field 'operationId'/u);
  assert.throws(() => assertContractPayload(started, startedOf({ addedLater: 1 }), values),
    /contract 'pairing\.started' has undeclared field 'addedLater'/u);
  assert.doesNotThrow(() => assertContractPayload(started, readContractPayload(started, startedOf({ addedLater: 1 }), values), values));
});

// Compiled with the public API: the read returns the payload type, an optional key as a nullable value.
function readTypeProof(input: unknown) {
  const read = readContractPayload(pairing, input, values);
  const platform: 'wear-os' | 'apple-watch' | 'garmin' = read.platform;
  const operationId: string | null = read.operationId;
  // @ts-expect-error an optional key reads as null when absent
  const always: string = read.operationId;
  const requested: readonly ('jumps:read' | 'jumps:write')[] = readContractPayload(started, input, values).requestedScopes;
  return { platform, operationId, always, requested };
}
void readTypeProof;
