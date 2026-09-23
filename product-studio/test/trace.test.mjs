import test from 'node:test';
import assert from 'node:assert/strict';
import { createTraceRecorder, decodeTrace, inspectTrace } from '../lib/trace.mjs';
const identity={productId:'test',modelDigest:'a'.repeat(64),architecture:{entities:[{key:'node::a'},{key:'port::a.out'}]}};
const recorder = (capacity=20) => createTraceRecorder({...identity,sessionId:'session-1',clock:'monotonic',capacity});
const event = (atMs=0) => ({atMs,kind:'port',entityKey:'port::a.out',summary:'Value delivered'});

test('compact test trace derives its envelope and event coordinates from the selected file',()=>{
  const compact={kind:'product-studio-trace',version:1,modelDigest:identity.modelDigest,events:[
    {kind:'port',entityKey:'port::a.out',summary:'First'},
    {kind:'port',entityKey:'port::a.out',summary:'Second',causedBy:0},
  ]};
  const trace=decodeTrace(JSON.stringify(compact),identity,{fileName:'test-results/studio-trace.json'});
  assert.deepEqual(trace.events.map(e=>[e.sequence,e.atMs]),[[0,0],[1,1]]);
  assert.equal(trace.productId,'test');assert.equal(trace.sessionId,'studio-trace.json');
  assert.equal(trace.provenance,'test-run');assert.equal(trace.clock.domain,'virtual');
  assert.deepEqual(trace.truncation,{droppedBefore:0,gaps:[]});
  assert.deepEqual(inspectTrace(trace).causalPath.map(e=>e.sequence),[0,1]);
});
test('compact trace refuses mixed or incomplete event coordinates',()=>{
  const base={kind:'product-studio-trace',version:1,modelDigest:identity.modelDigest};
  for(const events of [[{...event(),sequence:0},{kind:'port',entityKey:'port::a.out'}],
    [{...event(),sequence:0},{...event(1),sequence:1,atMs:undefined}]])
    assert.throws(()=>decodeTrace(JSON.stringify({...base,events}),identity,{fileName:'trace.json'}),/mix|sequence|atMs/i);
});
test('compact trace keeps required identity and refuses a foreign product',()=>{
  const compact={kind:'product-studio-trace',version:1,events:[{kind:'port',entityKey:'port::a.out'}]};
  assert.throws(()=>decodeTrace(JSON.stringify(compact),identity,{fileName:'trace.json'}),/identity|digest/i);
  assert.throws(()=>decodeTrace(JSON.stringify({...compact,modelDigest:identity.modelDigest,productId:'foreign'}),identity,{fileName:'trace.json'}),/match/i);
});
test('compact recorded origin must be explicit and hybrid envelope is refused',()=>{
  const compact={kind:'product-studio-trace',version:1,modelDigest:identity.modelDigest,
    events:[{kind:'port',entityKey:'port::a.out'}]};
  const recorded=decodeTrace(JSON.stringify({...compact,provenance:'recorded'}),identity,{fileName:'trace.json'});
  assert.equal(recorded.provenance,'recorded');
  assert.throws(()=>decodeTrace(JSON.stringify({...compact,clock:{domain:'wall',unit:'ms'}}),identity,{fileName:'trace.json'}),/Mixed envelopes/);
});

