import { canonicalJson, digest, boundedJson, plain, requireThat } from './util.mjs';
import { isDigest, assertSerializable } from './inspection.mjs';

const EVENT_KINDS = new Set(['port', 'decision', 'transition', 'message', 'effect', 'annotation']);
const LIMIT = 20000;
const short = (s, limit = 600) => typeof s === 'string' && s.length > 0 && s.length <= limit;

/** A passive producer API. Owners call record explicitly with their clock; no polling or IO. */
export function createTraceRecorder({ productId, modelDigest = null, artifactSha256 = null, sessionId, clock, capacity = 2000, provenance = 'recorded' }) {
  requireThat(short(productId) && short(sessionId) && (modelDigest !== null || artifactSha256 !== null)
    && (modelDigest === null || isDigest(modelDigest)) && (artifactSha256 === null || isDigest(artifactSha256)),
  'trace.identity', 'Trace product, compiled model or artifact hash, and session identity are required.');
  requireThat(['wall', 'monotonic', 'virtual'].includes(clock) && ['recorded', 'test-run', 'synthetic'].includes(provenance), 'trace.clock', 'Choose an explicit clock and evidence origin.');
  requireThat(Number.isSafeInteger(capacity) && capacity > 0 && capacity <= LIMIT, 'trace.capacity', 'Trace capacity must be between 1 and 20000.');
  let sequence = 0, start = 0, count = 0, lastTime = null; const events = new Array(capacity);
  return {
    record(event) {
      requireThat(plain(event) && !Object.hasOwn(event, 'sequence'), 'trace.sequence', 'The recorder owns sequence numbers.');
      const row = { ...event, sequence };
      validateEvent(row, null);
      if (lastTime !== null && clock !== 'wall') requireThat(row.atMs >= lastTime, 'trace.time', 'Monotonic or virtual trace time moved backwards.');
      const retained = structuredClone(row); // Clone before changing recorder state.
      events[(start + count) % capacity] = retained;
      if (count < capacity) count++; else start = (start + 1) % capacity;
      lastTime = row.atMs; sequence++; return row.sequence;
    },
    snapshot() {
      return { kind: 'product-studio-trace', version: 1, productId,
        ...(modelDigest === null ? {} : {modelDigest}),
        ...(artifactSha256 === null ? {} : {artifactSha256}), sessionId,
        clock: { domain: clock, unit: 'ms' }, provenance,
        truncation: { droppedBefore: count ? events[start].sequence : 0, gaps: [] },
        events: Array.from({length:count},(_,i)=>structuredClone(events[(start+i)%capacity])) };
    },
  };
}
function validateEvent(event, knownEntities) {
  requireThat(plain(event) && Number.isSafeInteger(event.sequence) && event.sequence >= 0
    && Number.isFinite(event.atMs) && event.atMs >= 0 && EVENT_KINDS.has(event.kind), 'trace.event', 'Malformed trace event.');
  requireThat(short(event.entityKey) && (!knownEntities || knownEntities.has(event.entityKey)), 'trace.entity', 'Trace event refers to an entity outside this exact model.');
  requireThat(event.summary === undefined || typeof event.summary === 'string' && event.summary.length <= 2000, 'trace.summary', 'Trace summaries are bounded text, not arbitrary payloads.');
  requireThat(event.operationId === undefined || short(event.operationId), 'trace.operation', 'Invalid operation identity.');
  requireThat(event.causedBy === undefined || Number.isSafeInteger(event.causedBy) && event.causedBy >= 0 && event.causedBy < event.sequence,
    'trace.causality', 'A causal predecessor must be an earlier explicit sequence.');
  requireThat(event.logic === undefined || plain(event.logic), 'trace.logic', 'Decision evidence must be a record.');
  if (event.logic) {
    const allowed = new Set(['facetId','cellId','from','to','input','guards','facts','values']);
    requireThat(Object.keys(event.logic).every(k => allowed.has(k)), 'trace.logic', 'Unsupported decision evidence field.');
    for (const field of ['facetId','cellId','from','to','input']) requireThat(event.logic[field] === undefined || event.logic[field] === null || short(event.logic[field]), 'trace.logic', 'Invalid decision identity.');
    for (const field of ['guards','facts','values']) if (event.logic[field] !== undefined) {
      requireThat(plain(event.logic[field]) && Object.keys(event.logic[field]).length <= 128, 'trace.logic', 'Oversized or invalid decision facts.');
    }
  }
  const allowed = new Set(['sequence','atMs','kind','entityKey','summary','operationId','causedBy','logic']);
  requireThat(Object.keys(event).every(k => allowed.has(k)), 'trace.field', 'Unexpected trace payload field. Redact at the producer and emit only supported summaries/facts.');
  assertSerializable(event);
}

