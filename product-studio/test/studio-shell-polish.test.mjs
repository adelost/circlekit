import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { architectureControls, entityInspector, projectSummary } from '../public/studio-tools.js';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const escape = value => String(value ?? '');

test('empty structure has no heading or placeholder in the explorer', () => {
  assert.ok(app.includes('project.graph.nodes.length ? `<div class="section-label">Structure'));
  assert.doesNotMatch(app, /Load a generated product to explore its full graph\./);
});

test('four secondary actions are available in one closed Add menu', () => {
  assert.match(app, /<details class="view-menu"><summary>Add…<\/summary>/);
  for (const name of ['import', 'new', 'saved', 'connect-help']) assert.match(app, new RegExp(`action\\('${name}'`));
  assert.doesNotMatch(app, /<div class="explorer-actions">\$\{action\('import'/);
});

test('System renders its graph before collapsed architecture questions', () => {
  const view = app.slice(app.indexOf('function systemView()'), app.indexOf('function evidenceView()'));
  assert.ok(view.indexOf("panel(`Declared topology") < view.indexOf('architectureControls(project,state,escape)'));
  assert.match(architectureControls({architecture:{entities:[],groups:[]}}, {}, escape), /<details class="panel" ><summary/);
});

test('header groups the verdict and mode before reload', () => {
  const start = app.indexOf('<div class="top-actions">');
  const header = app.slice(start, app.indexOf('</header>', start));
  assert.ok(header.indexOf('top-mode') < header.indexOf("action('reload'"));
});

test('evidence boundary appears only in the inspector summary', () => {
  assert.doesNotMatch(app.slice(app.indexOf('<aside class="explorer"'), app.indexOf('</aside>')), /Evidence boundary/);
  const project = {convergence:{verdict:'Unknown',counts:{laws:{passed:0,failed:0,skipped:0},contracts:{validated:0,total:0}}},provenance:'Standalone declarations.'};
  assert.match(projectSummary(project,escape), /Standalone declarations\./);
});

test('missing source is a muted fact, not a disabled primary action', () => {
  const project = {architecture:{entities:[{kind:'facet',key:'facet/a',id:'a'}],edges:[]},sourceIndex:{origins:[],unresolved:[{entityKey:'facet/a',reason:'No unique source location was exported or found.'}]}};
  const html = entityInspector(project,{id:'facet/a'},escape);
  assert.doesNotMatch(html, /<button[^>]*disabled/);
  assert.match(html, /<small class="muted">No unique source location/);
});
