import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodeJUnitXml, importJUnit } from '../bin/junit-evidence.mjs';
import { testAnnotations, testSourceIndex } from '../lib/test-source.mjs';
import { convergenceFor } from '../lib/convergence.mjs';

// Authored during a source-only review. No test execution was performed by that review.
for (const attributes of ['failures="1"', 'errors="1"', 'skipped="1"', 'tests="-1"', 'tests=""']) {
  test(`JUnit refuses contradictory or invalid counters: ${attributes}`, () => {
    assert.throws(() => decodeJUnitXml(`<testsuite ${attributes}><testcase name="ok" classname="Example" time="0"/></testsuite>`),
      error => error.code === 'evidence.count');
  });
}
test('JUnit preserves valid distinct failure, error and skipped counts', () => {
  const xml = '<testsuite tests="4" failures="1" errors="1" skipped="1">'
    + '<testcase name="ok"/><testcase name="failed"><failure/></testcase>'
    + '<testcase name="errored"><error/></testcase><testcase name="skipped"><skipped/></testcase></testsuite>';
  assert.deepEqual(decodeJUnitXml(xml).suites[0].cases.map(item => item.status), ['passed', 'failed', 'failed', 'skipped']);
});
test('JUnit refuses a declared zero failure count when a failure is present', () => {
  assert.throws(() => decodeJUnitXml('<testsuite failures="0"><testcase><failure/></testcase></testsuite>'),
    error => error.code === 'evidence.count');
});

async function readFixture(t, suiteTime, caseTime, body = '') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-junit-audit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'tests'));
  await writeFile(path.join(root, 'tests/Example.kt'), 'class Example { fun sample() { check(true) } }\n');
  await writeFile(path.join(root, 'result.xml'),
    `<testsuite name="Example" timestamp="2026-09-23T00:00:00Z" ${suiteTime}>`
    + `<testcase name="sample" classname="Example" ${caseTime}>${body}</testcase></testsuite>`);
  return importJUnit({ root, input: 'result.xml', sourceRoots: ['tests'] });
}
for (const attribute of ['', 'time=""', 'time=" "']) {
  test(`JUnit refuses missing or blank suite duration: ${JSON.stringify(attribute)}`, async t => {
    await assert.rejects(readFixture(t, attribute, 'time="0"'), error => error.code === 'evidence.timestamp');
  });
  test(`JUnit refuses missing or blank executed-case duration: ${JSON.stringify(attribute)}`, async t => {
    await assert.rejects(readFixture(t, 'time="1"', attribute), error => error.code === 'evidence.junit-duration');
  });
}
test('JUnit retains explicit zero durations and original timestamps', async t => {
  const report = await readFixture(t, 'time="0"', 'time="0"');
  assert.equal(report.run.startedAt, '2026-09-23T00:00:00.000Z');
  assert.equal(report.run.durationMs, 0);
  assert.equal(report.tests[0].durationMs, 0);
});
test('JUnit still permits a skipped case without an execution duration', async t => {
  const report = await readFixture(t, 'time="0"', '', '<skipped/>');
  assert.equal(report.tests[0].status, 'skipped');
  assert.equal(report.tests[0].durationMs, 0);
});

test('adjacent single-line covers and proof annotations both survive indexing', () => {
  const source = '// @covers node-type::capture\n// @proof host\ntest("captures", () => { check(true); });\n';
  const [located] = testSourceIndex(source, 'test/capture.test.mjs');
  const result = testAnnotations(located, { knownKeys: new Set(['node-type::capture']), byId: new Map() });
  assert.equal(result.proofKind, 'host');
  assert.deepEqual(result.associations.map(item => item.entityKey), ['node-type::capture']);
  assert.deepEqual(result.diagnostics, []);
});
test('a separate preceding block is not silently inherited by a line-comment annotation', () => {
  const source = '/** @covers node-type::other */\n// @proof host\ntest("captures", () => {});\n';
  const [located] = testSourceIndex(source, 'test/capture.test.mjs');
  const result = testAnnotations(located, { knownKeys: new Set(['node-type::other']), byId: new Map() });
  assert.equal(result.proofKind, 'host');
  assert.deepEqual(result.associations, []);
});
test('a blank line ends an adjacent line-comment annotation group', () => {
  const source = '// @covers node-type::other\n\n// @proof host\ntest("captures", () => {});\n';
  const [located] = testSourceIndex(source, 'test/capture.test.mjs');
  const result = testAnnotations(located, { knownKeys: new Set(['node-type::other']), byId: new Map() });
  assert.equal(result.proofKind, 'host');
  assert.deepEqual(result.associations, []);
});

function positiveView() {
  return {
    documentation: {
      contracts: [{ id: 'capture', entityKey: 'node-type::capture', source: { file: 'src/capture.ts', line: 3 },
        contract: { status: 'validated' }, validation: 'local-amux', correlation: 'source-only' }],
      reports: [], unresolved: [], diagnostics: [], scope: { complete: true },
    },
    diagnostics: [], trace: null,
    compatibility: { producer: '0.3.64', evaluator: '0.3.64' }, toolVersions: { productSpec: '0.3.64' },
  };
}
const converge = view => convergenceFor(view, () => ({ kind: 'unknown' }));
test('valid comments cannot clear a failed model read', () => {
  const view = positiveView();
  view.diagnostics.push({ rule: 'artifact.read', message: 'Invalid compiled model.' });
  const result = converge(view);
  assert.equal(result.verdict, 'Unknown');
  assert.match(result.gaps.join(' '), /artifact.read/);
});
test('valid comments cannot clear incomplete service discovery', () => {
  const view = positiveView();
  view.documentation.scope.complete = false;
  assert.equal(converge(view).verdict, 'Unknown');
});
test('an unreadable selected intent source is a gap even if other comments validate', () => {
  const view = positiveView();
  view.documentation.diagnostics.push({ rule: 'contract.source', severity: 'error', file: 'src/missing.ts', message: 'Unreadable.' });
  assert.equal(converge(view).verdict, 'Unknown');
});
test('missing optional reports do not become mandatory prerequisites', () => {
  const view = positiveView();
  view.documentation.diagnostics.push({ rule: 'evidence.missing', severity: 'info', message: 'No test report yet.' });
  const result = converge(view);
  assert.equal(result.verdict, 'Converged');
  assert.equal(result.counts.contracts.matched, 0);
  assert.match(result.gaps.join(' '), /provenance/);
});
test('a real contradiction remains Diverged even with incomplete discovery', () => {
  const view = positiveView();
  view.documentation.scope.complete = false;
  view.documentation.contracts[0].contract.status = 'invalid';
  assert.equal(converge(view).verdict, 'Diverged');
});
