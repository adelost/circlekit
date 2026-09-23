import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WebSocket as NodeWebSocket } from 'ws';
import { createServer } from '../server.mjs';
import { decodeTrace } from '../lib/trace.mjs';
import { eventFor } from '../lib/observation.mjs';

const root=await mkdtemp(path.join(os.tmpdir(),'studio-live-'));
let now=10_000;
const ordinary=await createServer({port:0,dataDir:root});
const running=await createServer({port:0,dataDir:root,liveEnabled:true,liveNow:()=>now});
test.after(async()=>{
  for(const instance of [ordinary,running]) {
    instance.live?.close();instance.server.closeAllConnections();
    await new Promise(resolve=>instance.server.close(resolve));
  }
  await rm(root,{recursive:true,force:true});
});

const item=running.app.list().find(p=>p.id==='workflow-example');
const view=running.app.view(running.app.require(item.key));
const url=running.origin.replace('http:','ws:')+'/runtime/v1';
const open=(address=url,options={})=>new Promise((resolve,reject)=>{
  const socket=new WebSocket(address,'v1d-runtime.v1',options);
  socket.addEventListener('open',()=>resolve(socket),{once:true});
  socket.addEventListener('error',reject,{once:true});
});
const reply=(socket,body)=>new Promise(resolve=>{
  socket.addEventListener('message',event=>resolve(JSON.parse(event.data)),{once:true});
  socket.send(JSON.stringify(body));
});
async function ticket(producer='node') {
  const response=await fetch(running.origin+'/api/live-ticket',{method:'POST',headers:{'x-studio-token':running.token,'content-type':'application/json'},
    body:JSON.stringify({project:item.key,producer})});
  assert.equal(response.status,200);
  return (await response.json()).ticket;
}
const hello=(secret,id,overrides={})=>({type:'hello',protocol:1,ticket:secret,productId:view.productId,
  identity:{modelDigest:view.modelDigest},productSpecVersion:view.toolVersions.productSpec,captureId:id,
  buildId:'focused-test',scope:{events:['transition','port'],facets:['example.request'],appliedTransitions:true},...overrides});