function traceStatePath(events) {
  const path=[];let truncated=false;
  for(const [eventIndex,event] of events.entries()) {
    const {from,to}=event.kind==='transition'?event.logic??{}:{};
    if(!short(from)||!short(to))continue;
    if(!path.length)path.push({state:from,eventIndex,sequence:event.sequence});
    if(path.at(-1).state===to)continue;
    if(path.length===128){truncated=true;break;}
    path.push({state:to,eventIndex,sequence:event.sequence});
  }
  return {statePath:path,statePathTruncated:truncated};
}

export function decodeTrace(text, { productId, modelDigest, artifactSha256 = null, architecture }, { fileName = null } = {}) {
  const input = boundedJson(text, 8_000_000);
  const events = input?.events;
  requireThat(Array.isArray(events), 'trace.size', 'Trace events must be an array.');
  requireThat(events.every(plain), 'trace.event', 'Every trace event must be a record.');
  const allOrNone = field => events.every(event => Object.hasOwn(event, field))
    || events.every(event => !Object.hasOwn(event, field));
  requireThat(allOrNone('sequence') && allOrNone('atMs'), 'trace.mixed',
    'Within one trace, every event must either supply sequence or omit it; the same rule applies independently to atMs.');
  const name = typeof fileName === 'string' ? fileName.split(/[\\/]/).at(-1) : null;
  requireThat(Object.hasOwn(input,'sessionId') || short(name), 'trace.file',
    'A trace without sessionId needs its selected file name.');
  const trace = { ...input, productId: Object.hasOwn(input,'productId') ? input.productId : productId,
    sessionId: Object.hasOwn(input,'sessionId') ? input.sessionId : name,
    clock: Object.hasOwn(input,'clock') ? input.clock : { domain: 'virtual', unit: 'ms' },
    truncation: Object.hasOwn(input,'truncation') ? input.truncation : { droppedBefore: 0, gaps: [] },
    provenance: Object.hasOwn(input,'provenance') ? input.provenance : 'test-run',
    events: events.map((event, index) => ({ ...event,
      ...(!Object.hasOwn(event,'sequence') ? {sequence:index} : {}),
      ...(!Object.hasOwn(event,'atMs') ? {atMs:index} : {}) })) };
  requireThat(plain(trace) && trace.kind === 'product-studio-trace' && trace.version === 1, 'trace.version', 'Unsupported trace format. A count-only port snapshot is not an event trace.');
  const hasModel=Object.hasOwn(trace,'modelDigest'),hasArtifact=Object.hasOwn(trace,'artifactSha256');
  requireThat(hasModel||hasArtifact,'trace.identity','Trace needs a compiled model digest or exact artifact SHA-256.');
  requireThat(trace.productId === productId
    && (!hasModel || isDigest(trace.modelDigest) && trace.modelDigest === modelDigest)
    && (!hasArtifact || isDigest(trace.artifactSha256) && trace.artifactSha256 === artifactSha256),
  'trace.identity', 'Trace does not match this compiled model or artifact. Open the matching bundle.');
  requireThat(short(trace.sessionId) && ['recorded', 'test-run', 'synthetic'].includes(trace.provenance), 'trace.session', 'A trace requires a session and an explicit evidence origin.');
  requireThat(trace.clock?.unit === 'ms' && ['wall','monotonic','virtual'].includes(trace.clock.domain), 'trace.clock', 'Trace clock must have an explicit supported domain.');
  requireThat(Array.isArray(trace.events) && trace.events.length <= LIMIT, 'trace.size', 'Trace exceeds the supported event budget.');
  requireThat(plain(trace.truncation) && Number.isSafeInteger(trace.truncation.droppedBefore) && trace.truncation.droppedBefore >= 0
    && Array.isArray(trace.truncation.gaps), 'trace.gaps', 'Trace must declare dropped events and gaps.');
  requireThat(trace.truncation.gaps.length <= LIMIT, 'trace.gaps', 'Too many declared trace gaps.');
  let previousGapEnd = trace.truncation.droppedBefore - 1;
  for (const gap of trace.truncation.gaps) {
    requireThat(plain(gap) && Number.isSafeInteger(gap.from) && Number.isSafeInteger(gap.to)
      && gap.from > previousGapEnd && gap.to >= gap.from && short(gap.reason, 2000),
      'trace.gap', 'Gaps must be ordered, non-overlapping missing intervals with a reason.');
    previousGapEnd = gap.to;
  }
  const known = new Set(architecture.entities.map(e => e.key)), observed = new Set();
  let sequence = trace.truncation.droppedBefore - 1, time = -1, gapIndex = 0;
  for (const event of trace.events) {
    validateEvent(event, known);
    requireThat(event.sequence > sequence, 'trace.order', 'Trace sequence numbers must be strictly increasing.');
    if (trace.clock.domain !== 'wall') requireThat(event.atMs >= time, 'trace.time', 'Monotonic or virtual event time moved backwards.');
    if (event.sequence !== sequence + 1) {
      const gap = trace.truncation.gaps[gapIndex++];
      requireThat(gap?.from === sequence + 1 && gap?.to === event.sequence - 1,
        'trace.gap', 'Missing event sequences must be declared as gaps.');
    }
    sequence = event.sequence; time = event.atMs; observed.add(sequence);
  }
  requireThat(gapIndex === trace.truncation.gaps.length, 'trace.gap',
    'A declared gap does not match missing captured sequences. Trailing loss needs a future trace schema.');
  return { ...trace, ...traceStatePath(trace.events), traceDigest: digest(canonicalJson(trace)),
    notice: trace.provenance === 'synthetic' ? 'Synthetic trace. No product runtime was observed.'
      : trace.provenance === 'test-run' ? 'Test run. Events were recorded by an owner-run test, not a live product session.'
      : 'Recorded events supplied by a producer. Identity is checked; the trace is not authenticated and does not prove sensor accuracy.',
    incompleteCausality: trace.events.some(e => e.causedBy !== undefined && !observed.has(e.causedBy)),
    complete: trace.truncation.droppedBefore === 0 && trace.truncation.gaps.length === 0 };
}

