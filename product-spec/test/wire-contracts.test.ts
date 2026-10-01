import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProductLibraryCatalog, finiteValues } from '../src/index.js';

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
