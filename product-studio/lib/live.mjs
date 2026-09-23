import { randomBytes } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { eventFor } from './observation.mjs';
import { createLiveTraceRecorder, decodeTrace } from './trace.mjs';
import { boundedJson, digest, plain, requireThat, StudioError } from './util.mjs';

const PROTOCOL = 'v1d-runtime.v1';
const MAX_MESSAGE = 64_000;
const MAX_EVENT = 8_192;
const TICKET_MS = 120_000;
const RECONNECT_MS = 8 * 60 * 60_000;
const RETAINED_BYTES = 32_000_000;
const localBrowserOrigin = value => {
  if(typeof value!=='string')return false;
  try { const url=new URL(value);return url.origin===value && url.protocol==='http:'
    && ['127.0.0.1','localhost'].includes(url.hostname) && url.port!==''; }
  catch{return false;}
};
const onlyKeys = (value, keys, code) => requireThat(plain(value)
  && Object.keys(value).every(key => keys.includes(key)), code, 'Unexpected runtime protocol field.');

/** An opt-in, read-only local receiver. Product events cannot invoke a Studio command. */
export class LiveSessionHub {
  constructor(app, { now = Date.now } = {}) {
    this.app = app; this.now = now;
    this.tickets = new Map(); this.reconnects = new Map();
    this.captures = new Map(); this.statuses = new Map(); this.sockets = new Set();this.retainedBytes=0;
    this.pending = new Set(); this.active = new Set(); this.failures = new Map();
    this.ws = new WebSocketServer({ noServer:true, maxPayload:MAX_MESSAGE, perMessageDeflate:false });
    this.ws.on('connection', (socket,request) => this.connected(socket,request));
    this.liveness = setInterval(() => {
      for (const socket of this.sockets) {
        if (this.now() - socket.lastPongAt > 45_000) socket.terminate();
        else socket.ping();
      }
    }, 15_000).unref();
  }

  issueTicket(request) {
    onlyKeys(request,['project','producer','origin'],'live.ticket');
    const {project,producer,origin}=request;
    requireThat(['native','node','browser'].includes(producer), 'live.producer', 'Choose native, node or browser for this local capture.');
    requireThat(producer==='browser'?localBrowserOrigin(origin):origin===undefined,
      'live.origin','Browser pairing needs one exact local http Origin; native and Node omit it.');
    this.app.require(project);
    for(const [key,claim] of this.tickets) if(claim.expires <= this.now())this.tickets.delete(key);
    requireThat(this.tickets.size < 32, 'live.overloaded', 'Too many pending tickets. Wait for expiry or restart Studio.');
    const ticket = randomBytes(32).toString('base64url');
    this.tickets.set(digest(ticket), { project, producer, origin:origin??null, expires:this.now()+TICKET_MS });
    return { ticket, expiresInMs:TICKET_MS };
  }

  upgrade(request, socket, head) {
    const local = request.socket.remoteAddress === '127.0.0.1';
    const failures=this.failures.get(request.socket.remoteAddress);
    const limited=failures && failures.until>this.now() && failures.count>=8;
    let route = null;
    try { route = new URL(request.url,'http://127.0.0.1'); } catch {}
    if (!local || request.headers.host !== `127.0.0.1:${request.socket.localPort}`
      || (request.headers.origin && !localBrowserOrigin(request.headers.origin))
      || request.headers.cookie || route?.pathname !== '/runtime/v1' || route.search
      || request.headers['sec-websocket-protocol'] !== PROTOCOL
      || this.pending.size >= 4 || this.active.size >= 4 || limited) {
      socket.write(`HTTP/1.1 ${limited?'429 Too Many Requests':'403 Forbidden'}\r\nConnection: close\r\n\r\n`);socket.destroy();return;
    }
    this.ws.handleUpgrade(request,socket,head,client=>this.ws.emit('connection',client,request));
  }

  credential(message, origin) {
    const hasTicket = typeof message.ticket === 'string';
    const hasReconnect = typeof message.reconnectCredential === 'string';
    requireThat(hasTicket !== hasReconnect, 'live.pairing-required', 'Provide one current pairing ticket.');
    const key = digest(hasTicket ? message.ticket : message.reconnectCredential);
    const source = hasTicket ? this.tickets : this.reconnects;
    const claim = source.get(key);
    requireThat(claim, 'live.pairing-required', 'Pair this producer from the local Studio session.');
    requireThat(claim.expires > this.now(), 'live.ticket-expired', 'Pairing expired. Create a new one.');
    requireThat(claim.producer==='browser'?origin===claim.origin:origin===null,
      'live.origin','This ticket belongs to a different local page or producer. Pair that exact Origin.');
    source.delete(key); // One use, including a producer with the wrong model.
    return claim;
  }

