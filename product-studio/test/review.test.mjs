import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { changedFilesForReview, reviewForChanges } from '../lib/review.mjs';
import { planForChanges } from '../lib/plan.mjs';
import { entityKey } from '../lib/architecture.mjs';

async function repository(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-review-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Studio test');
  git('config', 'user.email', 'studio@example.test');
  await writeFile(path.join(root, 'tracked.ts'), 'before\n');
  git('add', 'tracked.ts');
  git('commit', '-qm', 'base');
  return { root, git };
}

test('review sees tracked work against HEAD and untracked files', async t => {
  const { root } = await repository(t);
  await writeFile(path.join(root, 'tracked.ts'), 'after\n');
  await writeFile(path.join(root, 'new.ts'), 'new\n');
  assert.deepEqual(await changedFilesForReview(root), ['new.ts', 'tracked.ts']);
});

test('review includes committed branch changes since origin/main merge-base', async t => {
  const { root, git } = await repository(t);
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  await writeFile(path.join(root, 'committed.ts'), 'branch\n');
  git('add', 'committed.ts');
  git('commit', '-qm', 'feature');
  await writeFile(path.join(root, 'tracked.ts'), 'worktree\n');
  assert.deepEqual(await changedFilesForReview(root), ['committed.ts', 'tracked.ts']);
});

const selected = () => {
  const view = { productId: 'demo', architecture: { entities: [], edges: [] },
    documentation: { reports: [], contracts: [], diagnostics: [], unresolved: [] },
    sourceIndex: { origins: [] }, sourceIdentity: { kind: 'not-exported' },
    compatibility: { producer: '0.3.67', evaluator: '0.3.67' } };
  const project = { config: { root: '/repo', id: 'demo' }, sources: [] };
  return { service: { view, metadata: () => ({ producer: { productSpec: '0.3.67' },
    evaluator: { productSpec: '0.3.67' }, sourceIdentity: view.sourceIdentity }),
    plan: ({ changed }) => planForChanges(view, project, changed) }, project,
    convergence: { verdict: 'Unknown', label: 'Unknown', reasons: [], gaps: ['No declaration-law report.'],
    counts: { laws: { passed: 0, failed: 0, skipped: 0 }, trace: { consistent: 0, different: 0, unknown: 0 },
      contracts: { validated: 0, total: 0 } }, kernel: { match: true }, traceIdentity: { loaded: false } },
  };
};

test('a changed file without a declared entity is named without inventing an owner', () => {
  const input = selected();
  const report = reviewForChanges({ ...input, changes: ['README.md'] });
  assert.match(report, /Not model source: README\.md/);
  assert.doesNotMatch(report, /Unknown source\/entity: README\.md/);
  assert.match(report, /No declared entity changed/);
  input.project.sources.push({path:'model.ts',text:'export const unnamed = {};'});
  assert.match(reviewForChanges({ ...input, changes: ['model.ts'] }), /Unknown: model\.ts/);
});

test('an empty diff is a successful no-change review with the converge result', () => {
  const report = reviewForChanges({ ...selected(), changes: [] });
  assert.match(report, /No declared entity changed/);
  assert.match(report, /RESULT[\s\S]*Unknown/);
  assert.doesNotMatch(report, /Fix:/);
});

test('a changed machine uses its declared owner WHAT/WHY and inputs', () => {
  const input = selected();
  const facet = entityKey('facet', 'recording.session', 'machine');
  const owner = entityKey('node-type', 'recording.runtime-owner');
  input.service.view.architecture.entities = [
    { key: facet, kind: 'facet', id: 'recording.session' },
    { key: owner, kind: 'node-type', id: 'recording.runtime-owner', data: { id: 'recording.runtime-owner', inputs: [{ id: 'start' }] } },
  ];
  input.service.view.architecture.edges = [{ kind: 'owner', from: facet, to: owner }];
  input.service.view.documentation.contracts = [{ entityKey: owner, contract: { what: 'Owns the recording session.', why: 'Keeps file writes ordered.' }, source: { file: 'runtime.ts', line: 4 } }];
  const report = reviewForChanges({ ...input, changes: [facet] });
  assert.match(report, /recording\.runtime-owner/);
  assert.match(report, /WHAT: Owns the recording session/);
  assert.match(report, /WHY: Keeps file writes ordered/);
  assert.match(report, /Inputs: start/);
  assert.match(report, /Machine\/table: recording\.session/);
});

test('a loaded law file for the previous model is not a checked evidence item', () => {
  const input = selected();
  input.project.config.documentation = { bddReports: ['test-results/demo-laws.json'] };
  input.service.view.documentation.reports = [{ file: 'test-results/demo-laws.json', status: 'loaded', modelCorrelation: 'different-model' }];
  const report = reviewForChanges({ ...input, changes: [] });
  assert.match(report, /○ laws not for this model \(test-results\/demo-laws\.json\)/);
  assert.doesNotMatch(report, /✓ laws/);
});

test('port-only trace names its recorded events without inventing logic comparisons', () => {
  const input=selected();
  input.service.view.trace={events:Array.from({length:6},()=>({kind:'port'}))};
  const report=reviewForChanges({...input,changes:[]});
  assert.match(report,/6 port events \(no logic comparison\)/);
  assert.doesNotMatch(report,/Trace steps: 0 consistent/);
});

test('owners without WHAT/WHY share one missing-intent line', () => {
  const input=selected();
  const ids=['replay.presentation','logbook.replay','logbook.terrain-replay'];
  const keys=ids.map(id=>entityKey('node-type',id));
  input.service.view.architecture.entities=ids.map((id,i)=>({key:keys[i],kind:'node-type',id,data:{id}}));
  input.service.plan=()=>({selected:keys,unknown:[],markdown:'### Studio plan: demo\n- Owners: replay'});
  const report=reviewForChanges({...input,changes:['replay.ts']});
  assert.match(report,/No WHAT\/WHY declared for: replay\.presentation, logbook\.replay, logbook\.terrain-replay/);
  assert.doesNotMatch(report,/WHAT: not declared in this source scope/);
});
