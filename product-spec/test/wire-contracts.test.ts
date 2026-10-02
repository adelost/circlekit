import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContractPayload, contractFingerprint, ContractPayloadError, contractRef, defineProduct,
  defineProductLibraryCatalog, field, finiteValueRef, finiteValues, listOf, port, portContracts, readContractPayload,
  service, validateContract, valueRef, type ContractPayload, type LegoContract, type LegoField } from '../src/index.js';
import { assetCatalog, lifetime, product } from './minimal-product.js';

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
  fields: [field('scopes', listOf(finiteValueRef(scopes.id), { distinct: true }))] } as const;
const scopesOf = (value: unknown) => () => assertContractPayload(access, { scopes: value }, [scopes]);

test('a distinct finite list accepts distinct declared members in any order, and the empty list', () => {
  for (const value of [['jumps:write'], ['jumps:write', 'jumps:read'], []]) assert.doesNotThrow(scopesOf(value));
});

test('a distinct list refuses a repeated element', () => {
  assert.throws(scopesOf(['jumps:write', 'jumps:write']), /contract 'device\.access' field 'scopes' repeats 'jumps:write'/u);
});

test('a list checks every element and refuses a value that is not an array', () => {
  assert.throws(scopesOf(['jumps:admin']), /contract 'device\.access' field 'scopes\[0\]' must belong to finite 'device\.scope'/u);
  for (const value of [[null], [1], ['jumps:write', 'JUMPS:READ']]) {
    assert.throws(scopesOf(value), /contract 'device\.access' field 'scopes\[\d\]' must belong to finite 'device\.scope'/u);
  }
  for (const value of ['jumps:write', { 0: 'jumps:write' }, null]) {
    assert.throws(scopesOf(value), /contract 'device\.access' field 'scopes' must be a list/u);
  }
  assert.throws(() => assertContractPayload(access, { scopes: [] }), /finite 'device\.scope' needs exactly one nonempty value declaration/u);
});

test('a list holds a primitive, a finite member or a wire record, and only a wire contract carries one', () => {
  assert.throws(() => validateContract({ ...access, boundary: 'service-internal' }),
    /contract 'device\.access' field 'scopes' is a list, which only a wire contract carries: use boundary 'wire'/u);
  assert.throws(() => listOf(valueRef('native.handle') as never),
    /listOf needs a primitive, a finiteValueRef or a contractRef, not 'native\.handle'/u);
  assert.throws(() => listOf(listOf('string') as never), /listOf needs a primitive, a finiteValueRef or a contractRef, not 'list\.string'/u);
  const handBuilt = { ref: 'list.native.handle', list: valueRef('native.handle'), distinct: false };
  assert.throws(() => validateContract({ ...access, fields: [field('scopes', handBuilt)] }),
    /contract 'device\.access' field 'scopes' lists 'native\.handle', which is not a primitive, a finite value or a wire contract/u);
});

test('the element kind and distinct are part of the contract identity', () => {
  const plain = { ...access, fields: [field('scopes', listOf(finiteValueRef(scopes.id)))] } as const;
  const strings = { ...access, fields: [field('scopes', listOf('string', { distinct: true }))] } as const;
  assert.notEqual(contractFingerprint(access), contractFingerprint(plain));
  assert.notEqual(contractFingerprint(access), contractFingerprint(strings));
});

// pl4n's shapes: a list of ids that may repeat, and a chat history whose turns carry a finite role.
const roles = finiteValues('chat.role', ['user', 'assistant']);
const turn = { id: 'chat.turn', kind: 'snapshot', boundary: 'wire',
  fields: [field('role', finiteValueRef(roles.id)), field('content', 'string')] } as const;
const ask = { id: 'chat.ask', kind: 'event', boundary: 'wire', fields: [field('message', 'string'),
  field('history', listOf(contractRef(turn))), field('helpers', listOf('string'), { optional: true })] } as const;
const askOf = (extra: Record<string, unknown>) => () => readContractPayload(ask, { message: 'hi', history: [], ...extra }, [roles]);

