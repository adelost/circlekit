import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createServer } from '../server.mjs';

test('a browser ticket is bound to one exact local Origin',async()=>{
  const running=await createServer({port:0,liveEnabled:true});
  try {
    const project=running.app.list().find(p=>p.id==='workflow-example');
    const view=running.app.view(running.app.require(project.key));
    const origin='http://127.0.0.1:4381';
    const issue=async()=>{
      const response=await fetch(running.origin+'/api/live-ticket',{method:'POST',headers:{'x-studio-token':running.token,'content-type':'application/json'},
        body:JSON.stringify({project:project.key,producer:'browser',origin})});
      assert.equal(response.status,200);return (await response.json()).ticket;
    };
    const connect=(sentOrigin)=>new Promise((resolve,reject)=>{
      const socket=new WebSocket(running.origin.replace('http:','ws:')+'/runtime/v1','v1d-runtime.v1',{origin:sentOrigin});
      socket.once('open',()=>resolve(socket));socket.once('error',reject);
    });
    const hello=ticket=>({type:'hello',protocol:1,ticket,productId:view.productId,
      identity:{modelDigest:view.modelDigest},productSpecVersion:view.toolVersions.productSpec,
      captureId:'browser-proof',scope:{events:['transition'],facets:['example.request'],appliedTransitions:false}});
    const ticket=await issue();
    const mismatch=await connect('http://localhost:4381');
    const denied=await new Promise(resolve=>{mismatch.once('message',data=>resolve(JSON.parse(data.toString())));mismatch.send(JSON.stringify(hello(ticket)));});
    assert.equal(denied.code,'live.origin');
    const accepted=await connect(origin);
    const welcome=await new Promise(resolve=>{accepted.once('message',data=>resolve(JSON.parse(data.toString())));accepted.send(JSON.stringify(hello(ticket)));});
    assert.equal(welcome.type,'welcome');accepted.close();
    await assert.rejects(connect('null'));
  } finally {running.live.close();running.server.closeAllConnections();await new Promise(resolve=>running.server.close(resolve));}
});
