import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { kernel, KERNEL_VERSION } from '../lib/kernel.mjs';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { entityKey } from '../lib/architecture.mjs';
import { openHeadlessStudio, selectProject, SemanticStudio } from '../lib/semantic.mjs';
import { Workbench } from '../lib/workspaces.mjs';
import { digest } from '../lib/util.mjs';
import { main } from '../bin/studio.mjs';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../bin/studio.mjs', import.meta.url));
const table = () => kernel.defineDecisionTable({ id: 'fixture.policy', axes: { permission: ['YES', 'NO'] },
  columns: { action: kernel.choice(['RUN', 'HOLD']) }, cells: [
    kernel.on('allow', { permission: 'YES' }, { action: 'RUN' }),
    kernel.on('deny', { permission: 'NO' }, { action: 'HOLD' }),
  ] });
const product = () => ({ kind: 'product-spec-ir', schemaVersion: 9, id: 'fixture.app',
  nodes: ['producer', 'consumer', 'unrelated'].map(id => ({ id, nodeTypeRef: 'code' })),
  nodeTypes: [{ id: 'code', kind: 'service' }], components: [], componentTypes: [], artifacts: [],
  portRegistry: { nodePorts: [
    { ref: 'producer.out', ownerId: 'producer', purpose: 'data' },
    { ref: 'consumer.in', ownerId: 'consumer', purpose: 'data' },
    { ref: 'consumer.other', ownerId: 'consumer', purpose: 'data' },
  ], componentPorts: [], bindings: [{ from: 'producer.out', to: 'consumer.in' }] } });
const policyKey = entityKey('facet', 'fixture.policy', 'decision-table');

async function fixture(t, { version = KERNEL_VERSION, full = true, two = false, source = 'export const marker = { id: "fixture.policy" };' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-semantic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'generated'));
  const bundle = createInspectionBundle({ productId: full ? 'fixture.app' : 'fixture.only',
    compiler: { name: '@v1d/product-spec', version }, product: full ? product() : null,
    facets: [{ kind: 'decision-table', id: 'fixture.policy', compiled: table() }],
    sources: [{ file: 'logic.mjs', digest: digest(source) }] });
  await writeFile(path.join(root, 'logic.mjs'), source);
  await writeFile(path.join(root, 'generated/app.studio.json'), JSON.stringify(bundle));
  const projects = [{ id: 'local', label: 'Fixture app', bundle: 'generated/app.studio.json' }];
  if (two) projects.push({ id: 'second', label: 'Same product, another selection', bundle: 'generated/app.studio.json' });
  await writeFile(path.join(root, 'studio.workspace.json'), JSON.stringify({ version: 2, projects }));
  const session = await openHeadlessStudio({ roots: [root] });
  const service = new SemanticStudio(session.workbench, session.projects[0].key);
  return { root, bundle, service, ...session };
}
async function invoke(args, cwd) {
  let stdout = '';
  const code = await main(args, { cwd, stdout: { write: text => { stdout += text; } } });
  return { code, body: JSON.parse(stdout), stdout };
}
test('converge keeps the JSON envelope and exits 2 when no evidence exists', async t => {
  const { root } = await fixture(t);
  const response = await invoke(['converge', root], root);
  assert.equal(response.code, 2);
  assert.equal(response.body.command, 'converge');
  assert.equal(response.body.result.verdict, 'Unknown');
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error.code, 'convergence.unknown');
});
test('record runs a real ProductSpec decision and derives its trace identity and file', async t => {
  const { root } = await fixture(t);
  const packageDir = fileURLToPath(new URL('../../product-spec/', import.meta.url));
  await mkdir(path.join(root, 'node_modules/@v1d'), { recursive: true });
  await symlink(packageDir, path.join(root, 'node_modules/@v1d/product-spec'));
  const run = ['record', root, '--product', 'local', '--', process.execPath, '--input-type=module', '-e',
    'import {defineDecisionTable,decide,choice,on} from "@v1d/product-spec";'
    + 'const table=defineDecisionTable({id:"fixture.policy",axes:{permission:["YES","NO"]},'
    + 'columns:{action:choice(["RUN","HOLD"])},cells:['
    + 'on("allow",{permission:"YES"},{action:"RUN"}),on("deny",{permission:"NO"},{action:"HOLD"})]});'
    + 'decide(table,{permission:"YES"});'];
  const response = await invoke(run, root);
  assert.equal(response.code, 0);
  assert.equal(response.body.events, 1);
  assert.equal(response.body.file, 'test-results/local-studio-trace.json');
  const trace = JSON.parse(await readFile(path.join(root, response.body.file), 'utf8'));
  assert.deepEqual(Object.keys(trace).sort(), ['events', 'kind', 'modelDigest', 'version']);
  assert.equal(trace.events[0].entityKey, entityKey('cell', 'allow', 'decision-table/fixture.policy'));
  const before = await readFile(path.join(root, response.body.file), 'utf8');
  const empty = await invoke(['record', root, '--product', 'local', '--', process.execPath, '-e', ''], root);
  assert.equal(empty.code, 1);
  assert.equal(empty.body.error.code, 'record.empty');
  assert.equal(await readFile(path.join(root, response.body.file), 'utf8'), before);
});
async function fileSnapshot(root, prefix = '') {
  const files = {};
  for (const item of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const file = path.join(prefix, item.name);
    if (item.isDirectory()) Object.assign(files, await fileSnapshot(root, file));
    else files[file] = digest(await readFile(path.join(root, file)));
  }
  return files;
}