const traceIndexes = new WeakMap();
function traceIndex(trace) {
  let index = traceIndexes.get(trace);
  if (!index) {
    index = { bySequence: new Map(trace.events.map(e => [e.sequence,e])),
      positions: new Map(trace.events.map((e,i) => [e.sequence,i])) };
    if (Object.isFrozen(trace)) traceIndexes.set(trace,index);
  }
  return index;
}
export const traceEventIndex = (trace, sequence) => traceIndex(trace).positions.get(sequence);

export function inspectTrace(trace, { cursor = trace.events.length - 1, entityKey = null, operationId = null, search = '' } = {}) {
  requireThat(Number.isSafeInteger(cursor) && cursor >= -1 && cursor < trace.events.length, 'trace.cursor', 'Select an existing trace frame.');
  const visible = trace.events.slice(0, cursor + 1), current = trace.events[cursor] ?? null;
  const activity = new Map();
  for (const event of visible) {
    const old = activity.get(event.entityKey);
    activity.set(event.entityKey, { entityKey: event.entityKey, count: (old?.count ?? 0) + 1, lastSequence: event.sequence,
      lastAtMs: event.atMs, summary: event.summary ?? null });
  }
  requireThat(typeof search === 'string' && search.length <= 1000
    && (entityKey === null || short(entityKey)) && (operationId === null || short(operationId)),
    'trace.filter', 'Trace filters must be bounded strings.');
  const text = search.toLowerCase();
  const events = trace.events.filter(e => (!entityKey || e.entityKey === entityKey) && (!operationId || e.operationId === operationId)
    && (!text || `${e.entityKey} ${e.summary ?? ''} ${e.kind} ${e.logic?.cellId ?? ''}`.toLowerCase().includes(text)));
  const path = [], { bySequence } = traceIndex(trace);
  let parent = current, missingParentSequence = null;
  const visited = new Set();
  while (parent) {
    requireThat(!visited.has(parent.sequence), 'trace.cycle', 'A causal chain contains a cycle.');
    visited.add(parent.sequence);
    path.push(parent);
    if (parent.causedBy === undefined) break;
    const next = bySequence.get(parent.causedBy);
    if (!next) { missingParentSequence = parent.causedBy; break; }
    parent = next;
  }
  return { cursor, current, events, activity: [...activity.values()], causalPath: path.reverse(),
    missingParent: missingParentSequence !== null,
    missingParentSequence,
    causalPathComplete: missingParentSequence === null,
    message: 'Completeness concerns only explicitly recorded causedBy links. Missing metadata, timestamps and nearby events do not establish actual causality.' };
}
