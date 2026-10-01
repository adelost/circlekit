import assert from 'node:assert/strict';
import test from 'node:test';
import { assertContractPayload, field, finiteValueRef, finiteValues, validateContract, valueRef,
  type ContractPayload, type LegoFieldOptions } from '../src/index.js';

const undo = {
  id: 'jobs.undo', kind: 'event', boundary: 'wire',
  fields: [field('userId', 'string', { nullable: true }), field('since', 'number')],
} as const;

const outcomes = finiteValues('job.outcomes', ['done', 'failed']);
const result = {
  id: 'job.result', kind: 'snapshot', boundary: 'wire',
  fields: [field('outcome', finiteValueRef(outcomes.id))],
} as const;

test('a finite payload cannot pass as an arbitrary string without its value declaration', () => {
  const contract = {
    id: 'job.outcome', kind: 'snapshot', boundary: 'service-internal',
    fields: [field('outcome', finiteValueRef('job.outcomes'))],
  } as const;
  assert.throws(() => assertContractPayload(contract, { outcome: 'invented' }), /job.outcomes.*declaration/u);
});

test('one wire declaration validates the Undo input without a cast or duplicate type', () => {
  validateContract(undo);
  for (const input of [{ userId: 'anna', since: 1 }, { userId: null, since: 0 }]) {
    assert.doesNotThrow(() => assertContractPayload(undo, input));
  }
  for (const input of [{ since: 0 }, { userId: 3, since: 0 }, { userId: 'anna', since: '0' },
    { userId: null, since: Infinity }, { userId: null, since: NaN }, { userId: null, since: 0, surprise: true }]) {
    assert.throws(() => assertContractPayload(undo, input), /jobs.undo/u);
  }
});

test('a finite field checks its declared members, not merely the string type', () => {
  assert.doesNotThrow(() => assertContractPayload(result, { outcome: 'done' }, [outcomes]));
  assert.throws(() => assertContractPayload(result, { outcome: 'invented' }, [outcomes]), /must belong to finite/u);
  assert.throws(() => assertContractPayload(result, { outcome: 'done' }, [outcomes, outcomes]), /exactly one/u);
});

test('opaque internal values stay unknown and cannot cross a wire contract', () => {
  const internal = { id: 'job.native', kind: 'snapshot', boundary: 'service-internal',
    fields: [field('native', valueRef('native.handle'))] } as const;
  assert.doesNotThrow(() => assertContractPayload(internal, { native: { handle: 1 } }));
  assert.throws(() => validateContract({ ...internal, boundary: 'wire' }), /wire.*opaque value ref/u);
});

// Compiled with the public API: wrong names, values and missing runtime knowledge must remain errors.
function typeProof(input: unknown, dynamic: LegoFieldOptions) {
  const name: 'since' = field('since', 'number').name;
  const payload: ContractPayload<typeof undo> = { userId: null, since: 0 };
  // @ts-expect-error since is not a string
  const wrong: ContractPayload<typeof undo> = { userId: 'anna', since: '0' };
  // @ts-expect-error userId is required even though nullable
  const missing: ContractPayload<typeof undo> = { since: 0 };
  assertContractPayload(undo, input);
  const since: number = input.since;
  const user: string | null = input.userId;
  // @ts-expect-error the declaration did not promise a nonnullable user
  const alwaysUser: string = input.userId;
  const choice: unknown = { outcome: 'done' };
  assertContractPayload(result, choice, [outcomes]);
  const outcome: 'done' | 'failed' = choice.outcome;
  const opaque = { id: 'job.opaque', kind: 'snapshot', boundary: 'service-internal',
    fields: [field('value', valueRef('native.handle'))] } as const;
  const native: unknown = { value: 'x' };
  assertContractPayload(opaque, native);
  // @ts-expect-error an opaque reference is not validated as a string
  const text: string = native.value;
  const uncertain = { ...undo, fields: [field('since', 'number', dynamic)] } as const;
  const maybe: ContractPayload<typeof uncertain> = { since: null };
  return { name, payload, wrong, missing, since, user, alwaysUser, outcome, text, maybe };
}
void typeProof;
