import { kernel, MAX_POINTS } from './kernel.mjs';
import { requireThat, digest, plain, StudioError, canonicalJson } from './util.mjs';

export function evaluateFacet(facet, request, selectedKernel = kernel) {
  requireThat(facet.runnable !== false, 'simulation.unavailable', facet.blockedReason ?? 'This facet is inspect-only.');
  const model = facet.compiled;
  if (facet.kind === 'decision-table') {
    requireThat(plain(request.facts), 'table.facts', 'Supply the exact policy facts.');
    const result = selectedKernel.decide(model, request.facts);
    const alternatives = model.cells.map(cell => ({ id: cell.id, mismatch: Object.entries(cell.region).filter(([a, expected]) => !(Array.isArray(expected) ? expected : [expected]).includes(request.facts[a])).map(([axis, expected]) => ({ axis, expected, actual: request.facts[axis] })) }));
    return { kind: 'decision', ...result, alternatives, evidenceKind: 'simulation', effectsExecuted: false };
  }
  requireThat(facet.kind === 'machine' && typeof request.input === 'string' && typeof request.state === 'string' && plain(request.guards), 'machine.input', 'Supply state, event and guard facts.');
  const possible = model.cells.filter(c => c.from === request.state && c.on === request.input);
  const relevant = [...new Set(possible.flatMap(c => [...c.requires, ...c.forbids]))];
  for (const [guard, value] of Object.entries(request.guards)) requireThat(model.guards.includes(guard) && [true, false, 'unknown'].includes(value), 'machine.guard', 'An unknown guard name or invalid guard value was supplied.');
  const missing = relevant.filter(g => request.guards[g] !== true && request.guards[g] !== false);
  if (missing.length) return { kind: 'needs-facts', guards: missing, message: 'Supply the missing guard facts before stepping.', effectsExecuted: false };
  const held = new Set(Object.entries(request.guards).filter(([, v]) => v === true).map(([k]) => k));
  const result = selectedKernel.step(model, request.state, request.input, held);
  return { kind: 'transition', from: request.state, input: request.input, ...result, guardFacts: request.guards,
    alternatives: possible.map(c => ({ id: c.id, missing: c.requires.filter(g => !held.has(g)), forbidden: c.forbids.filter(g => held.has(g)) })),
    notice: model.updates.some(u => u.on === request.input) ? 'Stage checked. Native field-update arithmetic was not executed.' : null,
    evidenceKind: 'simulation', effectsExecuted: false };
}
export function enumerateTable(facet, selectedKernel = kernel) {
  requireThat(facet.runnable !== false, 'simulation.unavailable', facet.blockedReason ?? 'This facet is inspect-only.');
  requireThat(facet.kind === 'decision-table', 'table.kind', 'Select a decision table.');
  const points = Object.values(facet.compiled.axes).reduce((n, a) => n * a.length, 1);
  requireThat(points <= MAX_POINTS, 'table.budget', 'Table exceeds the interactive budget.');
  return selectedKernel.decisionPoints(facet.compiled.axes).map(p => selectedKernel.decide(facet.compiled, p));
}

/** Virtual event order only. No sleeps, IO, clocks, model calls or production adapters. */
export function runScenario(facet, scenario, bundleDigest, selectedKernel = kernel) {
  requireThat(facet.runnable !== false, 'simulation.unavailable', facet.blockedReason ?? 'This facet is inspect-only.');
  requireThat(['machine', 'decision-table'].includes(facet.kind), 'scenario.kind', 'This facet has no supported scenario runner.');
  requireThat(plain(scenario) && scenario.bundleDigest === bundleDigest && scenario.facetId === facet.id,
    'scenario.identity', 'Scenario belongs to another source revision or declaration.');
  requireThat(Array.isArray(scenario.events) && scenario.events.length <= 1000, 'scenario.events', 'Scenario needs at most 1000 events.');
  let state = scenario.initialState ?? facet.compiled.initial, time = 0;
  if (facet.kind === 'machine') requireThat(facet.compiled.states.includes(state), 'scenario.state', 'Initial state is not declared by this machine.');
  const events = [], assertions = [];
  for (const [index, e] of scenario.events.entries()) {
    requireThat(plain(e), 'scenario.event', 'Each scenario event must be a record.');
    if (Object.hasOwn(e, 'expect')) {
      const keys = facet.kind === 'machine' ? ['to', 'cellId'] : ['cell', 'values'];
      requireThat(plain(e.expect) && Object.keys(e.expect).length > 0
        && Object.keys(e.expect).every(key => keys.includes(key)), 'scenario.expect',
        'An expectation must contain at least one supported outcome field; an empty object is not an assertion.');
    }
    requireThat(Number.isSafeInteger(e.atMs) && e.atMs >= time, 'scenario.time', 'Event times must be nonnegative integer virtual milliseconds in ascending order.');
    time = e.atMs;
    const result = evaluateFacet(facet, { ...e, state }, selectedKernel);
    if (result.kind === 'needs-facts') return { stopped: true, index, result, events, assertions, effectsExecuted: false };
    if (result.kind === 'transition') state = result.to;
    events.push({ sequence: index, atMs: time, ...result });
    if (e.expect) {
      const actual = result.kind === 'transition' ? { to: result.to, cellId: result.cellId } : { cell: result.cell, values: result.values };
      assertions.push({ index, pass: Object.entries(e.expect).every(([key, value]) => canonicalJson(actual[key]) === canonicalJson(value)), expected: e.expect, actual });
    }
  }
  return { stopped: false, state, events, assertions, pass: assertions.length ? assertions.every(a => a.pass) : null, assertionStatus: assertions.length ? (assertions.every(a => a.pass) ? 'passed' : 'failed') : 'unasserted', bundleDigest, scenarioDigest: digest(scenario), effectsExecuted: false };
}

