import assert from 'node:assert/strict';
import test from 'node:test';
import { defineMachine } from '../src/machine-model.js';
import { observedScope } from '../src/observation.js';
import { connectBrowserObservation } from '../src/browser-observation.js';

test('a browser dev session handshakes without a URL secret and batches real evaluated calls',async()=>{
  const old=globalThis.WebSocket;
  class Socket {
    static OPEN=1;
    readyState=1;bufferedAmount=0;sent:unknown[]=[];
    onopen:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
    onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;
    constructor(readonly url:string,readonly protocol:string) { queueMicrotask(()=>this.onopen?.()); }
    send(text:string) { this.sent.push(JSON.parse(text)); }
    close() { this.readyState=3;this.onclose?.(); }
    answer(value:unknown) { this.onmessage?.({data:JSON.stringify(value)}); }
  }
  globalThis.WebSocket=Socket as unknown as typeof WebSocket;
  try {
    const session=connectBrowserObservation({url:'ws://127.0.0.1:4317/runtime/v1',ticket:'A'.repeat(43),
      descriptor:{productId:'door',identity:{modelDigest:'a'.repeat(64)},productSpecVersion:'0.3.68',
        scope:{events:['transition'],facets:['door'],appliedTransitions:false}}});
    const socket=session.socket as unknown as Socket;
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(socket.url.includes('ticket'),false);
    assert.equal((socket.sent[0] as {type:string}).type,'hello');
    socket.answer({type:'welcome',protocol:1,captureId:(socket.sent[0] as {captureId:string}).captureId});
    await session.connected;
    const machine=defineMachine({id:'door',states:['CLOSED','OPEN'],initial:'CLOSED',inputs:['Open'],guards:[],
      cells:[{id:'open',from:'CLOSED',on:'Open',to:'OPEN'}],rests:['CLOSED','OPEN'],deadlines:[],ordering:'exclusive',otherwise:'stay'});
    observedScope.step(machine,'CLOSED','Open',new Set());
    await new Promise(resolve=>setTimeout(resolve,70));
    const batch=socket.sent[1] as {type:string;through:number;events:Array<{phase:string;sequence:number}>};
    assert.equal(batch.type,'batch');assert.equal(batch.through,0);
    assert.equal(batch.events[0]?.phase,'evaluated');assert.equal(batch.events[0]?.sequence,0);
    socket.answer({type:'ack',through:0});session.stop();
    assert.equal((socket.sent.at(-1) as {type:string}).type,'end');
  } finally { globalThis.WebSocket=old; }
});
