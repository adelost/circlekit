import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../server.mjs';

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
  await assert.rejects(open(url,{headers:{origin:'https://elsewhere.invalid'}}));
});
test('A03 missing, expired and reused tickets cannot disclose or attach observations',async()=>{
  const missing=await open();assert.equal((await reply(missing,hello('not-a-ticket','missing'))).code,'live.pairing-required');missing.close();
  const expired=await ticket();now+=121_000;
  const old=await open();assert.equal((await reply(old,hello(expired,'expired'))).code,'live.ticket-expired');old.close();
  const one=await ticket();const socket=await open();
  assert.equal((await reply(socket,hello(one,'first'))).type,'welcome');socket.close();
  const reused=await open();assert.equal((await reply(reused,hello(one,'reused'))).code,'live.pairing-required');reused.close();
});
test('A08 model mismatch shows no comparison and never attaches the producer to a model',async()=>{
  const socket=await open();const secret=await ticket();
  const result=await reply(socket,hello(secret,'wrong-model',{identity:{modelDigest:'f'.repeat(64)}}));
  assert.equal(result.code,'live.model-mismatch');
  assert.equal(running.live.status(item.key).label,'Model mismatch');
  assert.equal(running.app.require(item.key).trace,null);socket.close();
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