/** Exact request fixtures. Schemas are explicit test contracts, not real provider claims. */
export function runMockScenario(scenario) {
  requireThat(plain(scenario) && Array.isArray(scenario.fixtures) && scenario.fixtures.length <= 256 && Array.isArray(scenario.requests) && scenario.requests.length <= 1000, 'mock.shape', 'Expected bounded fixtures and requests.');
  const operations = new Map(), queue = [];
  const schemas = scenario.contracts ?? {};
  for (const [index, request] of scenario.requests.entries()) {
    requireThat(typeof request.operationId === 'string' && request.operationId.length > 0 && typeof request.boundaryId === 'string', 'mock.identity', 'Every request needs an operation ID and boundary ID.');
    const identity = digest(canonicalJson({ boundaryId: request.boundaryId, payload: request.payload }));
    if (operations.has(request.operationId)) {
      requireThat(operations.get(request.operationId) === identity, 'mock.conflict', 'The same operation ID was reused with different input.'); continue;
    }
    operations.set(request.operationId, identity);
    const schema = schemas[request.boundaryId];
    requireThat(plain(schema), 'mock.codec', 'Fixture contract required for this boundary.');
    validatePrimitiveRecord(schema.request, request.payload);
    const matching = scenario.fixtures.filter(f => f.boundaryId === request.boundaryId && canonicalJson(f.request) === canonicalJson(request.payload));
    requireThat(matching.length <= 1, 'mock.ambiguous', 'More than one mock matches this request; the fixture is ambiguous.');
    const fixture = matching[0];
    if (!fixture) throw new StudioError('mock.missing', 'No mock configured. External calls are disabled.');
    requireThat(Number.isSafeInteger(request.atMs) && request.atMs >= 0 && Number.isSafeInteger(fixture.delayMs) && fixture.delayMs >= 0 && fixture.delayMs <= 86400000, 'mock.time', 'Supply bounded, nonnegative virtual times.');
    validatePrimitiveRecord(schema.response, fixture.response);
    queue.push({ sequence: index, operationId: request.operationId, boundaryId: request.boundaryId, atMs: request.atMs + fixture.delayMs, response: fixture.response });
  }
  queue.sort((a, b) => a.atMs - b.atMs || a.sequence - b.sequence);
  return { events: queue, effectsExecuted: false, evidenceKind: 'simulation', contractOrigin: 'scenario-fixture', message: 'Synthetic boundary only. No real service, network or provider was invoked.' };
}
function validatePrimitiveRecord(schema, payload) {
  requireThat(plain(schema) && plain(payload) && Object.keys(schema).length <= 100, 'mock.payload', 'Fixture payload must match an explicit primitive record contract.');
  requireThat(Object.keys(payload).every(key => Object.hasOwn(schema, key)), 'mock.payload', 'Fixture contains an unknown field.');
  for (const [key, kind] of Object.entries(schema)) {
    const value = payload[key];
    requireThat(['string', 'boolean', 'number', 'integer'].includes(kind), 'mock.codec', 'Opaque payloads require a product-owned codec; this fixture runner supports primitive records only.');
    requireThat(kind === 'integer' ? Number.isSafeInteger(value) : typeof value === kind && (kind !== 'number' || Number.isFinite(value)), 'mock.payload', `Fixture field '${key}' must be ${kind}.`);
  }
}
