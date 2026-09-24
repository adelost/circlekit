import assert from 'node:assert/strict';
import test from 'node:test';
import { defineEffect, effectCatalog, type EffectSpec } from '../src/effect-model.js';
import { field } from '../src/node-model.js';

const input = { id: 'sync.jump-upload.input', kind: 'event', boundary: 'service-internal', fields: [
  field('operationId', 'string'), field('inputSha256', 'string'), field('flightId', 'string'),
] } as const;
const receipt = { id: 'sync.jump-upload.receipt', kind: 'event', boundary: 'service-internal', fields: [
  field('operationId', 'string'), field('inputSha256', 'string'), field('activityId', 'string'),
] } as const;
const upload = () => defineEffect({ id: 'network.jump-upload', input, receipt });

test('the effect declares only a typed boundary and the closed retry/outcome law', () => {
  const effect = upload();
  assert.equal(effect.pattern, 'effect');
  assert.deepEqual(effect.retry, { identity: 'same', unknown: 'retain' });
  assert.deepEqual(effect.outcomes, ['CONFIRMED', 'FAILED', 'UNKNOWN']);
  assert.equal(effect.identityField, 'operationId');
  assert.equal(effect.digestField, 'inputSha256');
  assert.ok(Object.isFrozen(effect));
});

test('an operation or receipt without nonnullable identity and digest is refused at its declaration', () => {
  const define = (value: unknown) => () => defineEffect(value as EffectSpec);
  assert.throws(define({ id: 'network.jump-upload', input: { ...input,
    fields: [field('operationId', 'string', { nullable: true }), field('inputSha256', 'string')] }, receipt }),
  /network.jump-upload.*input.operationId.*effect-model.test.ts:\d+/u);
  assert.throws(define({ id: 'network.jump-upload', input, receipt: { ...receipt,
    fields: [field('operationId', 'string')] } }), /network.jump-upload.*receipt.inputSha256/u);
});

test('one outside-world effect has one declaration', () => {
  assert.throws(() => effectCatalog([upload(), upload()]), /network.jump-upload.*declared twice/u);
  const conflicting = defineEffect({ id: 'network.jump-delete', input: { ...input,
    fields: [...input.fields, field('otherTarget', 'string')] }, receipt });
  assert.throws(() => effectCatalog([upload(), conflicting]), /sync.jump-upload.input.*conflicting schemas/u);
  assert.equal(effectCatalog([upload()]).length, 1);
});