  hello(message, socket, origin) {
    onlyKeys(message,['type','protocol','ticket','reconnectCredential','productId','identity',
      'productSpecVersion','captureId','buildId','scope'],'live.hello');
    requireThat(message.type === 'hello' && message.protocol === 1, 'live.protocol-version', 'Use runtime protocol v1.');
    const claim = this.credential(message,origin);
    const p = this.app.require(claim.project), view = this.app.view(p);
    onlyKeys(message.identity,['modelDigest','artifactSha256'],'live.identity');
    const keys = Object.keys(message.identity);
    requireThat(keys.length === 1, 'live.identity', 'Send exactly one compiled model identity.');
    const matched = message.productId === view.productId && (view.artifactSha256
      ? keys[0] === 'artifactSha256' && message.identity.artifactSha256 === view.artifactSha256
      : keys[0] === 'modelDigest' && message.identity.modelDigest === view.modelDigest);
    if (!matched) {
      this.statuses.set(p.key,{label:'Model mismatch',state:'model-mismatch',events:0});
      throw new StudioError('live.model-mismatch','Model mismatch. Open the matching compiled build.');
    }
    requireThat(message.productSpecVersion === view.toolVersions.productSpec
      && view.compatibility?.simulate !== false, 'live.kernel-unavailable',
    'The exact ProductSpec evaluator is unavailable. Install this build\'s locked kernel.');
    requireThat(typeof message.captureId === 'string' && /^[A-Za-z0-9_-]{4,120}$/u.test(message.captureId)
      && !this.captures.has(message.captureId), 'live.capture', 'Use a fresh opaque capture ID.');
    requireThat(message.buildId === undefined || typeof message.buildId === 'string' && message.buildId.length <= 120,
      'live.build', 'Build label is too long.');
    onlyKeys(message.scope,['events','facets','appliedTransitions'],'live.scope');
    requireThat(Array.isArray(message.scope.events) && message.scope.events.length > 0
      && message.scope.events.every(kind=>['port','decision','transition'].includes(kind))
      && new Set(message.scope.events).size === message.scope.events.length
      && Array.isArray(message.scope.facets) && message.scope.facets.length <= 128
      && message.scope.facets.every(id=>typeof id === 'string' && view.facets.some(f=>f.id===id))
      && typeof message.scope.appliedTransitions === 'boolean', 'live.scope',
    'Advertise only declared observation families and facets.');
    requireThat(this.captures.size < 8, 'live.overloaded', 'Eight captures are retained. Save them and restart Studio.');
    const writer = createLiveTraceRecorder(view,{id:message.captureId,scope:message.scope,buildId:message.buildId});
    const reconnectCredential = randomBytes(32).toString('base64url');
    this.reconnects.set(digest(reconnectCredential),{
      project:p.key,producer:claim.producer,origin:claim.origin,expires:this.now()+RECONNECT_MS,
    });
    const session={ socket,p,view,writer,id:message.captureId,scope:message.scope,through:-1,ended:false,
      count:0,dropped:0,ending:'open' };
    session.bytes=Buffer.byteLength(JSON.stringify(writer.snapshot()));
    requireThat(this.retainedBytes+session.bytes<=RETAINED_BYTES,'live.overloaded','Receiver retention budget exhausted.');
    this.retainedBytes+=session.bytes;
    this.captures.set(session.id,session);this.active.add(socket);
    p.trace=decodeTrace(JSON.stringify(writer.snapshot()),view);
    this.statuses.set(p.key,{label:'Live',state:'observing',events:0,captureId:session.id});
    return {session,welcome:{type:'welcome',protocol:1,captureId:session.id,
      bounds:{batchEvents:128,batchBytes:MAX_MESSAGE,eventBytes:MAX_EVENT},reconnectCredential}};
  }

  batch(session,message) {
    onlyKeys(message,['type','through','events','dropped'],'live.batch');
    requireThat(message.type === 'batch' && Array.isArray(message.events) && Array.isArray(message.dropped),
      'live.batch','Expected one ordered observation batch.');
    requireThat(message.events.length <= 128 && message.dropped.length <= 128,
      'live.overloaded','Split the observation batch before sending.');
    const events=message.events.map(raw=>{
      requireThat(Buffer.byteLength(JSON.stringify(raw)) <= MAX_EVENT,'live.event-size','Observation exceeds 8 KiB.');
      requireThat(session.scope.events.includes(raw.kind)
        && (raw.kind==='port'||session.scope.facets.includes(raw.facetId))
        && (raw.phase!=='applied'||session.scope.appliedTransitions),
      'live.scope','Observation exceeds the advertised capture scope.');
      return {...eventFor(raw,session.view,{live:true}),sequence:raw.sequence,atMs:raw.atMs};
    });
    const available=RETAINED_BYTES-1024-(this.retainedBytes-session.bytes);
    const through=session.writer.append({through:message.through,events,gaps:message.dropped},{maxBytes:available});
    this.retainedBytes-=session.bytes;
    session.bytes=Buffer.byteLength(JSON.stringify(session.writer.snapshot()));
    this.retainedBytes+=session.bytes;
    session.through=through;
    session.count+=events.length;
    session.dropped+=message.dropped.reduce((count,gap)=>count+gap.to-gap.from+1,0);
    session.p.trace=decodeTrace(JSON.stringify(session.writer.snapshot()),session.view);
    this.statuses.set(session.p.key,{label:'Live',state:'observing',events:session.p.trace.events.length,captureId:session.id});
    return {type:'ack',through};
  }

