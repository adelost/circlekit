import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeSource } from '../lib/source.mjs';
import { evaluateFacet, enumerateTable } from '../lib/simulation.mjs';

const read = name => readFile(new URL('../fixtures/' + name, import.meta.url), 'utf8');
const machineSource = await read('workflow.ts'), amuxSource = await read('amux.mjs');
const minimal = `import {defineDecisionTable, choice, on} from '@v1d/product-spec';
export const t = defineDecisionTable({id:'test.table',axes:{a:['A','B']},columns:{answer:choice(['YES','NO'])},cells:[on('a',{a:'A'},{answer:'YES'}),on('b',{a:'B'},{answer:'NO'})]});`;

test('synthetic workflow compiles to four states and seven cells', () => {
  const p = analyzeSource(machineSource); assert.equal(p.valid, true, JSON.stringify(p.diagnostics));
  assert.equal(p.facets[0].compiled.states.length, 4); assert.equal(p.facets[0].compiled.cells.length, 7);
});
test('AMUX preserves all 18 + 24 finite decisions and protected NONE/FAILED behavior', () => {
  const p = analyzeSource(amuxSource, 'policy.mjs'); assert.equal(p.valid, true);
  assert.deepEqual(p.facets.map(f => enumerateTable(f).length), [18, 24]);
  assert.equal(evaluateFacet(p.facets[0], { facts: { need: 'NONE', readiness: 'UNSAFE', attempt: 'FAILED' } }).values.action, 'CONTINUE');
});
test('independent pipeline fixture has 12 points and a named wait cell', async () => {
  const p = analyzeSource(await read('pipeline.mjs')); assert.equal(p.valid, true);
  assert.equal(enumerateTable(p.facets[0]).length, 12);
  assert.equal(evaluateFacet(p.facets[0], { facts: { job: 'QUEUED', device: 'BUSY', stage: 'WORK' } }).cell, 'queued-wait');
});
test('Showcase data-only case arrays are inspectable, not called compiler-validated', async () => {
  const p = analyzeSource(await read('showcase.ts')); assert.equal(p.facets.length, 0);
  assert.equal(p.dataExports.showcaseCases.length, 3); assert.equal(p.valid, false); assert.equal(p.diagnostics.length, 0);
});
test('aliased imported constructors resolve to their real exports', () => {
  const p = analyzeSource(minimal.replace('defineDecisionTable,', 'defineDecisionTable as make,').replace('= defineDecisionTable(', '= make(')); assert.equal(p.valid, true);
});
test('namespace import works without executing an import', () => {
  const p = analyzeSource(minimal.replace("import {defineDecisionTable, choice, on}", 'import * as spec').replace(/= defineDecisionTable\(/, '= spec.defineDecisionTable(').replace(/choice\(/g, 'spec.choice(').replace(/on\(/g, 'spec.on(')); assert.equal(p.valid, true, JSON.stringify(p.diagnostics));
});
test('same-named local function is not mistaken for ProductSpec', () => {
  const p = analyzeSource("function defineMachine(x){ return x; } export const x=defineMachine({id:'not.a.machine'});"); assert.equal(p.facets.length, 0);
});
test('literal wrappers and same-file shared constant preserve origin', () => {
  const s = minimal.replace("axes:{a:['A','B']}", 'axes:AXES').replace('export const t', "const AXES = {a:['A','B']} as const; export const t");
  const p = analyzeSource(s); assert.equal(p.valid, true); assert.equal(p.facets[0].source.line, 2);
});
test('simple construction helper is read, not imported and executed', () => {
  const s = minimal.replace('export const t = defineDecisionTable(', 'function build(declaration) { return defineDecisionTable(declaration); } export const t = build(');
  assert.equal(analyzeSource(s).valid, true);
});
test('missing coverage is refused by the actual table compiler', () => {
  const p = analyzeSource(minimal.replace(",on('b',{a:'B'},{answer:'NO'})", '')); assert.equal(p.valid, false); assert.match(p.diagnostics[0].message, /no cell covers/);
});
test('overlapping regions are refused', () => {
  const p = analyzeSource(minimal.replace("{a:'B'},{answer:'NO'}", "{a:'A'},{answer:'NO'}")); assert.equal(p.valid, false); assert.match(p.diagnostics[0].message, /covered by 2 cells/);
});
test('original invariant callback is evaluated, not discarded in a draft', () => {
  const s = amuxSource.replace("on('unknown-evidence', { need: 'UNKNOWN' }, { action: 'HOLD' })", "on('unknown-evidence', { need: 'UNKNOWN' }, { action: 'CONTINUE' })");
  const p = analyzeSource(s); assert.equal(p.valid, false); assert.ok(p.diagnostics.some(d => /unknown context evidence cannot/.test(d.message)));
});
test('data fields are edited by AST span without replacing the whole source', () => {
  const p = analyzeSource(machineSource);
  const changed = p.planCellEdit('example.request', 'reply-failure', 'to', 'SUCCESS');
  assert.equal(changed.text.slice(0, changed.span.start), machineSource.slice(0, changed.span.start));
  assert.equal(analyzeSource(changed.text).facets[0].compiled.cells.find(c => c.id === 'reply-failure').to, 'SUCCESS');
});
test('table values lens understands on(id, region, values)', () => {
  const p = analyzeSource(minimal); const change = p.planCellEdit('test.table', 'a', 'values', { answer: 'NO' });
  const q = analyzeSource(change.text); assert.equal(q.valid, true); assert.equal(q.facets[0].compiled.cells[0].values.answer, 'NO');
});
test('literal cell lens refuses derived cells instead of flattening them', () => {
  const s = minimal.replace("cells:[on('a',{a:'A'},{answer:'YES'}),on('b',{a:'B'},{answer:'NO'})]", "cells:[on('a',{a:'A'},{answer:'YES'}),on('b',{a:'B'},{answer:'NO'})].map(x=>x)");
  const p = analyzeSource(s); assert.equal(p.valid, true); assert.throws(() => p.planCellEdit('test.table', 'a', 'values', { answer: 'NO' }), /Cells are derived/);
});
test('function and IO expressions are not executed', () => {
  globalThis.studioExploit = false;
  const p = analyzeSource("export const x = (() => { globalThis.studioExploit = true; return fetch('https://example.com'); })();");
  assert.equal(p.valid, false); assert.equal(globalThis.studioExploit, false); delete globalThis.studioExploit;
});
test('prototype access and getters are refused', () => {
  for (const text of ["export const x = ({}).constructor;", "export const x = {get x(){throw 1;}};", "export const x = {__proto__: {}};"]) {
    const p = analyzeSource(text); assert.equal(p.valid, false); assert.ok(p.diagnostics.length);
  }
});
test('computed source member cannot masquerade as namespace', () => {
  const p = analyzeSource("export const x = ({__studioNamespace: true}).defineMachine({});"); assert.equal(p.facets.length, 0); assert.ok(p.diagnostics.length);
});
test('duplicate declaration IDs fail rather than overwrite', () => {
  const s = minimal + minimal.slice(minimal.indexOf('export const')).replace('const t', 'const t2');
  const p = analyzeSource(s); assert.equal(p.valid, false); assert.ok(p.diagnostics.some(d => d.rule === 'source.duplicate-id'));
});
test('large Cartesian product rejected before compiler expansion', () => {
  const axes = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['a' + i, ['A', 'B', 'C']]));
  const s = minimal.replace("{a:['A','B']}", JSON.stringify(axes));
  const p = analyzeSource(s); assert.equal(p.valid, false); assert.ok(p.diagnostics.some(d => d.rule === 'table.budget'));
});
test('syntax errors carry a real source line and do not show green', () => {
  const p = analyzeSource('export const a = {', 'broken.ts'); assert.equal(p.valid, false); assert.ok(p.diagnostics[0].line > 0);
});
test('cyclic constants fail within a bounded traversal', () => {
  const p = analyzeSource('const a=b; const b=a; export const c=a;'); assert.equal(p.valid, false); assert.equal(p.diagnostics[0].rule, 'source.cycle');
});

test('visual edit cannot remove the only incoming route to PENDING', () => {
  const p = analyzeSource(machineSource);
  const change = p.planCellEdit('example.request', 'send', 'to', 'SUCCESS');
  const q = analyzeSource(change.text);
  assert.equal(q.valid, false); assert.ok(q.diagnostics.some(d => /no cell reaches PENDING/.test(d.message)));
});
test('top-level mutation cannot be silently treated as validated source', () => {
  const p = analyzeSource(minimal + '\nt.axes.a.push("C");');
  assert.equal(p.valid, false); assert.ok(p.diagnostics.some(d => /Top-level/.test(d.message)));
});
test('literal transition insertion preserves existing comments and runs the same compiler', () => {
 const p = analyzeSource(machineSource);
 const next = p.planInsert('example.request', 'cells', { id: 'retry', from: 'FAILURE', on: 'Send', to: 'PENDING' });
 const q = analyzeSource(next.text);
 assert.equal(q.valid, true, JSON.stringify(q.diagnostics)); assert.equal(q.facets[0].compiled.cells.length, 8);
 assert.ok(next.text.includes('Synthetic request lifecycle'));
});