test('a list of strings or of records is read element by element', () => {
  const history = [{ role: 'user', content: 'Who brings tea?' }, { role: 'assistant', content: 'Anna.' }];
  assert.deepEqual(askOf({ history, helpers: ['u1', 'u2', 'u1'] })(), { message: 'hi', history, helpers: ['u1', 'u2', 'u1'] });
  assert.throws(askOf({ helpers: ['u1', 7] }), /contract 'chat\.ask' field 'helpers\[1\]' must be string/u);
  assert.throws(askOf({ history: [history[0], 'Anna.'] }), /contract 'chat\.ask' field 'history\[1\]' must be a 'chat\.turn' record/u);
  assert.throws(askOf({ history: [{ role: 'system', content: 'x' }] }), /contract 'chat\.turn' field 'role' must belong to finite 'chat\.role'/u);
});

// Compiled with the public API: a list field reads as a readonly array of its element's payload.
function listTypeProof(input: unknown) {
  assertContractPayload(access, input, [scopes]);
  const members: readonly ('jumps:read' | 'jumps:write')[] = input.scopes;
  // @ts-expect-error a list is not one member
  const one: 'jumps:read' | 'jumps:write' = input.scopes;
  const payload: ContractPayload<typeof access, [typeof scopes]> = { scopes: ['jumps:read'] };
  // @ts-expect-error an undeclared member is not a list element
  const wrong: ContractPayload<typeof access, [typeof scopes]> = { scopes: ['jumps:admin'] };
  const asked = readContractPayload(ask, input, [roles]);
  const role: 'user' | 'assistant' | undefined = asked.history[0]?.role;
  const helpers: readonly string[] | undefined = asked.helpers;
  return { members, one, payload, wrong, role, helpers };
}
void listTypeProof;

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
  const thread = { id: 'loop.thread', kind: 'snapshot', boundary: 'wire', fields: [] as LegoField[] } satisfies LegoContract;
  thread.fields.push(field('replies', listOf(contractRef(thread))));
  assert.throws(() => validateContract(thread), /contract 'loop\.thread' nests itself: loop\.thread -> loop\.thread/u);
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

test('optional and nullable are independent: a key may be absent, null, or both', () => {
  for (const options of [{ optional: true }, { optional: true, nullable: true }] as const) {
    assert.doesNotThrow(() => validateContract({ ...access, fields: [field('scopes', listOf(finiteValueRef(scopes.id)), options)] }));
  }
});

test('an optional key is a wire fact, refused on any other contract', () => {
  const reading = { id: 'baro.reading', kind: 'state', boundary: 'service-internal',
    fields: [field('hpa', 'number'), field('note', 'string', { optional: true })] } as const;
  assert.throws(() => validateContract(reading),
    /contract 'baro\.reading' field 'note' is optional, which only a wire contract carries: use boundary 'wire'/u);
  assert.doesNotThrow(() => validateContract({ ...reading, boundary: 'wire' }));
});

test('the unknown-field policy and an optional key are part of the contract identity', () => {
  assert.notEqual(contractFingerprint(receipt), contractFingerprint({ ...receipt, unknownFields: 'ignore' }));
  assert.equal(contractFingerprint(receipt), contractFingerprint({ ...receipt, unknownFields: 'refuse' }));
  const nullable = { ...access, fields: [field('scopes', listOf(finiteValueRef(scopes.id)), { nullable: true })] } as const;
  const optional = { ...access, fields: [field('scopes', listOf(finiteValueRef(scopes.id)), { nullable: true, optional: true })] } as const;
  assert.notEqual(contractFingerprint(nullable), contractFingerprint(optional));
});

// A request the server reads (refuse) and a response clients read (ignore), shaped like the C1 pairing start.
const platforms = finiteValues('device.platform', ['wear-os', 'apple-watch', 'garmin']);
const pairing = { id: 'pairing.start', kind: 'event', boundary: 'wire', fields: [
  field('platform', finiteValueRef(platforms.id)), field('label', 'string'),
  field('operationId', 'string', { optional: true }),
  field('scopes', listOf(finiteValueRef(scopes.id), { distinct: true }), { optional: true })] } as const;