test('passive recorder stores ordered bounded events and exact model identity',()=>{const r=recorder();r.record(event());r.record({...event(2),causedBy:0});const t=decodeTrace(JSON.stringify(r.snapshot()),identity);assert.equal(t.events.length,2);assert.equal(t.complete,true);assert.equal(t.sessionId,'session-1');});
test('bounded capture reports dropped history',()=>{const r=recorder(2);r.record(event());r.record(event(1));r.record(event(2));const t=decodeTrace(JSON.stringify(r.snapshot()),identity);assert.equal(t.truncation.droppedBefore,1);assert.equal(t.complete,false);assert.equal(t.events.length,2);});
test('wrong bundle, unknown entity, and duplicate sequence are refused',()=>{const r=recorder();r.record(event());let t=r.snapshot();t.modelDigest='b'.repeat(64);assert.throws(()=>decodeTrace(JSON.stringify(t),identity),/does not match/);t=r.snapshot();t.events[0].entityKey='node::foreign';assert.throws(()=>decodeTrace(JSON.stringify(t),identity),/outside/);t=r.snapshot();t.events.push({...t.events[0]});assert.throws(()=>decodeTrace(JSON.stringify(t),identity),/strictly/);});
test('undisclosed sequence gaps refuse; declared gaps remain visible',()=>{const r=recorder();r.record(event());r.record(event(5));const t=r.snapshot();t.events[1].sequence=3;assert.throws(()=>decodeTrace(JSON.stringify(t),identity),/declared as gaps/);t.truncation.gaps=[{from:1,to:2,reason:'producer backpressure'}];const d=decodeTrace(JSON.stringify(t),identity);assert.equal(d.complete,false);});
test('only explicit causal parent links are followed, not timestamp proximity',()=>{const r=recorder();r.record(event());r.record({...event(1),entityKey:'node::a'});r.record({...event(2),causedBy:0});const t=decodeTrace(JSON.stringify(r.snapshot()),identity);const i=inspectTrace(t,{cursor:2});assert.deepEqual(i.causalPath.map(e=>e.sequence),[0,2]);assert.equal(i.activity[0].count,2);});
test('scrubbing observation history never rewrites captured events',()=>{const r=recorder();r.record(event());r.record(event(1));const t=decodeTrace(JSON.stringify(r.snapshot()),identity),before=JSON.stringify(t);assert.equal(inspectTrace(t,{cursor:0}).activity[0].count,1);assert.equal(inspectTrace(t,{cursor:1}).activity[0].count,2);assert.equal(JSON.stringify(t),before);});
test('raw payloads and future causal parents refuse',()=>{const r=recorder();assert.throws(()=>r.record({...event(),payload:{secret:1}}),/Unexpected/);assert.throws(()=>r.record({...event(),causedBy:200}),/earlier/);});
test('synthetic traces never become observed evidence',()=>{const r=createTraceRecorder({...identity,sessionId:'s',clock:'virtual',provenance:'synthetic'});r.record(event());const t=decodeTrace(JSON.stringify(r.snapshot()),identity);assert.equal(t.provenance,'synthetic');assert.match(t.notice,/No product runtime/);});
test('a recorded test run is labelled as a test, not a live session',()=>{
  const r=createTraceRecorder({...identity,sessionId:'unit:delivery',clock:'monotonic',provenance:'test-run'});
  r.record(event());
  const trace=decodeTrace(JSON.stringify(r.snapshot()),identity);
  assert.equal(trace.provenance,'test-run');
  assert.match(trace.notice,/test run/i);
  assert.equal(inspectTrace(trace,{cursor:0}).current.entityKey,'port::a.out');
});
test('a raw artifact hash identifies a trace without reproducing Studio modelDigest',()=>{
  const r=createTraceRecorder({productId:'test',artifactSha256:'b'.repeat(64),sessionId:'test:artifact',
    clock:'monotonic',provenance:'test-run'});
  r.record(event());
  const source={...identity,artifactSha256:'b'.repeat(64)};
  assert.equal(decodeTrace(JSON.stringify(r.snapshot()),source).events.length,1);
  assert.throws(()=>decodeTrace(JSON.stringify(r.snapshot()),{...source,artifactSha256:'c'.repeat(64)}),/match/);
});
test('the trace exposes each changed state once with a clickable event index',()=>{
  const r=recorder();
  for(const [atMs,from,to] of [[0,'STOPPED','ARMED'],[1,'ARMED','ARMED'],[2,'ARMED','BUFFERING']])
    r.record({atMs,kind:'transition',entityKey:'node::a',logic:{facetId:'recording.session',from,to,input:'Tick'}});
  const trace=decodeTrace(JSON.stringify(r.snapshot()),identity);
  assert.deepEqual(trace.statePath.map(item=>item.state),['STOPPED','ARMED','BUFFERING']);
  assert.deepEqual(trace.statePath.map(item=>item.eventIndex),[0,0,2]);
});

test('a refused producer event does not consume sequence or create imaginary dropped history',()=>{
  const r=recorder();assert.throws(()=>r.record({...event(),payload:{secret:1}}));
  assert.equal(r.record(event(1)),0);
  assert.equal(r.snapshot().truncation.droppedBefore,0);
});


test('missing grandparent remains visible after the causal path is reversed', () => {
  const r = recorder(2);
  r.record(event(0));
  r.record({ ...event(1), causedBy: 0 });
  r.record({ ...event(2), causedBy: 1 });
  const t = decodeTrace(JSON.stringify(r.snapshot()), identity);
  const frame = inspectTrace(t, { cursor: 1 });
  assert.deepEqual(frame.causalPath.map(e => e.sequence), [1, 2]);
  assert.equal(frame.missingParentSequence, 0);
  assert.equal(frame.missingParent, true);
  assert.equal(frame.causalPathComplete, false);
});
test('direct missing parent and complete chains have distinct completeness', () => {
  const r = recorder(3);
  r.record(event(0)); r.record({ ...event(1), causedBy: 0 }); r.record({ ...event(2), causedBy: 1 });
  const t = decodeTrace(JSON.stringify(r.snapshot()), identity);
  assert.equal(inspectTrace(t).causalPathComplete, true);
  assert.equal(inspectTrace(t).missingParentSequence, null);
  assert.equal(inspectTrace(t, { cursor: 0 }).causalPath.length, 1);
  const shortCapture = { ...t, events: t.events.slice(2), truncation: { droppedBefore: 2, gaps: [] } };
  assert.equal(inspectTrace(decodeTrace(JSON.stringify(shortCapture), identity)).missingParentSequence, 1);
});
test('malformed, duplicate and unused gap records are refused', () => {
  const r = recorder(); r.record(event()); r.record(event(1));
  for (const gaps of [[null], [{ from: 1, to: 2, reason: 'invented' }],
    [{ from: 1, to: 2, reason: 'lost' }, { from: 1, to: 2, reason: 'duplicate' }]]) {
    assert.throws(() => decodeTrace(JSON.stringify({ ...r.snapshot(), truncation: { droppedBefore: 0, gaps } }), identity));
  }
});
test('empty trace selection has no fabricated current event or cause', () => {
  const t = decodeTrace(JSON.stringify(recorder().snapshot()), identity);
  const frame = inspectTrace(t);
  assert.equal(frame.current, null); assert.deepEqual(frame.causalPath, []);
  assert.equal(frame.missingParentSequence, null);
});
