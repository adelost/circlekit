import test from 'node:test';
import assert from 'node:assert/strict';
import { convergenceFor, convergenceTasks } from '../lib/convergence.mjs';

const law = (status, key = 'node-type::recording.service') => ({ status, name: 'recording law', file: 'src/recording.ts',
  associationStatus: 'exact-model-declaration', associations: [{ entityKey: key }],
  scenarios: [{ phases: { then: status === 'failed' ? 'Expected declared owner.' : 'Accepted.' } }] });
const event = (sequence, key = 'facet:machine:recording.session') => ({ sequence, entityKey: key, logic: { facetId: 'recording.session' } });
const view = ({ laws = [], events = [], trace = false, contracts = [] } = {}) => ({
  documentation: { reports: laws.length ? [{ status: 'loaded', run: { framework: 'product-spec-laws' },
    modelCorrelation: 'same-model', tests: laws }] : [], contracts, unresolved: [] },
  trace: trace ? { events, artifactSha256: 'a'.repeat(64) } : null,
  compatibility: { producer: '0.3.64', evaluator: '0.3.64' }, toolVersions: { productSpec: '0.3.64' },
});

test('Converged uses loaded positive evidence and keeps missing sources visible', () => {
  const result = convergenceFor(view({ laws: [law('passed')] }), () => ({ kind: 'unknown' }));
  assert.equal(result.verdict, 'Converged');
  assert.equal(result.counts.laws.passed, 1);
  assert.match(result.gaps.join(' '), /trace file/);
});
test('Unknown names missing evidence', () => {
  const result = convergenceFor(view(), () => ({ kind: 'unknown' }));
  assert.equal(result.verdict, 'Unknown');
  assert.match(result.gaps.join(' '), /declaration-law report.*trace file/);
});
test('a skipped law supplies no Converged proof', () => {
  const result = convergenceFor(view({ laws: [law('skipped')] }), () => ({ kind: 'unknown' }));
  assert.equal(result.verdict, 'Unknown');
  assert.equal(result.counts.laws.skipped, 1);
  assert.match(result.gaps.join(' '), /skipped/);
});
test('an unknown trace comparison supplies no Converged proof', () => {
  const result = convergenceFor(view({ trace: true, events: [event(3)] }), () => ({ kind: 'unknown' }));
  assert.equal(result.verdict, 'Unknown');
  assert.equal(result.counts.trace.unknown, 1);
});
test('mixed divergence counts and locates both a failed law and a different trace step', () => {
  const result = convergenceFor(view({ laws: [law('failed')], trace: true, events: [event(7)] }),
    () => ({ kind: 'different', message: 'Recorded transition differs from the loaded model.' }));
  assert.equal(result.label, 'Diverged: 2');
  assert.deepEqual(result.reasons.map(r => [r.kind, r.entityKey, r.file ?? r.sequence]), [
    ['law', 'node-type::recording.service', 'src/recording.ts'],
    ['trace', 'facet:machine:recording.session', 7],
  ]);
});
test('--tasks formats each contradiction as one pasteable task line', () => {
  const result = convergenceFor(view({ laws: [law('failed')], trace: true, events: [event(7)] }),
    () => ({ kind: 'different', message: 'Different transition.' }));
  assert.deepEqual(convergenceTasks(result), [
    'Fix: node-type::recording.service: law failed (src/recording.ts)',
    'Fix: facet:machine:recording.session: trace step 7 different (sequence 7)',
  ]);
});