test('headless attachment has one real product, no sample fallback and no storage', async t => {
  const { projects, workbench, root } = await fixture(t);
  assert.equal(projects.length, 1); assert.equal(projects[0].fixture, false);
  assert.equal(workbench.dataDir, undefined); assert.equal(workbench.gitDraftRoots.size, 0);
  const empty = path.join(root, 'empty'); await mkdir(empty);
  await assert.rejects(openHeadlessStudio({ roots: [empty] }), e => e.code === 'project.missing');
});
test('plan turns an exact source identity into PR-ready owners, ports and consumers',async t=>{
  const {root,service}=await fixture(t,{source:'export const changed={id:"producer"};'});
  const result=await service.execute('plan',{changed:['logic.mjs']});
  assert.equal(result.ok,true);
  assert.match(result.result.markdown,/node::producer/);
  assert.match(result.result.markdown,/port::producer.out/);
  assert.match(result.result.markdown,/node::consumer/);
  assert.match(result.result.markdown,/owner not declared|unknown/);
  const cli=await main(['plan',root,'--changed','logic.mjs'],{cwd:root,stdout:{write:s=>{assert.match(s,/node::consumer/);}}});
  assert.equal(cli,0);
});
test('headless product selection refuses ambiguity and accepts an exact workspace key', async t => {
  const { projects } = await fixture(t, { two: true });
  assert.throws(() => selectProject(projects), e => e.code === 'project.ambiguous');
  assert.throws(() => selectProject(projects, 'fixture.app'), e => e.code === 'project.ambiguous');
  assert.equal(selectProject(projects, 'second').id, 'second');
  assert.equal(selectProject(projects, projects[0].key).key, projects[0].key);
});
test('same product in two workspaces retains separate workspace identity', async t => {
  const a = await fixture(t), b = await fixture(t);
  const both = await openHeadlessStudio({ roots: [a.root, b.root, a.root] });
  assert.equal(both.projects.length, 2); assert.notEqual(both.projects[0].key, both.projects[1].key);
  assert.throws(() => selectProject(both.projects, 'local'), /Several/);
});
test('duplicate manifest IDs are rejected instead of overwriting one project', async t => {
  const { root } = await fixture(t);
  const manifest = JSON.parse(await readFile(path.join(root, 'studio.workspace.json'), 'utf8'));
  manifest.projects.push({ ...manifest.projects[0] });
  await writeFile(path.join(root, 'studio.workspace.json'), JSON.stringify(manifest));
  await assert.rejects(openHeadlessStudio({ roots: [root] }), e => e.code === 'workspace.duplicate');
});
test('headless and GUI loader agree on identity and the finite result', async t => {
  const { root, service } = await fixture(t);
  const gui = new Workbench({ dataDir: path.join(root, 'unused') }); await gui.initialize([root]);
  const view = gui.view(gui.require(gui.list().find(p => !p.fixture).key));
  assert.equal(view.modelDigest, service.view.modelDigest); assert.equal(view.bundleDigest, service.view.bundleDigest);
  const expected = gui.evaluate({ project: view.key, bundleDigest: view.bundleDigest, facetId: 'fixture.policy', facts: { permission: 'YES' } });
  const response = await service.execute('simulate', { facetId: 'fixture.policy', input: { facts: { permission: 'YES' } } });
  assert.equal(response.ok, true); assert.deepEqual(response.result, expected);
  assert.equal(response.evidenceKind, 'simulation');
});
test('inspect is paged and field projection never changes the envelope', async t => {
  const { service } = await fixture(t);
  const response = await service.execute('inspect', { max: 1, fields: ['key', 'kind'] });
  assert.equal(response.ok, true); assert.equal(response.result.entities.length, 1);
  assert.deepEqual(Object.keys(response.result.entities[0]), ['key', 'kind']);
  assert.equal(response.result.page.truncated, true); assert.equal(response.result.page.nextOffset, 1);
  assert.equal(response.modelDigest, service.view.modelDigest);
});
test('headless path keeps exact endpoint ports and exposes no-path distinctly', async t => {
  const { service } = await fixture(t);
  const args = { kind: 'path', from: entityKey('port', 'producer.out'), to: entityKey('port', 'consumer.in') };
  const pathResult = await service.execute('query', args);
  assert.equal(pathResult.result.found, true); assert.equal(pathResult.result.edgeIds.length, 1);
  const none = await service.execute('query', { ...args, to: entityKey('port', 'consumer.other') });
  assert.equal(none.ok, true); assert.equal(none.result.found, false);
});
test('unsupported facet impact is an error, not an empty success', async t => {
  const { service } = await fixture(t);
  const response = await service.execute('query', { kind: 'impact', from: policyKey });
  assert.equal(response.ok, false); assert.equal(response.error.code, 'query.unsupported');
  assert.equal(response.result.supported, false);
});
test('source command returns only actual provenance, with an explicit missing case', async t => {
  const { service } = await fixture(t);
  const source = await service.execute('source', { entity: policyKey });
  assert.equal(source.ok, true); assert.equal(source.result.file, 'logic.mjs');
  assert.equal(source.result.sourceDigest, service.view.sources[0].digest);
  const missing = await service.execute('source', { entity: entityKey('node', 'producer') });
  assert.equal(missing.ok, false); assert.equal(missing.error.code, 'source.unavailable');
});
test('different version permits inspection and refuses simulation', async t => {
  const { service } = await fixture(t, { version: '9.9.9' });
  assert.equal((await service.execute('inspect')).ok, true);
  const result = await service.execute('simulate', { facetId: 'fixture.policy', input: { facts: { permission: 'YES' } } });
  assert.equal(result.ok, false); assert.match(result.error.message, /compiled with/);
});
test('simulation input cannot override selected product or identity', async t => {
  const { service } = await fixture(t);
  const r = await service.execute('simulate', { facetId: 'fixture.policy', input: { facts: { permission: 'YES' }, project: 'foreign' } });
  assert.equal(r.ok, false); assert.equal(r.error.code, 'simulate.fields');
});
test('portable scenario document requires exact model identity before rebinding', async t => {
  const { service } = await fixture(t);
  const document = { kind: 'product-studio-scenario', version: 1, modelDigest: service.view.modelDigest,
    facetId: 'fixture.policy', scenario: { facetId: 'fixture.policy', bundleDigest: 'old-view',
      events: [{ atMs: 0, facts: { permission: 'YES' }, expect: { values: { action: 'RUN' } } }] } };
  const r = await service.execute('scenario', { document }); assert.equal(r.ok, true); assert.equal(r.result.pass, true);
  const wrong = await service.execute('scenario', { document: { ...document, modelDigest: '0'.repeat(64) } });
  assert.equal(wrong.ok, false); assert.equal(wrong.error.code, 'scenario.identity');
});
test('failed assertions fail the command; zero assertions remain unasserted', async t => {
  const { service } = await fixture(t);
  const scenario = { facetId: 'fixture.policy', bundleDigest: service.view.bundleDigest,
    events: [{ atMs: 0, facts: { permission: 'YES' }, expect: { values: { action: 'HOLD' } } }] };
  const bad = await service.execute('scenario', { document: scenario });
  assert.equal(bad.ok, false); assert.equal(bad.result.pass, false);
  delete scenario.events[0].expect;
  const unasserted = await service.execute('scenario', { document: scenario });
  assert.equal(unasserted.ok, true); assert.equal(unasserted.result.pass, null);
  assert.equal(unasserted.result.assertionStatus, 'unasserted');
});
test('trace command reuses GUI comparison and keeps incomplete recorded outcomes unknown', async t => {
  const { service } = await fixture(t);
  const capture = { kind: 'product-studio-trace', version: 1, productId: service.view.productId,
    modelDigest: service.view.modelDigest, sessionId: 'test', clock: { domain: 'monotonic', unit: 'ms' },
    provenance: 'synthetic', truncation: { droppedBefore: 0, gaps: [] }, events: [
      { sequence: 0, atMs: 1, kind: 'decision', entityKey: policyKey,
        logic: { facetId: 'fixture.policy', cellId: 'allow', facts: { permission: 'YES' }, values: { action: 'RUN' } } },
    ] };
  const checked = await service.execute('trace', { text: JSON.stringify(capture) });
  assert.equal(checked.ok, true); assert.equal(checked.result.logicCheck.kind, 'consistent');
  assert.equal(checked.evidenceKind, 'simulation');
  delete capture.events[0].logic.values;
  const partial = await service.execute('trace', { text: JSON.stringify(capture) });
  assert.equal(partial.result.logicCheck.kind, 'unknown');
  const compact={kind:'product-studio-trace',version:1,modelDigest:service.view.modelDigest,
    events:[{kind:'decision',entityKey:policyKey,logic:{facetId:'fixture.policy',cellId:'allow',facts:{permission:'YES'},values:{action:'RUN'}}}]};
  const concise=await service.execute('trace',{text:JSON.stringify(compact),fileName:'test-results/fixture-trace.json'});
  assert.equal(concise.ok,true);assert.equal(concise.result.logicCheck.kind,'consistent');
  assert.equal(concise.result.sessionId,'fixture-trace.json');
});
test('CLI commands make no source, draft, scenario or Git file changes', async t => {
  const { root, service } = await fixture(t), before = await fileSnapshot(root);
  const r = await invoke(['inspect', '--max', '2'], root);
  assert.equal(r.code, 0); assert.equal(r.body.modelDigest, service.view.modelDigest);
  const sim = await invoke(['simulate', '--facet', 'fixture.policy', '--input', '{"facts":{"permission":"NO"}}'], root);
  assert.equal(sim.code, 0); assert.equal(sim.body.result.values.action, 'HOLD');
  assert.deepEqual(await fileSnapshot(root), before);
});
test('CLI model precondition and explicit examples cannot silently select another app', async t => {
  const { root } = await fixture(t);
  const mismatch = await invoke(['inspect', '--expect-model', '0'.repeat(64)], root);
  assert.equal(mismatch.code, 1); assert.equal(mismatch.body.error.code, 'identity.model');
  const samples = await invoke(['simulate', '--examples', '--product', 'amux-fixture', '--facet', 'amux.context-cost',
    '--input', '{"facts":{"need":"UNKNOWN","readiness":"SAFE","attempt":"NEW"}}'], root);
  assert.equal(samples.body.result.values.action, 'HOLD');
});
test('CLI process emits parseable JSON with exit status matching refusal', async t => {
  const { root } = await fixture(t);
  const good = await exec(process.execPath, [cli, 'inspect', root], { timeout: 15000 });
  assert.equal(JSON.parse(good.stdout).ok, true); assert.equal(good.stderr, '');
  try {
    await exec(process.execPath, [cli, 'query', root, '--kind', 'impact', '--from', policyKey], { timeout: 15000 });
    assert.fail('Unsupported impact must not exit successfully.');
  } catch (e) {
    assert.equal(e.code, 1); assert.equal(JSON.parse(e.stdout).error.code, 'query.unsupported'); assert.equal(e.stderr, '');
  }
});


test('a matching ID in changed source cannot masquerade as exact model provenance', async t => {
  const { root, service } = await fixture(t);
  await writeFile(path.join(root, 'logic.mjs'), 'export const marker = { id: "fixture.policy", changed: true };');
  const refreshed = await openHeadlessStudio({ roots: [root] });
  const current = new SemanticStudio(refreshed.workbench, refreshed.projects[0].key);
  assert.equal(current.view.modelDigest, service.view.modelDigest);
  assert.equal(current.view.sourceIdentity.kind, 'stale');
  const source = await current.execute('source', { entity: policyKey });
  assert.equal(source.ok, false); assert.equal(source.error.code, 'source.unavailable');
});
