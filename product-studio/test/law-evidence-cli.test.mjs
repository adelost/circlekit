import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as kernel from '@v1d/product-spec';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { main } from '../bin/law-evidence.mjs';

test('laws use the workspace product kernel and convention output without flags', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-laws-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const installed = path.join(root, 'node_modules/@v1d/product-spec');
  await mkdir(path.join(root, 'generated'), { recursive: true });
  await mkdir(installed, { recursive: true });
  await writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ packages: {
    'node_modules/@v1d/product-spec': { version: '0.3.66' },
  } }));
  await writeFile(path.join(installed, 'package.json'), JSON.stringify({
    name: '@v1d/product-spec', version: '0.3.66', type: 'module', exports: './index.mjs',
  }));
  await writeFile(path.join(installed, 'index.mjs'), `export * from ${JSON.stringify(import.meta.resolve('@v1d/product-spec'))};\n`);
  const reader = kernel.service({ id: 'fixture.reader', inputs: [], outputs: [], runtime: {
    stateOwner: 'external', lifetime: 'operation', durability: 'transient', clockDomain: 'wall',
    contextInputs: [], effects: ['fixture.read'],
  } });
  const product = { kind: 'product-spec-ir', schemaVersion: 9, id: 'fixture.app',
    nodeTypes: [reader], nodes: [{ id: 'reader', nodeTypeRef: reader.id }],
    components: [], componentTypes: [], artifacts: [],
    portRegistry: { nodePorts: [], componentPorts: [], bindings: [] } };
  const bundle = createInspectionBundle({ productId: product.id, product,
    compiler: { name: '@v1d/product-spec', version: '0.3.66' } });
  await writeFile(path.join(root, 'generated/app.studio.json'), JSON.stringify(bundle));
  await writeFile(path.join(root, 'studio.workspace.json'), JSON.stringify({ version: 2, projects: [
    { id: 'fixture.app', label: 'Fixture', bundle: 'generated/app.studio.json' },
  ] }));

  let output = '';
  const readOnlyCode = await main(['--root', root, '--stdout'],
    { stdout: { write: value => { output += value; } } });
  assert.equal(readOnlyCode, 0, output);
  const readOnlyReport = JSON.parse(output);
  assert.equal(readOnlyReport.tests[0].status, 'passed');
  assert.deepEqual(readOnlyReport.summary, { total: 1, passed: 1, failed: 0, skipped: 0, pending: 0 });
  await assert.rejects(readFile(path.join(root, 'test-results/fixture.app-laws.json')));

  output = '';
  const code = await main(['--root', root, '--output', 'test-results/fixture.app-laws.json'],
    { stdout: { write: value => { output += value; } } });
  assert.equal(code, 0);
  const receipt = JSON.parse(output);
  assert.equal(receipt.output, 'test-results/fixture.app-laws.json');
  assert.deepEqual(receipt.summary, { total: 1, passed: 1, failed: 0, skipped: 0, pending: 0 });
  assert.equal(receipt.evaluator, '0.3.66');
  const report = JSON.parse(await readFile(path.join(root, receipt.output), 'utf8'));
  assert.equal(report.tests[0].status, 'passed');

  output = '';
  const defaultCode = await main(['--root', root], { stdout: { write: value => { output += value; } } });
  assert.equal(defaultCode, 0);
  assert.equal(JSON.parse(output).output, receipt.output);
});
