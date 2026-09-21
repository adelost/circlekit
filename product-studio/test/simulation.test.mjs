import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeSource } from '../lib/source.mjs';
import { evaluateFacet, runScenario, runMockScenario } from '../lib/simulation.mjs';
const f = analyzeSource(await readFile(new URL('../fixtures/workflow.ts', import.meta.url), 'utf8')).facets[0];
const request = { state: 'PENDING', input: 'Response', guards: { CURRENT_REQUEST: true, RESPONSE_OK: true } };
const mock = () => ({ contracts: { catalog: { request: { a: 'string', b: 'integer' }, response: { ok: 'boolean' } } }, fixtures: [{ boundaryId: 'catalog', request: { a: 'x', b: 1 }, delayMs: 25, response: { ok: true } }], requests: [{ boundaryId: 'catalog', operationId: 'r1', atMs: 0, payload: { a: 'x', b: 1 } }] });

test('the synthetic reply-success path evaluates with explicit facts', () => { const r = evaluateFacet(f, request); assert.equal(r.to, 'SUCCESS'); assert.equal(r.cellId, 'reply-success'); assert.equal(r.effectsExecuted, false); });
test('missing facts are unknown, not false', () => { const r = evaluateFacet(f, { ...request, guards: {} }); assert.equal(r.kind, 'needs-facts'); assert.ok(r.guards.includes('CURRENT_REQUEST')); });
test('false and unknown have different simulation meanings', () => { const r = evaluateFacet(f, { ...request, guards: { ...request.guards, CURRENT_REQUEST: 'unknown' } }); assert.equal(r.kind, 'needs-facts'); });
test('unknown event is refused by the kernel', () => assert.throws(() => evaluateFacet(f, { ...request, input: 'InventedEvent' }), /no input/));
test('updates do not invent native arithmetic', () => { const r = evaluateFacet(f, { state: 'PENDING', input: 'Inspect', guards: {} }); assert.equal(r.to, 'PENDING'); assert.match(r.notice, /not executed/); });
test('scenario replays three independently expected transitions without effects', () => {
 const s = { bundleDigest: 'v1', facetId: f.id, events: [{ atMs: 0, input: 'Send', guards: {}, expect: { to: 'PENDING', cellId: 'send' } }, { atMs: 10, ...request, expect: { to: 'SUCCESS', cellId: 'reply-success' } }, { atMs: 10, input: 'Reset', guards: {}, expect: { to: 'IDLE', cellId: 'reset-success' } }] };
 const a = runScenario(f, s, 'v1'), b = runScenario(f, s, 'v1'); assert.deepEqual(a, b); assert.equal(a.state, 'IDLE'); assert.equal(a.pass, true); assert.equal(a.assertions.length, 3);
});
test('scenario with unknown guard stops without claiming a transition', () => { const r = runScenario(f, { facetId: f.id, bundleDigest: 'v1', initialState: 'PENDING', events: [{ atMs: 0, input: 'Response', guards: {} }] }, 'v1'); assert.equal(r.stopped, true); assert.equal(r.events.length, 0); });
test('scenario source identity mismatch fails', () => assert.throws(() => runScenario(f, { facetId: f.id, bundleDigest: 'old', events: [] }, 'new'), /another source revision/));
test('out-of-order virtual inputs fail', () => assert.throws(() => runScenario(f, { facetId: f.id, bundleDigest: 'v1', events: [{ atMs: 10, input: 'Send', guards: {} }, { atMs: 1, input: 'Reset', guards: {} }] }, 'v1'), /ascending order/));
test('failed independent assertion is not reported as pass', () => { const r = runScenario(f, { facetId: f.id, bundleDigest: 'v1', events: [{ atMs: 0, input: 'Send', guards: {}, expect: { to: 'SUCCESS' } }] }, 'v1'); assert.equal(r.pass, false); });
test('missing mock never falls back to an external request', () => { const s = mock(); s.fixtures = []; assert.throws(() => runMockScenario(s), /No mock configured. External calls are disabled/); });
test('mock response must match its record contract', () => { const s = mock(); s.fixtures[0].response = { ok: 'true' }; assert.throws(() => runMockScenario(s), /must be boolean/); });
test('same operation ID reuses one result, different input conflicts', () => { const s = mock(); s.requests.push({ ...s.requests[0] }); assert.equal(runMockScenario(s).events.length, 1); s.requests[1].payload = { a: 'y', b: 1 }; assert.throws(() => runMockScenario(s), /different input/); });
test('mock request matching is independent of JSON property insertion order', () => { const s = mock(); s.requests[0].payload = { b: 1, a: 'x' }; assert.equal(runMockScenario(s).events.length, 1); });
test('duplicate fixture matches are refused instead of taking the first', () => { const s = mock(); s.fixtures.push({ ...s.fixtures[0], response: { ok: false } }); assert.throws(() => runMockScenario(s), /ambiguous|more than one/i); });
test('virtual response order reflects latency, not submission order', () => { const s = mock(); s.fixtures.push({ ...s.fixtures[0], request: { a: 'y', b: 2 }, delayMs: 1 }); s.requests.push({ ...s.requests[0], operationId: 'r2', payload: { a: 'y', b: 2 } }); assert.deepEqual(runMockScenario(s).events.map(e => e.operationId), ['r2','r1']); });


test('empty or malformed expectations are not counted as passing assertions', () => {
  for (const expect of [{}, [], '', null, { invented: true }]) {
    assert.throws(() => runScenario(f, { facetId: f.id, bundleDigest: 'v1',
      events: [{ atMs: 0, input: 'Send', guards: {}, expect }] }, 'v1'), /expectation/i);
  }
});
test('empty scenario cannot bypass an inspect-only facet or invalid initial state', () => {
  const scenario = { facetId: f.id, bundleDigest: 'v1', events: [] };
  assert.throws(() => runScenario({ ...f, runnable: false }, scenario, 'v1'), /inspect-only/);
  assert.throws(() => runScenario(f, { ...scenario, initialState: 'INVENTED' }, 'v1'), /Initial state/);
});
