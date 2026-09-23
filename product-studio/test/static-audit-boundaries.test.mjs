import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeJUnitXml } from '../bin/junit-evidence.mjs';
import { documentationView, intentPanel } from '../public/documentation.js';

// These cases were written, not executed, during the 2026-09-23 static review.
for (const attributes of ['tests="2"', 'failures="1"', 'errors="1"', 'skipped="1"']) {
  test(`JUnit validates aggregate counters too: ${attributes}`, () => {
    const xml = `<testsuites ${attributes}><testsuite tests="1"><testcase name="ok"/></testsuite></testsuites>`;
    assert.throws(() => decodeJUnitXml(xml), error => error.code === 'evidence.count');
  });
}
test('an aggregate zero failure count cannot conceal a descendant failure', () => {
  const xml = '<testsuites failures="0"><testsuite><testcase><failure/></testcase></testsuite></testsuites>';
  assert.throws(() => decodeJUnitXml(xml), error => error.code === 'evidence.count');
});
test('aggregate counters count each descendant case once', () => {
  const xml = '<testsuites tests="2" errors="1" failures="0" skipped="0">'
    + '<testsuites tests="1"><testsuite tests="1"><testcase name="ok"/></testsuite></testsuites>'
    + '<testsuite tests="1" errors="1"><testcase name="bad"><error/></testcase></testsuite></testsuites>';
  assert.deepEqual(decodeJUnitXml(xml).suites.flatMap(suite => suite.cases.map(item => item.status)), ['passed', 'failed']);
});
test('aggregate bookkeeping has a bounded nesting budget', () => {
  assert.throws(() => decodeJUnitXml('<testsuites>'.repeat(65) + '</testsuites>'.repeat(65)),
    error => error.code === 'evidence.junit-xml');
});

test('report details distinguish author-declared associations from source references', () => {
  const project = { bundleDigest: 'model', sources: [] };
  const page = { total: 1, offset: 0, nextOffset: null, rows: [{
    report: { file: 'test-results/bdd-run.json', reportDigest: 'report', status: 'loaded', run: { framework: 'vitest' } },
    test: { id: 'test', name: 'selected test', status: 'passed', proofKind: 'host', scenarios: [], associations: [
      { entityKey: 'node-type::capture', kind: 'author-declared' },
      { entityKey: 'port::capture.status', kind: 'source-reference' },
    ] },
  }] };
  const html = documentationView(project, { documentationSection: 'reports', documentationOffset: 0,
    documentationPage: { ticket: 'model:reports:0', value: page } }, String);
  assert.match(html, /author-declared/);
  assert.match(html, /source-reference/);
  assert.match(html, /Associations, not coverage/);
  assert.doesNotMatch(html, /exact ID references/);
});
test('entity intent retains the backend association label', () => {
  const html = intentPanel({ typeKey: 'node-type::capture', contract: null, declared: null, testTotal: 1,
    tests: [{ name: 'selected test', status: 'passed', proofKind: 'host', association: 'author-declared', file: null }],
    notice: 'Reported evidence only.',
  }, { sources: [] }, String);
  assert.match(html, /Association: author-declared \(not coverage\)/);
});