test('A01 ordinary Studio has no live receiver or device action',async()=>{
  assert.equal(ordinary.live,null);
  const response=await fetch(ordinary.origin+'/api/live-status?project='+item.key,{headers:{'x-studio-token':ordinary.token}});
  assert.equal(response.status,404);
  await assert.rejects(open(ordinary.origin.replace('http:','ws:')+'/runtime/v1'));
});
test('A02 opt-in receiver stays on loopback with the existing HTTP token and Origin guards',async()=>{
  assert.match(running.origin,/^http:\/\/127\.0\.0\.1:/);
  assert.equal((await fetch(running.origin+'/api/live-ticket',{method:'POST'})).status,403);
  assert.equal((await fetch(running.origin+'/api/projects',{headers:{origin:'https://elsewhere.invalid','x-studio-token':running.token}})).status,403);
  await assert.rejects(new Promise((resolve,reject)=>{
    const socket=new NodeWebSocket(url,'v1d-runtime.v1',{origin:'https://elsewhere.invalid'});
    socket.once('open',resolve);socket.once('error',reject);
  }));
  await assert.rejects(new Promise((resolve,reject)=>{
    const socket=new NodeWebSocket(url,'v1d-runtime.v1',{headers:{Host:'attacker.invalid'}});
    socket.once('open',resolve);socket.once('error',reject);
  }));
  await assert.rejects(open(url+'?ticket=must-not-appear-in-url'));
});
test('A03 missing, expired and reused tickets cannot disclose or attach observations',async()=>{
  const missing=await open();assert.equal((await reply(missing,hello('not-a-ticket','missing'))).code,'live.pairing-required');missing.close();
  const expired=await ticket();now+=121_000;
  const old=await open();assert.equal((await reply(old,hello(expired,'expired'))).code,'live.ticket-expired');old.close();
  const one=await ticket();const socket=await open();
  assert.equal((await reply(socket,hello(one,'first'))).type,'welcome');
  await new Promise(resolve=>{socket.addEventListener('close',resolve,{once:true});socket.close();});
  const reused=await open();assert.equal((await reply(reused,hello(one,'reused'))).code,'live.pairing-required');reused.close();
});
test('A08 model mismatch shows no comparison and never attaches the producer to a model',async()=>{
  const previous=running.app.require(item.key).trace;
  const socket=await open();const secret=await ticket();
  const result=await reply(socket,hello(secret,'wrong-model',{identity:{modelDigest:'f'.repeat(64)}}));
  assert.equal(result.code,'live.model-mismatch');
  assert.equal(running.live.status(item.key).label,'Model mismatch');
  assert.equal(running.app.require(item.key).trace,previous,'a prior capture remains intact; the mismatched producer adds nothing');socket.close();
});
test('A19/A20/A23 a validated batch and loss-only tail retain exact v2 watermarks; bad order refuses',async()=>{
  const socket=await open();const welcome=await reply(socket,hello(await ticket(),'loss-capture'));
  assert.equal(welcome.type,'welcome');
  const facet=view.facets.find(f=>f.kind==='machine'),cell=facet.compiled.cells[0];
  const guards=Object.fromEntries(facet.compiled.guards.map(name=>[name,false]));
  const event={sequence:0,atMs:1,kind:'transition',phase:'evaluated',facetId:facet.id,cellId:cell.id,
    from:cell.from,to:cell.to,input:cell.on,guards,instanceId:'one'};
  assert.deepEqual(await reply(socket,{type:'batch',through:0,events:[event],dropped:[]}),{type:'ack',through:0});
  assert.deepEqual(await reply(socket,{type:'batch',through:2,events:[],dropped:[{from:1,to:2,reason:'producer-queue-full'}]}),{type:'ack',through:2});
  const trace=running.app.require(item.key).trace;
  assert.equal(trace.version,2);assert.equal(trace.capture.through,2);assert.equal(trace.complete,false);
  const bad=await reply(socket,{type:'batch',through:2,events:[event],dropped:[]});
  assert.equal(bad.code,'trace.watermark');socket.close();
});
test('A21/A22 interrupted capture has unknown tail; reconnect gets a new ID and preserves old segment',async()=>{
  const first=await open();const welcome=await reply(first,hello(await ticket(),'segment-one'));
  assert.equal(welcome.type,'welcome');first.close();
  await new Promise(resolve=>setTimeout(resolve,20));
  const old=running.live.snapshot('segment-one');
  assert.equal(old.capture.ending,'interrupted');assert.equal(old.events.length,0);
  const next=await open();
  const response=await reply(next,hello(undefined,'segment-two',{ticket:undefined,reconnectCredential:welcome.reconnectCredential}));
  assert.equal(response.type,'welcome');
  assert.equal(running.live.snapshot('segment-one').capture.id,'segment-one');
  assert.equal(running.live.snapshot('segment-two').capture.through,-1);
  next.close();
});
test('A23 an accepted empty capture is not positive behavioral evidence',async()=>{
  const socket=await open();assert.equal((await reply(socket,hello(await ticket(),'empty-capture'))).type,'welcome');
  const trace=running.live.snapshot('empty-capture');
  assert.equal(trace.events.length,0);assert.equal(trace.capture.through,-1);
  assert.equal(running.app.convergence(running.app.require(item.key)).verdict,'Unknown');socket.close();
});
test('A24/A27 inconsistent coverage and unexpected raw fields are refused without advancing the capture',async()=>{
  const socket=await open();assert.equal((await reply(socket,hello(await ticket(),'invalid-batch'))).type,'welcome');
  const bad=await reply(socket,{type:'batch',through:2,events:[],dropped:[{from:1,to:2,reason:'loss'}]});
  assert.equal(bad.code,'trace.coverage');
  assert.equal(running.live.snapshot('invalid-batch').capture.through,-1);socket.close();

  const other=await open();assert.equal((await reply(other,hello(await ticket(),'privacy-batch'))).type,'welcome');
  const leakage=await reply(other,{type:'batch',through:0,dropped:[],events:[{sequence:0,atMs:1,
    kind:'port',phase:'returned',portRef:'account.open',coordinates:[55.92,13.98]}]});
  assert.equal(leakage.code,'live.event-field');
  assert.equal(running.live.snapshot('privacy-batch').capture.through,-1);other.close();
});
test('A19 backwards event time fails by name and retains the prior watermark',async()=>{
  const socket=await open();assert.equal((await reply(socket,hello(await ticket(),'time-capture'))).type,'welcome');
  const facet=view.facets.find(f=>f.kind==='machine'),cell=facet.compiled.cells[0];
  const event=(sequence,atMs)=>({sequence,atMs,kind:'transition',phase:'evaluated',facetId:facet.id,
    cellId:cell.id,from:cell.from,to:cell.to,input:cell.on,guards:{}});
  const response=await reply(socket,{type:'batch',through:1,dropped:[],events:[event(0,10),event(1,5)]});
  assert.equal(response.code,'trace.time');
  assert.equal(running.live.snapshot('time-capture').capture.through,-1);socket.close();
});
test('A27 unsupported version and forbidden object keys are rejected before a capture exists',async()=>{
  const socket=await open();const response=await reply(socket,hello(await ticket(),'bad-version',{protocol:2}));
  assert.equal(response.code,'live.protocol-version');socket.close();
  const other=await open();
  const forbidden=await new Promise(resolve=>{
    other.addEventListener('message',event=>resolve(JSON.parse(event.data)),{once:true});
    other.send('{"type":"hello","__proto__":{"polluted":true}}');
  });
  assert.equal(forbidden.code,'input.key');other.close();
  assert.equal(running.live.snapshot('bad-version'),null);
  const deep=await open();
  const nested=Array.from({length:50},()=>'{"x":').join('')+'0'+'}'.repeat(50);
  const depth=await new Promise(resolve=>{
    deep.addEventListener('message',event=>resolve(JSON.parse(event.data)),{once:true});
    deep.send(nested);
  });
  assert.equal(depth.code,'input.depth');deep.close();
  const large=await open();
  const closed=new Promise(resolve=>large.addEventListener('close',resolve,{once:true}));
  large.send('x'.repeat(70_000));
  assert.equal((await closed).code,1009);
});
test('A28 an old v1 test trace retains unspecified application semantics',()=>{
  const legacy={kind:'product-studio-trace',version:1,modelDigest:view.modelDigest,events:[]};
  const opened=decodeTrace(JSON.stringify(legacy),view,{fileName:'old-test.json'});
  assert.equal(opened.version,1);assert.equal(opened.provenance,'test-run');
  assert.equal(opened.events.length,0);assert.equal(opened.capture,undefined);
});
test('A38 only declared finite decision facts and values pass the live boundary',()=>{
  const policy=running.app.list().find(p=>p.id==='amux-fixture');
  const model=running.app.view(running.app.require(policy.key));
  const facet=model.facets.find(f=>f.kind==='decision-table'),cell=facet.compiled.cells[0];
  const facts=Object.fromEntries(Object.entries(facet.compiled.axes).map(([name,values])=>[name,values[0]]));
  const raw={kind:'decision',phase:'evaluated',sequence:0,atMs:1,facetId:facet.id,
    cellId:cell.id,facts,values:cell.values};
  assert.equal(eventFor(raw,model,{live:true}).logic.cellId,cell.id);
  assert.throws(()=>eventFor({...raw,facts:{...facts,accountId:'private'}},model,{live:true}),
    error=>error.code==='live.event-field');
  assert.throws(()=>eventFor({...raw,facts:{...facts,[Object.keys(facts)[0]]:'private'}},model,{live:true}),
    error=>error.code==='live.facts');
  assert.throws(()=>eventFor({...raw,values:{...cell.values,secret:'private'}},model,{live:true}),
    error=>error.code==='live.event-field');
});
test('a bounded contradictory applied cell is retained on the declared facet',()=>{
  const facet=view.facets.find(f=>f.kind==='machine');
  const raw={kind:'transition',phase:'applied',sequence:0,atMs:1,facetId:facet.id,
    cellId:'unexpected-cell',from:facet.compiled.initial,to:'FAILURE',input:facet.compiled.inputs[0],guards:{}};
  const event=eventFor(raw,view,{live:true});
  assert.equal(event.entityKey,`facet:machine:${facet.id}`);
  assert.equal(event.logic.cellId,'unexpected-cell');
});
test('A03 repeated invalid pairing is rate limited on the loopback upgrade',async()=>{
  const isolated=await createServer({port:0,dataDir:root,liveEnabled:true});
  try {
    const endpoint=isolated.origin.replace('http:','ws:')+'/runtime/v1';
    for(let i=0;i<8;i++) {
      const socket=await open(endpoint);
      assert.equal((await reply(socket,hello('wrong-ticket',`attempt-${i}`))).code,'live.pairing-required');
      await new Promise(resolve=>socket.addEventListener('close',resolve,{once:true}));
    }
    await assert.rejects(open(endpoint));
  } finally {
    isolated.live.close();isolated.server.closeAllConnections();
    await new Promise(resolve=>isolated.server.close(resolve));
  }
});
