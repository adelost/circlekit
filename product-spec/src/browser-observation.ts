import { installObservationSink, type RawObservation } from './observation.js';

type Scope={events:readonly ('port'|'decision'|'transition')[];facets:readonly string[];appliedTransitions:boolean};
export type BrowserObservationDescriptor={productId:string;identity:{modelDigest:string}|{artifactSha256:string};
  productSpecVersion:string;scope:Scope;buildId?:string};
type QueueRow={event:RawObservation&{sequence:number;atMs:number};bytes:number}
  |{gap:{from:number;to:number;reason:string};bytes:number};

/** Browser-only dev transport. No normal ProductSpec import starts this connection. */
export function connectBrowserObservation({url,ticket,descriptor,onStatus=()=>{}}:{
  url:string;ticket:string;descriptor:BrowserObservationDescriptor;onStatus?:(status:string)=>void;
}) {
  if(!/^ws:\/\/127\.0\.0\.1:\d+\/runtime\/v1$/u.test(url))throw new Error('Live Studio URL must be literal loopback.');
  if(!/^[A-Za-z0-9_-]{43}$/u.test(ticket))throw new Error('Use a current one-time pairing ticket.');
  const socket=new WebSocket(url,'v1d-runtime.v1');
  const captureId=crypto.randomUUID(),start=performance.now();
  let sequence=0,lastAck=-1,welcomed=false,stopping=false,inflight:{count:number;through:number}|null=null;
  let queue:QueueRow[]=[],queueBytes=0,loss:{from:number;to:number;reason:string}|null=null;
  let dispose:(()=>void)|null=null,flushTimer:ReturnType<typeof setTimeout>|null=null;
  let resolveConnected!:()=>void,rejectConnected!:(error:Error)=>void;
  const connected=new Promise<void>((resolve,reject)=>{resolveConnected=resolve;rejectConnected=reject;});
  const timeout=setTimeout(()=>{
    if(!welcomed){rejectConnected(new Error('Studio pairing timed out. Create a fresh ticket.'));socket.close();}
  },5_000);
  const report=(status:string)=>{try{onStatus(status);}catch{/* UI status cannot alter application behavior. */}};
  const send=(value:unknown)=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(value));};
  const schedule=()=>{if(flushTimer===null)flushTimer=setTimeout(()=>{flushTimer=null;flush();},50);};
  const enqueueLoss=(at:number,reason:string)=>{
    if(loss&&loss.reason===reason&&loss.to+1===at)loss.to=at;
    else if(!loss)loss={from:at,to:at,reason};
    else { report('Capture incomplete: loss ranges overflowed. Stop and pair again.');stop(); }
  };
  const sealLoss=()=>{
    if(!loss)return;
    const gap=loss;loss=null;queue.push({gap,bytes:JSON.stringify(gap).length});
  };
  const observe=(raw:RawObservation)=>{
    const at=sequence++;
    try {
      const event={...raw,sequence:at,atMs:Math.max(0,performance.now()-start)};
      const bytes=JSON.stringify(event).length;
      if(bytes>8_192||queue.length>=2_047||queueBytes+bytes>1_000_000){enqueueLoss(at,'producer-queue-full');schedule();return;}
      sealLoss();queue.push({event,bytes});queueBytes+=bytes;schedule();
    } catch {enqueueLoss(at,'producer-serialization');schedule();}
  };
  const flush=()=>{
    if(!welcomed||inflight||socket.readyState!==WebSocket.OPEN)return;
    if(!queue.length)sealLoss();
    if(!queue.length){if(stopping)send({type:'end',through:lastAck});return;}
    if(socket.bufferedAmount>256_000){schedule();return;}
    const events:Array<RawObservation&{sequence:number;atMs:number}>=[];
    const dropped:Array<{from:number;to:number;reason:string}>=[];
    let count=0,bytes=128,through=lastAck;
    for(const row of queue) {
      if(count>=128||bytes+row.bytes>60_000)break;
      if('event'in row){events.push(row.event);through=row.event.sequence;}
      else{dropped.push(row.gap);through=row.gap.to;}
      bytes+=row.bytes;count++;
    }
    if(!count){report('Observation batch exceeds the local budget.');stop();return;}
    inflight={count,through};send({type:'batch',through,events,dropped});
  };
  const stop=()=>{
    if(stopping)return;
    stopping=true;dispose?.();dispose=null;
    if(!welcomed){socket.close();return;}
    flush();
  };
  socket.onopen=()=>send({type:'hello',protocol:1,ticket,productId:descriptor.productId,
    identity:descriptor.identity,productSpecVersion:descriptor.productSpecVersion,captureId,
    ...(descriptor.buildId?{buildId:descriptor.buildId}:{}),scope:descriptor.scope});
  socket.onmessage=message=>{
    let body:Record<string,unknown>;
    try{body=JSON.parse(String(message.data));}catch{report('Studio sent invalid JSON.');stop();return;}
    if(body.type==='welcome'&&!welcomed){
      clearTimeout(timeout);
      try{dispose=installObservationSink(observe);}
      catch{rejectConnected(new Error('Another observation session is active in this page. Stop it first.'));socket.close();return;}
      welcomed=true;
      report('Observing');resolveConnected();return;
    }
    if(body.type==='ack'&&body.ended===true&&stopping){socket.close();report('Capture ended');return;}
    if(body.type==='ack'&&inflight&&body.through===inflight.through){
      const rows=queue.splice(0,inflight.count);
      queueBytes-=rows.reduce((sum,row)=>sum+('event'in row?row.bytes:0),0);
      lastAck=inflight.through;inflight=null;
      if(body.ended===true){socket.close();report('Capture ended');}
      else flush();return;
    }
    if(body.type==='error'){
      const reason=typeof body.code==='string'?body.code:'live.invalid';
      report(`Studio refused observation: ${reason}`);
      if(!welcomed)rejectConnected(new Error(reason));
      stop();socket.close();return;
    }
    report('Studio protocol mismatch. Pair again.');stop();socket.close();
  };
  socket.onerror=()=>{if(!welcomed)rejectConnected(new Error('Studio is unavailable. Check --live, the one-time ticket and this page\'s Origin/CSP.'));};
  socket.onclose=()=>{
    clearTimeout(timeout);if(flushTimer!==null)clearTimeout(flushTimer);
    dispose?.();dispose=null;
    if(!welcomed)rejectConnected(new Error('Studio pairing closed. Create a fresh ticket.'));
    else if(!stopping)report('Disconnected: capture tail is unknown.');
  };
  return {socket,connected,stop};
}
