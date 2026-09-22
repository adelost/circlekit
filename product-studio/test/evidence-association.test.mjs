import test from 'node:test';
import assert from 'node:assert/strict';
import { associateBehaviorReferences, decodeBehaviorReport } from '../lib/behavior-evidence.mjs';
import { declarationLawId } from '../lib/declaration-evidence.mjs';
import { testSourceIndex } from '../lib/test-source.mjs';

function report(file,line,name) {
  return decodeBehaviorReport({
    schemaVersion:'bdd.run.v1',
    run:{framework:'junit',frameworkVersion:null,project:null,repository:null,commitSha:null,branch:null,
      startedAt:'2026-09-22T10:00:00.000Z',finishedAt:'2026-09-22T10:00:01.000Z',durationMs:1000,status:'passed'},
    summary:{total:1,passed:1,failed:0,skipped:0,pending:0},
    tests:[{id:'sha256:'+'a'.repeat(64),name,fullName:'Example.'+name,file,line,level:null,documentation:'scenario',
      scenarios:[{name,phases:{given:'a port',when:'used',then:'it routes'},documented:true}],
      status:'passed',durationMs:1,retryCount:0,flaky:false}],
  });
}

test('Kotlin generated IDs and optional annotations stay associations, not runtime proof',()=>{
  const name='Given a port When used Then it routes';
  const sourceText=[
    'class ExampleTest {',
    '  /**',
    '   * @covers node-type::recording.service',
    '   * @proof host',
    '   */',
    '  fun `Given a port When used Then it routes`() {',
    '    use(GeneratedProductPortIds.RECORDING_PRESSURE)',
    '  }',
    '}',
  ].join('\\n');
  const source={path:'src/test/ExampleTest.kt',text:sourceText};
  const located=testSourceIndex(sourceText,source.path)[0];
  const ids={path:'generated/GeneratedProductPortIds.kt',text:[
    'object GeneratedProductPortIds {',
    '  data object RECORDING_PRESSURE : PortId { override val value = "recording.service.pressure" }',
    '}',
  ].join('\\n')};
  const architecture={entities:[
    {key:'node-type::recording.service',id:'recording.service'},
    {key:'port::recording.service.pressure',id:'recording.service.pressure'},
  ]};
  const associated=associateBehaviorReferences(report(source.path,located.line,name),[source],architecture,[ids]);
  const item=associated.tests[0];
  assert.equal(item.proofKind,'host');
  assert(item.associations.some(value=>value.kind==='author-declared'&&value.entityKey==='node-type::recording.service'));
  assert(item.associations.some(value=>value.kind==='source-reference'&&value.entityKey==='port::recording.service.pressure'));
});

test('unknown @covers target becomes a diagnostic rather than guessed identity',()=>{
  const name='Given x When y Then z';
  const sourceText=['/** @covers missing.service */',"test('Given x When y Then z',()=>{assert(true)});"].join('\\n');
  const source={path:'test/example.test.js',text:sourceText};
  const located=testSourceIndex(sourceText,source.path)[0];
  const associated=associateBehaviorReferences(report(source.path,located.line,name),[source],{entities:[]},[]);
  assert.match(associated.tests[0].associationDiagnostics[0],/Unknown @covers/);
});

test('generated declaration law identity changes with the model digest',()=>{
  const a=declarationLawId('a'.repeat(64),'node-type::x','node-type-structural-laws');
  const b=declarationLawId('b'.repeat(64),'node-type::x','node-type-structural-laws');
  assert.notEqual(a,b);
});
