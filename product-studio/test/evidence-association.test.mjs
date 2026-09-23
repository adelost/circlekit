import test from 'node:test';
import assert from 'node:assert/strict';
import { associateBehaviorReferences, decodeBehaviorReport } from '../lib/behavior-evidence.mjs';
import { declarationLawId } from '../lib/declaration-evidence.mjs';
import { testSourceIndex } from '../lib/test-source.mjs';
import { decodeJUnitXml } from '../bin/junit-evidence.mjs';

test('Node JUnit reader preserves nested suite outcomes and refuses DTDs',()=>{
  const xml='<testsuites><testsuite name="selected" timestamp="2026-09-23T00:00:00Z" time="1" tests="2">'
    +'<testcase name="failed" classname="Example" time="0.1"><failure message="bad"/></testcase>'
    +'<testcase name="skipped" classname="Example"><skipped/></testcase></testsuite></testsuites>';
  const [suite]=decodeJUnitXml(xml).suites;
  assert.equal(suite.name,'selected');
  assert.deepEqual(suite.cases.map(c=>c.status),['failed','skipped']);
  assert.throws(()=>decodeJUnitXml('<!DOCTYPE testsuite><testsuite/>'),/unsupported entity declarations/i);
  assert.throws(()=>decodeJUnitXml('<testsuite><testcase></testsuite>'));
});

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
  ].join('\n');
  const source={path:'src/test/ExampleTest.kt',text:sourceText};
  const located=testSourceIndex(sourceText,source.path)[0];
  const ids={path:'generated/GeneratedProductPortIds.kt',text:[
    'object GeneratedProductPortIds {',
    '  data object RECORDING_PRESSURE_VALUE : PortId { override val value = "recording.service.pressure" }',
    '  val RECORDING_PRESSURE: PortId = RECORDING_PRESSURE_VALUE',
    '}',
  ].join('\n')};
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
  const sourceText=['/** @covers missing.service */',"test('Given x When y Then z',()=>{assert(true)});"].join('\n');
  const source={path:'test/example.test.js',text:sourceText};
  const located=testSourceIndex(sourceText,source.path)[0];
  const associated=associateBehaviorReferences(report(source.path,located.line,name),[source],{entities:[]},[]);
  assert.match(associated.tests[0].associationDiagnostics[0],/Unknown @covers/);
});

test('Kotlin expression-body tests keep their JUnit name and source line',()=>{
  const source=[
    'class RecordingTest {',
    '  @Test',
    '  fun `a recorded jump follows the machine`() =',
    '    component("real recording") {',
    '      use("recording.session")',
    '    }',
    '}',
  ].join('\n');
  const located=testSourceIndex(source,'jumpcore/src/test/RecordingTest.kt');
  assert.equal(located.length,1);
  assert.equal(located[0].name,'a recorded jump follows the machine');
  assert.equal(located[0].line,3);
  assert.match(located[0].body,/recording.session/);
});

test('generated declaration law identity changes with the model digest',()=>{
  const a=declarationLawId('a'.repeat(64),'node-type::x','node-type-structural-laws');
  const b=declarationLawId('b'.repeat(64),'node-type::x','node-type-structural-laws');
  assert.notEqual(a,b);
});
