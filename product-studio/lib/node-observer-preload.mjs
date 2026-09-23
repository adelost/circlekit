import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { consumeTicketFile } from './ticket-file.mjs';

async function start() {
  const {V1D_LIVE_TICKET_FILE:ticketPath,V1D_LIVE_DESCRIPTOR_FILE:descriptorPath,V1D_LIVE_URL:url}=process.env;
  if(!ticketPath||!descriptorPath||!url)throw new Error('Use v1d-studio live run to supply one private local pairing.');
  const ticket=await consumeTicketFile(ticketPath);
  const {packageRoot,...descriptor}=JSON.parse(await readFile(descriptorPath,'utf8'));
  if(typeof packageRoot!=='string')throw new Error('Local ProductSpec package root is missing. Run npm ci.');
  const packageDirectory=path.join(packageRoot,'node_modules/@v1d/product-spec');
  const packageJson=JSON.parse(await readFile(path.join(packageDirectory,'package.json'),'utf8'));
  if(packageJson.version!==descriptor.productSpecVersion)
    throw new Error('ProductSpec pin differs from the compiled descriptor. Run npm ci and re-export.');
  const observed=await import(pathToFileURL(path.join(packageDirectory,'dist/src/observation.js')).href);
  const socket=new WebSocket(url,'v1d-runtime.v1',{perMessageDeflate:false,maxPayload:64_000});
  const captureId=randomUUID(),started=performance.now();
  let nextSequence=0,lastAck=-1,queue=[],queuedBytes=0,inflight=null,loss=null,flushTimer=null,idleTimer=null;
  let dispose=null,welcomed=false;
  const send=value=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(value));};
  const schedule=()=>{if(!flushTimer)flushTimer=setTimeout(()=>{flushTimer=null;flush();},50);};
  const markLoss=(sequence,reason)=>{
    if(loss&&loss.reason===reason&&loss.to+1===sequence)loss.to=sequence;
    else if(!loss)loss={from:sequence,to:sequence,reason};
    else {dispose?.();dispose=null;process.stderr.write('live.overloaded: loss accounting exceeded; capture disabled.\n');}
  };
  const sealLoss=()=>{if(loss){const gap=loss;loss=null;queue.push({gap,bytes:80});}};
  const observe=raw=>{
    const sequence=nextSequence++;
    try {
      const event={...raw,sequence,atMs:Math.max(0,performance.now()-started)};
      const bytes=Buffer.byteLength(JSON.stringify(event));
      if(bytes>8_192||queue.length>=2_047||queuedBytes+bytes>1_000_000){markLoss(sequence,'producer-queue-full');schedule();return;}
      sealLoss();queue.push({event,bytes});queuedBytes+=bytes;
      socket._socket?.ref();if(idleTimer){clearTimeout(idleTimer);idleTimer=null;}schedule();
    } catch {markLoss(sequence,'producer-serialization');schedule();}
  };
  const flush=()=>{
    if(!welcomed||inflight||socket.readyState!==WebSocket.OPEN)return;
    if(!queue.length)sealLoss();
    if(!queue.length)return;
    if(socket.bufferedAmount>256_000){schedule();return;}
    const events=[],dropped=[];let count=0,bytes=128,through=lastAck;
    for(const row of queue) {
      if(count>=128||bytes+row.bytes>60_000)break;
      if(row.event){events.push(row.event);through=row.event.sequence;}
      else {dropped.push(row.gap);through=row.gap.to;}
      count++;bytes+=row.bytes;
    }
    if(!count){dispose?.();dispose=null;process.stderr.write('live.overloaded: one event exceeds a batch.\n');return;}
    inflight={count,through};send({type:'batch',through,events,dropped});
  };
  await new Promise((resolve,reject)=>{
    const deadline=setTimeout(()=>reject(new Error('Pairing timed out. Create a fresh ticket in Studio.')),5_000);
    socket.once('open',()=>send({type:'hello',protocol:1,ticket,productId:descriptor.productId,
      identity:descriptor.identity,productSpecVersion:descriptor.productSpecVersion,
      captureId,scope:descriptor.scope}));
    socket.on('message',bytes=>{
      let message;try{message=JSON.parse(bytes.toString());}catch{return;}
      if(!welcomed) {
        if(message.type==='welcome') {
          if(message.captureId!==captureId){reject(new Error('Studio confirmed another capture identity. Pair again.'));socket.close();return;}
          clearTimeout(deadline);
          try{dispose=observed.installObservationSink(observe);}
          catch(error){reject(new Error(`Observation bootstrap failed: ${error.message}`));socket.close();return;}
          welcomed=true;
          socket._socket?.unref();resolve();
        } else if(message.type==='error')reject(new Error(`${message.code}: ${message.message}`));
        return;
      }
      if(message.type==='ack'&&inflight&&message.through===inflight.through) {
        const done=queue.splice(0,inflight.count);queuedBytes-=done.reduce((sum,row)=>sum+(row.event?row.bytes:0),0);
        lastAck=inflight.through;inflight=null;flush();
        if(!queue.length&&!loss&&!inflight)idleTimer=setTimeout(()=>socket._socket?.unref(),250);
      } else if(message.type==='ack') {
        dispose?.();dispose=null;process.stderr.write('live.sequence: Studio acknowledged another watermark.\n');socket.close();
      } else if(message.type==='error') {
        dispose?.();dispose=null;process.stderr.write(`${message.code}: ${message.message}\n`);socket.close();
      }
    });
    socket.on('error',error=>{
      if(!welcomed)reject(new Error(`Studio socket unavailable. Start Studio with --live: ${error.message}`));
      else{dispose?.();dispose=null;process.stderr.write('live.disconnected: observation stopped; the app continues.\n');}
    });
    socket.once('close',()=>{
      clearTimeout(deadline);dispose?.();dispose=null;
      if(!welcomed)reject(new Error('Studio closed pairing. Create a fresh ticket.'));
    });
  });
}

try {await start();}
catch(error) {process.stderr.write(`live.run: ${error.message}\n`);process.exit(2);}
