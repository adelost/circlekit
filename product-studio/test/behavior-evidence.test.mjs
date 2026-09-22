import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeBehaviorReport, associateBehaviorReferences } from '../lib/behavior-evidence.mjs';

export const reportFixture=()=>({schemaVersion:'bdd.run.v1',run:{framework:'vitest',frameworkVersion:'4.0.18',project:'example',repository:'owner/example',commitSha:'abc',branch:'work',startedAt:'2026-09-22T10:00:00Z',finishedAt:'2026-09-22T10:00:01Z',durationMs:1000,status:'passed'},summary:{total:1,passed:1,failed:0,skipped:0,pending:0},tests:[{id:'sha256:'+'a'.repeat(64),name:'sends once',fullName:'recorder sends once',file:'test/recorder.test.ts',line:2,level:'unit',documentation:'scenario',scenarios:[{name:'sends once',phases:{given:'an armed recorder',when:'a command arrives',then:'it starts once'},documented:true}],status:'passed',durationMs:12,retryCount:0,flaky:false}]});

test('Given a canonical BDD report When reading Then the original status level and phases survive',()=>{
  const r=decodeBehaviorReport(reportFixture(),{repository:'owner/example',revision:'abc'});
  assert.equal(r.correlation,'same-reported-commit');assert.equal(r.tests[0].level,'unit');assert.equal(r.tests[0].scenarios[0].phases.then,'it starts once');
});
for(const [name,mutate] of [
  ['future schema',r=>r.schemaVersion='bdd.run.v2'],
  ['wrong summary',r=>r.summary.passed=2],
  ['duplicate IDs',r=>{r.tests.push({...r.tests[0]});r.summary.total=2;r.summary.passed=2;}],
  ['absolute path',r=>r.tests[0].file='/etc/passwd'],
  ['relative escape',r=>r.tests[0].file='test/../../secret'],
  ['false flaky claim',r=>r.tests[0].flaky=true],
  ['invented coverage field',r=>r.tests[0].covers=['recording']],
  ['empty Then',r=>r.tests[0].scenarios[0].phases.then=''],
  ['run timestamps reversed',r=>r.run.finishedAt='2026-09-21T10:00:00Z'],
])test(`Given ${name} When reading Then evidence is refused`,()=>{
  const r=reportFixture();mutate(r);assert.throws(()=>decodeBehaviorReport(r));
});
test('Given foreign or missing provenance When reading Then no current-revision proof is claimed',()=>{
  assert.equal(decodeBehaviorReport(reportFixture(),{repository:'different/repo',revision:'abc'}).correlation,'foreign-repository');
  assert.equal(decodeBehaviorReport(reportFixture(),{repository:'owner/example',revision:'changed'}).correlation,'different-revision');
  assert.equal(decodeBehaviorReport(reportFixture()).correlation,'unavailable');
});
test('Given a test body referencing an exact port When associating Then only a source-reference is reported',()=>{
  const r=decodeBehaviorReport(reportFixture());
  const source={path:r.tests[0].file,text:`// source\ntest('sends once',()=>{send('recorder.start')});`};
  const a=associateBehaviorReferences(r,[source],{entities:[{id:'recorder.start',key:'port::recorder.start'}]});
  assert.equal(a.tests[0].associations[0].kind,'source-reference');assert.equal(a.tests[0].associations[0].entityKey,'port::recorder.start');
});
test('Given an ID only in a test title When associating Then names are not coverage',()=>{
  const r=decodeBehaviorReport(reportFixture());r.tests[0].name='recorder.start';
  const a=associateBehaviorReferences(r,[{path:r.tests[0].file,text:`// x\ntest('recorder.start',()=>{assert(true)});`}],{entities:[{id:'recorder.start',key:'port::recorder.start'}]});
  assert.equal(a.tests[0].associations.length,0);
});
test('Given a native test When associating Then unsupported source analysis stays unavailable',()=>{
  const r=decodeBehaviorReport(reportFixture());r.tests[0].file='test/RecorderTest.kt';
  const a=associateBehaviorReferences(r,[{path:r.tests[0].file,text:'GeneratedPortIds.RECORDING'}],{entities:[]});
  assert.equal(a.tests[0].associationStatus,'unavailable');
});