  end(session,message) {
    onlyKeys(message,['type','through'],'live.end');
    requireThat(message.type === 'end' && message.through === session.through,
      'live.end','Finish only after the final batch watermark was acknowledged.');
    session.writer.end(message.through);session.ended=true;session.ending='clean';
    this.retainedBytes-=session.bytes;
    session.bytes=Buffer.byteLength(JSON.stringify(session.writer.snapshot()));
    this.retainedBytes+=session.bytes;
    session.p.trace=decodeTrace(JSON.stringify(session.writer.snapshot()),session.view);
    this.statuses.set(session.p.key,{label:'Live ended',state:'clean',events:session.p.trace.events.length,captureId:session.id});
    return {type:'ack',through:message.through,ended:true};
  }

  connected(socket,request) {
    const peer=request.socket.remoteAddress;
    socket.lastPongAt=this.now();this.sockets.add(socket);this.pending.add(socket);
    let session=null;
    const deadline=setTimeout(()=>{ if(!session) socket.close(1008,'Pairing deadline'); },5_000).unref();
    const send=message=>{if(socket.readyState===socket.OPEN)socket.send(JSON.stringify(message));};
    socket.on('pong',()=>{socket.lastPongAt=this.now();});
    socket.on('message',bytes=>{
      try {
        const message=boundedJson(bytes.toString(),MAX_MESSAGE);
        if (!session) {
          const accepted=this.hello(message,socket,request.headers.origin??null);session=accepted.session;
          this.pending.delete(socket);clearTimeout(deadline);send(accepted.welcome);return;
        }
        requireThat(message.type==='batch'||message.type==='end','live.operation','Only batch or end is supported.');
        send(message.type==='batch'?this.batch(session,message):this.end(session,message));
        if(message.type==='end')socket.close(1000,'Capture complete');
      } catch(error) {
        if(!session) {
          const prior=this.failures.get(peer);
          const fresh=!prior||prior.until<=this.now();
          this.failures.set(peer,{count:fresh?1:prior.count+1,until:fresh?this.now()+60_000:prior.until});
        }
        send({type:'error',code:error.code??'live.invalid',message:String(error.message).slice(0,240)});
        socket.close(1008,'Invalid runtime message');
      }
    });
    socket.on('close',()=>{
      clearTimeout(deadline);this.sockets.delete(socket);this.pending.delete(socket);this.active.delete(socket);
      if(session && !session.ended) {
        session.ending='interrupted';
        session.writer.interrupt();session.p.trace=decodeTrace(JSON.stringify(session.writer.snapshot()),session.view);
        this.retainedBytes-=session.bytes;
        session.bytes=Buffer.byteLength(JSON.stringify(session.writer.snapshot()));
        this.retainedBytes+=session.bytes;
        this.statuses.set(session.p.key,{label:'Live interrupted',state:'interrupted',events:session.p.trace.events.length,captureId:session.id});
      }
    });
    socket.on('error',()=>socket.terminate());
  }

  status(project) {
    const current=this.app.view(this.app.require(project));
    const sessions=[...this.captures.values()].filter(capture=>capture.p.key===project)
      .map(capture=>({id:capture.id,events:capture.count,drops:capture.dropped,ending:capture.ending,
        modelMatched:capture.view.modelDigest===current.modelDigest&&capture.view.bundleDigest===current.bundleDigest}));
    return {...(this.statuses.get(project)??{label:'Disconnected',state:'disconnected',events:0}),sessions};
  }
  selectedSnapshot(project,captureId,currentView) {
    const capture=this.captures.get(captureId);
    requireThat(capture?.p.key===project,'live.capture','Capture does not belong to this project.',404);
    requireThat(capture.view.modelDigest===currentView.modelDigest&&capture.view.bundleDigest===currentView.bundleDigest,
      'live.model-mismatch','Capture belongs to another compiled build.',409);
    return decodeTrace(JSON.stringify(capture.writer.snapshot()),capture.view);
  }
  snapshot(captureId) { return this.captures.get(captureId)?.writer.snapshot()??null; }
  close() { clearInterval(this.liveness);for(const socket of this.sockets)socket.terminate();this.ws.close(); }
}
