import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContractPayload, contractFingerprint, defineProductLibraryCatalog, field, finiteSetRef, finiteValues,
  validateContract, valueRef, type ContractPayload } from '../src/index.js';

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
