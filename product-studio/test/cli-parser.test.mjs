import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseCli, readJsonInputFile, formatJson } from '../lib/cli.mjs';
import { main } from '../bin/studio.mjs';

// No ProductSpec dependency is required for these parsing and I/O boundaries.
test('CLI parses only command-owned options and preserves caller argument arrays', () => {
  const args = ['query', '/repo', '--kind', 'path', '--from', 'node::a', '--to=node::b', '--purposes', 'data,context', '--pretty'];
  const before = [...args], p = parseCli(args);
  assert.deepEqual(args, before); assert.equal(p.command, 'query');
  assert.equal(p.values.to, 'node::b'); assert.deepEqual(p.values.purposes, ['data', 'context']);
  assert.equal(p.values.pretty, true);
});
test('the documented check command uses the shared contracts path', () => {
  const parsed=parseCli(['check','--product','my-product']);
  assert.equal(parsed.command,'contracts');
  assert.equal(parsed.values.product,'my-product');
});
test('live receiver is an explicit serve-only switch',()=>{
  assert.equal(parseCli(['serve','--live']).values.live,true);
  assert.equal(parseCli(['serve']).values.live,undefined);
  assert.throws(()=>parseCli(['doctor','--live']),error=>error.code==='cli.usage');
});
test('plan accepts bounded changed entities and source files',()=>{
  const p=parseCli(['plan','/repo','--changed','node-type::catalog.tags','--changed','src/catalog/tags.ts']);
  assert.deepEqual(p.repeated.changed,['node-type::catalog.tags','src/catalog/tags.ts']);
  assert.throws(()=>parseCli(['plan','/repo']),e=>e.code==='cli.usage');
});
test('review accepts an empty implicit Git diff or explicit changed source', () => {
  assert.deepEqual(parseCli(['review']).repeated.changed, []);
  assert.deepEqual(parseCli(['review', '--changed', 'src/service.ts']).repeated.changed, ['src/service.ts']);
});
test('explicit workspace export is selected as a write command', () => {
  const parsed=parseCli(['export','--product','my-product']);
  assert.equal(parsed.command,'export');
  assert.equal(parsed.values.product,'my-product');
  assert.throws(()=>parseCli(['export','--output','other.studio.json']),error=>error.code==='cli.usage');
});
test('unknown, duplicate and write flags are refused on every read command', () => {
  for (const args of [
    ['inspect', '--wat', 'x'], ['inspect', '--product', 'a', '--product', 'b'],
    ['simulate', '--facet', 'a', '--input', '{}', '--allow-git-drafts', '/repo'],
    ['trace', '--file', 't.json', '--port', '17317'], ['source', '--entity', 'a', '--force'],
    ['query', '--kind', 'upstream', '--from', 'a', '--to', 'b'],
    ['query', '--kind', 'path', '--from', 'a'], ['simulate', '--facet', 'a'],
    ['inspect', '--fields', 'constructor'], ['inspect', '--pretty=false'],
  ]) assert.throws(() => parseCli(args), e => e.code === 'cli.usage');
});
test('zero, negative, oversized and partial numeric inputs have explicit rules', () => {
  assert.equal(parseCli(['trace', '--file', 'x', '--cursor', '-1']).values.cursor, -1);
  for (const n of ['0', '-1', '1001', '1.5', '2oops']) assert.throws(() => parseCli(['inspect', '--max', n]));
  for (const n of ['-1', '9007199254740992']) assert.throws(() => parseCli(['inspect', '--offset', n]));
});
test('repeated source inputs apply only to bundle; simulation has one exact facet', () => {
  assert.equal(parseCli(['bundle', '--compiler-version', '0.3.65', '--facet', 'a', '--facet', 'b']).repeated.facet.length, 2);
  assert.throws(() => parseCli(['simulate', '--facet', 'a', '--facet', 'b', '--input', '{}']));
});
test('argument terminator and repository paths containing spaces remain exact', () => {
  const parsed = parseCli(['inspect', '--', './my repository']);
  assert.deepEqual(parsed.positional, ['./my repository']);
  assert.equal(parseCli(['./my repository']).command, 'serve');
});
test('usage errors produce one JSON envelope and exit 2 before loading a kernel', async () => {
  let output = '';
  const code = await main(['simulate', '--allow-git-drafts', '/repo'], { stdout: { write: s => { output += s; } } });
  const body = JSON.parse(output);
  assert.equal(code, 2); assert.equal(body.ok, false); assert.equal(body.error.code, 'cli.usage');
  assert.equal(output.trim().split('\n').length, 1);
});
test('help works independently of workspace and package installation', async () => {
  let output = '';
  assert.equal(await main(['--help'], { stdout: { write: s => { output += s; } } }), 0);
  assert.match(output, /v1d-studio query/); assert.match(output, /--examples/);
  assert.match(output, /--port 17317/);
});
test('JSON file input is bounded and parsed, not evaluated', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-cli-json-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'facts.json'), '{"facts":{"ready":true}}');
  assert.deepEqual(await readJsonInputFile('facts.json', root), { facts: { ready: true } });
  await assert.rejects(readJsonInputFile(root), /ordinary|exceeds/);
  await writeFile(path.join(root, 'bad.json'), '{"__proto__":{}}');
  await assert.rejects(readJsonInputFile('bad.json', root), /Reserved/);
  await writeFile(path.join(root, 'large.json'), ' '.repeat(8_000_001));
  await assert.rejects(readJsonInputFile('large.json', root), /8 MB/);
});
test('output formatter refuses overflow instead of cropping semantic evidence', () => {
  assert.deepEqual(JSON.parse(formatJson({ ok: true }, true)), { ok: true });
  assert.throws(() => formatJson({ data: 'x'.repeat(8_000_001) }), /Narrow/);
});
