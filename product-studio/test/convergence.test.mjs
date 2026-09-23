import test from 'node:test';
import assert from 'node:assert/strict';
import { convergenceFor, convergenceTasks } from '../lib/convergence.mjs';

const law = (status, key = 'node-type::recording.service') => ({ status, name: 'recording law', file: 'src/recording.ts',
  associationStatus: 'exact-model-declaration', associations: [{ entityKey: key }],
  scenarios: [{ phases: { then: status === 'failed' ? 'Expected declared owner.' : 'Accepted.' } }] });
const event = (sequence, key = 'facet:machine:recording.session') => ({ sequence, entityKey: key, logic: { facetId: 'recording.session' } });
const contract = (status, validation = 'local-amux') => ({ id: 'recording.service', entityKey: 'node-type::recording.service',
  source: { file: 'src/recording.ts', line: 18 }, contract: { status }, validation, correlation: 'source-only' });
const view = ({ laws = [], events = [], trace = false, contracts = [] } = {}) => ({
  documentation: { reports: laws.length ? [{ status: 'loaded', run: { framework: 'product-spec-laws' },
    modelCorrelation: 'same-model', tests: laws }] : [], contracts, unresolved: [], diagnostics: [] },
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
test('a clean but empty live capture adds no behavioral proof even beside passing laws',()=>{
  const selected=view({laws:[law('passed')]});
  selected.trace={version:2,events:[],complete:true,artifactSha256:'a'.repeat(64)};
  const result=convergenceFor(selected,()=>({kind:'unknown'}));
  assert.equal(result.verdict,'Unknown');
  assert.match(result.gaps.join(' '),/empty live capture/i);
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
test('validated source-only WHAT/WHY counts as evidence without claiming model provenance', () => {
  const result = convergenceFor(view({ contracts: [contract('validated')] }), () => ({ kind: 'unknown' }));
  assert.equal(result.verdict, 'Converged');
  assert.equal(result.counts.contracts.validated, 1);
  assert.equal(result.counts.contracts.matched, 0);
  assert.match(result.gaps.join(' '), /0\/1.*provenance/);
});
test('invalid WHAT/WHY is one located divergence and one task', () => {
  const result = convergenceFor(view({ contracts: [contract('invalid')] }), () => ({ kind: 'unknown' }));
  assert.equal(result.label, 'Diverged: 1');
  assert.deepEqual(convergenceTasks(result), [
    'Fix: node-type::recording.service: WHAT/WHY invalid (src/recording.ts:18)',
  ]);
});
test('an AMUX contract finding diverges even when exported status says validated', () => {
  const selected = view({ contracts: [contract('validated', 'producer-reported')] });
  selected.documentation.diagnostics.push({ rule: 'contract.why', severity: 'error',
    file: 'src/recording.ts', line: 18, message: 'WHY does not describe a boundary.' });
  const result = convergenceFor(selected, () => ({ kind: 'unknown' }));
  assert.equal(result.label, 'Diverged: 1');
  assert.match(result.reasons[0].message, /WHY does not describe/);
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