const echo = { ...point, id: 'live.echo', unknownFields: 'ignore' } as const;
const started = { id: 'pairing.started', kind: 'snapshot', boundary: 'wire', unknownFields: 'ignore', fields: [
  field('id', 'string'), field('requestedScopes', listOf(finiteValueRef(scopes.id), { distinct: true })),
  field('position', contractRef(point)),
  field('echo', contractRef(echo), { nullable: true })] } as const;
const values = [platforms, scopes] as const;
const startedOf = (extra: Record<string, unknown> = {}) => ({ id: 'op_1', requestedScopes: ['jumps:write'],
  position: { latitude: 1, phase: null }, echo: null, ...extra });

// A pl4n-shaped PATCH body: an absent key leaves the task's field unchanged, null clears it.
const taskPatch = { id: 'tasks.patch', kind: 'event', boundary: 'wire', fields: [
  field('title', 'string', { optional: true }), field('day', 'string', { optional: true, nullable: true }),
  field('done', 'boolean', { optional: true })] } as const;

test('a read never invents a key: an absent optional key stays absent and null stays null', () => {
  const released = { platform: 'wear-os', label: 'Skydive Altimeter' };
  const read = readContractPayload(pairing, released, values);
  assert.deepEqual(read, released);
  assert.notEqual(read, released);
  const scoped = { ...released, operationId: 'op_1', scopes: ['jumps:read', 'jumps:write'] };
  assert.deepEqual(readContractPayload(pairing, scoped, values), scoped);
  assert.deepEqual(readContractPayload(taskPatch, {}), {});
  assert.deepEqual(readContractPayload(taskPatch, { day: null }), { day: null });
  assert.equal('day' in readContractPayload(taskPatch, { title: 'Bring tea' }), false);
});

