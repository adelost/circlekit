import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from '../server.mjs';

test('two retained captures can be selected by the current project, never another project',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-live-view-'));
  const running=await createServer({port:0,dataDir:root,liveEnabled:true});
  t.after(async()=>{running.server.closeAllConnections();await new Promise(resolve=>running.server.close(resolve));await rm(root,{recursive:true,force:true});});
  const project=running.app.list().find(item=>item.id==='workflow-example');
  const owner=running.app.require(project.key),view=running.app.view(owner),live=running.live;
  const start=id=>{
    const {ticket}=live.issueTicket({project:project.key,producer:'node'});
    return live.hello({type:'hello',protocol:1,ticket,productId:view.productId,identity:{modelDigest:view.modelDigest},
      productSpecVersion:view.toolVersions.productSpec,captureId:id,
      scope:{events:['transition'],facets:['example.request'],appliedTransitions:true}},{},null).session;
  };
  const first=start('viewer-first');
  live.batch(first,{type:'batch',through:0,dropped:[],events:[{sequence:0,atMs:1,kind:'transition',phase:'evaluated',
    facetId:'example.request',cellId:'send',from:'IDLE',to:'FAILURE',input:'Send',guards:{}}]});
  live.batch(first,{type:'batch',through:1,dropped:[{from:1,to:1,reason:'fixture-loss'}],events:[]});
  live.end(first,{type:'end',through:1});
  start('viewer-second');
  const status=live.status(project.key);
  assert.deepEqual(status.sessions.map(session=>session.id),['viewer-first','viewer-second']);
  assert.equal(status.sessions[0].drops,1);
  const post=async(route,body)=>{
    const response=await fetch(running.origin+'/api/'+route,{method:'POST',headers:{'x-studio-token':running.token,'content-type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  };
  const base={project:project.key,bundleDigest:view.bundleDigest,captureId:'viewer-first'};
  const prior=await post('live-snapshot',base);
  assert.equal(prior.status,200);
  assert.equal(prior.body.trace.capture.id,'viewer-first');
  assert.equal(prior.body.trace.events.length,1);
  assert.equal(prior.body.convergence.label,'Diverged: 1');
  const page=await post('trace-page',{...base,traceDigest:prior.body.trace.traceDigest,offset:0,limit:200,filter:{cursor:0}});
  assert.equal(page.status,200);assert.equal(page.body.current.sequence,0);
  const other=running.app.list().find(item=>item.id==='amux-fixture'),otherView=running.app.view(running.app.require(other.key));
  assert.equal((await post('live-snapshot',{project:other.key,bundleDigest:otherView.bundleDigest,captureId:'viewer-first'})).status,404);
});