test('an optional key that is not nullable refuses null', () => {
  assert.throws(() => readContractPayload(taskPatch, { title: null }), /contract 'tasks\.patch' field 'title' must be string/u);
  assert.throws(() => readContractPayload(pairing, { platform: 'wear-os', label: 'x', operationId: null }, values),
    /contract 'pairing\.start' field 'operationId' must be string/u);
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

test('an undeclared finite member and a repeated member of a distinct list are refused', () => {
  assert.throws(() => readContractPayload(pairing, { platform: 'pebble', label: 'x' }, values),
    /contract 'pairing\.start' field 'platform' must belong to finite 'device\.platform'/u);
  assert.throws(() => readContractPayload(pairing, { platform: 'wear-os', label: 'x', scopes: ['jumps:admin'] }, values),
    /contract 'pairing\.start' field 'scopes\[0\]' must belong to finite 'device\.scope'/u);
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

test('assert runs the same check as a read and narrows in place', () => {
  assert.doesNotThrow(() => assertContractPayload(pairing, { platform: 'wear-os', label: 'x' }, values));
  assert.doesNotThrow(() => assertContractPayload(started, startedOf({ addedLater: 1 }), values));
  assert.throws(() => assertContractPayload(pairing, { platform: 'wear-os', label: 'x', surprise: 1 }, values),
    /contract 'pairing\.start' has undeclared field 'surprise'/u);
});

// Compiled with the public API: an optional key is an optional property, nullable adds null, both give both.
function readTypeProof(input: unknown) {
  const read = readContractPayload(pairing, input, values);
  const platform: 'wear-os' | 'apple-watch' | 'garmin' = read.platform;
  const operationId: string | undefined = read.operationId;
  // @ts-expect-error an optional key may be absent
  const always: string = read.operationId;
  // @ts-expect-error an optional key that is not nullable is never null
  const cleared: typeof read.operationId = null;
  const patch = readContractPayload(taskPatch, input);
  const day: string | null | undefined = patch.day;
  const unchanged: typeof patch = {};
  const clear: typeof patch = { day: null };
  const requested: readonly ('jumps:read' | 'jumps:write')[] = readContractPayload(started, input, values).requestedScopes;
  return { platform, operationId, always, cleared, day, unchanged, clear, requested };
}
void readTypeProof;

// An HTTP adapter answers 400 for a ContractPayloadError and fails loudly (500) on anything else.
type Caught = Error & { readonly contractId?: string; readonly field?: string; readonly declaredAt?: string };
const caught = (run: () => unknown): Caught => {
  try { run(); } catch (error) { return error as Caught; }
  throw new Error('expected a refusal');
};
const payloadFault = (run: () => unknown, contractId: string, field: string, message: string) => {
  const error = caught(run);
  assert.equal(error.name, 'ContractPayloadError');
  assert.ok(error instanceof ContractPayloadError);
  assert.deepEqual({ contractId: error.contractId, field: error.field }, { contractId, field });
  assert.ok(error.message.startsWith(message), `${error.message} starts with ${message}`);
};

test('a payload fault is a ContractPayloadError with the contract, the dotted field path and the message', () => {
  const history = [{ role: 'user', content: 'x' }, { role: 'user', content: 'y' }, { role: 'system', content: 'z' }];
  payloadFault(askOf({ history }), 'chat.ask', 'history[2].role',
    "contract 'chat.turn' field 'role' must belong to finite 'chat.role'");
  payloadFault(askOf({ helpers: ['u1', 7] }), 'chat.ask', 'helpers[1]', "contract 'chat.ask' field 'helpers[1]' must be string");
  payloadFault(() => readContractPayload(ask, { history: [] }, [roles]), 'chat.ask', 'message',
    "contract 'chat.ask' is missing field 'message'");
  payloadFault(() => readContractPayload(started, startedOf({ position: { latitude: 1, phase: null, heading: 9 } }), values),
    'pairing.started', 'position.heading', "contract 'live.point' has undeclared field 'heading'");
  payloadFault(scopesOf(['jumps:write', 'jumps:write']), 'device.access', 'scopes',
    "contract 'device.access' field 'scopes' repeats 'jumps:write'");
  payloadFault(() => readContractPayload(pairing, 'x', values), 'pairing.start', '', "contract 'pairing.start' requires a record payload");
  payloadFault(() => assertContractPayload(receipt, { accepted: true, position: { latitude: 91, phase: null }, previous: null }),
    'live.receipt', 'position.latitude', "contract 'live.point' field 'latitude'=91 violates -90..90");
});

test('a declaration fault stays a plain Error, such as finite declarations left out of the call', () => {
  for (const run of [() => readContractPayload(pairing, { platform: 'wear-os', label: 'x' }, [platforms]),
    () => readContractPayload({ ...pairing, boundary: 'service-internal' }, { platform: 'wear-os', label: 'x' }, values)]) {
    const error = caught(run);
    assert.equal(error instanceof ContractPayloadError, false);
    assert.equal(error.name, 'Error');
  }
});

// A server may answer a bad request with the message, so the message names the contract, the field and the broken
// law and never a server file. The line that declared the law is in declaredAt, for the server's own log.
const depth = { id: 'fixture.depth', kind: 'observation', boundary: 'wire', fields: [
  field('lowM', 'number', { min: 0, max: 4000, unit: 'm' }),
  field('highM', 'number', { min: 0, max: 4000, unit: 'm', gteField: 'lowM' })] } as const;
const brokenRange = () => caught(() => readContractPayload(depth, { lowM: -5, highM: 10 }));
const brokenGte = () => caught(() => readContractPayload(depth, { lowM: 300, highM: 200 }));

test('a broken range says the law and no source site in its message', () => {
  assert.equal(brokenRange().message, "contract 'fixture.depth' field 'lowM'=-5 violates 0..4000 m");
});

test('a broken gteField says the law and no source site in its message', () => {
  assert.equal(brokenGte().message, "contract 'fixture.depth' field 'highM'=200 must be >= 'lowM'=300 m");
});

test('declaredAt names the file and line that declared the broken field', () => {
  const lineOf = (error: Caught) => /[\\/]test[\\/]wire-contracts\.test\.ts:(\d+)$/u.exec(error.declaredAt ?? 'no declaredAt')?.[1];
  const range = lineOf(brokenRange()), gte = lineOf(brokenGte());
  assert.ok(range !== undefined && gte !== undefined, 'both faults name this test file and a line');
  assert.equal(Number(gte), Number(range) + 1, 'highM is declared on the line after lowM');
});

// A finite value named inside a list or a nested record is as needed as one named by a field directly: every check
// that finite declarations are complete (and not orphaned) reads through lists and records.
const grantScopes = finiteValues('grant.scope', ['read', 'write']);
const grant = { id: 'grant.record', kind: 'snapshot', boundary: 'wire', fields: [field('scope', finiteValueRef('grant.scope'))] } as const;
const grants = { id: 'grant.list', kind: 'snapshot', boundary: 'wire', fields: [
  field('scopes', listOf(finiteValueRef('grant.scope'))), field('latest', contractRef(grant), { nullable: true })] } as const;
const processLife = { stateOwner: 'none', lifetime: 'process', durability: 'transient', clockDomain: 'none', contextInputs: [] } as const;
const grantSource = service({ id: 'grant.source', inputs: [], outputs: [port('grants', grants)],
  runtime: { ...processLife, effects: ['grant.read'] } } as const);
const grantSink = service({ id: 'grant.sink', inputs: [port('grants', grants)], outputs: [],
  runtime: { ...processLife, effects: ['grant.write'] } } as const);
const withGrants = (finite: readonly ReturnType<typeof finiteValues>[]) => () => defineProduct({ ...product,
  finiteValues: finite, nodeTypes: [...product.nodeTypes, grantSource, grantSink],
  nodes: [...product.nodes, { id: 'grant.source', nodeTypeRef: grantSource.id, config: {}, bindings: {}, activation: lifetime },
    { id: 'grant.sink', nodeTypeRef: grantSink.id, config: {}, bindings: { grants: 'grant.source.grants' }, activation: lifetime }],
} as never, assetCatalog);

test('a product refuses a finite value named only inside a list or a record when it is not declared', () => {
  assert.throws(withGrants([]), /contract 'grant\.list' uses unknown finite value 'grant\.scope'/u);
});

test('a finite value used only inside a list or a record is no orphan', () => {
  assert.doesNotThrow(withGrants([grantScopes]));
});

test('a library refuses a list or record that names an undeclared finite value', () => {
  const library = (finite: readonly ReturnType<typeof finiteValues>[]) => () => defineProductLibraryCatalog({
    id: 'grant-library', contracts: [grants], nodeTypes: [], finiteValues: finite });
  assert.throws(library([]), /library 'grant-library' contract 'grant\.list' uses undeclared finite value 'grant\.scope'/u);
  assert.doesNotThrow(library([grantScopes]));
});

test('port contracts refuse a list or record whose finite declaration was not passed', () => {
  const registry = (contract: LegoContract) => ({ contracts: [contract], nodePorts: [{ ref: 'grant.out', contractRef: contract.id }],
    componentPorts: [] }) as unknown as Parameters<typeof portContracts>[0];
  assert.throws(() => portContracts(registry(grants)),
    /port contract 'grant\.list' field 'scopes' names finite 'grant\.scope' without its declaration; pass it to portContracts/u);
  const nestedOnly = { ...grants, id: 'grant.nested', fields: [grants.fields[1]] } as const;
  assert.throws(() => portContracts(registry(nestedOnly)),
    /port contract 'grant\.nested' field 'latest\.scope' names finite 'grant\.scope' without its declaration/u);
  assert.doesNotThrow(() => portContracts(registry(grants), [grantScopes]));
});
