import { entityKey } from './architecture.mjs';
import { canonicalJson, plain, requireThat } from './util.mjs';

const token = value => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/u.test(value);
const only = (value, fields) => requireThat(plain(value) && Object.keys(value).every(key=>fields.includes(key)),
  'live.event-field', 'Observation contains an undeclared field. Remove raw payloads before enqueueing.');

function validateLiveObservation(raw, facet) {
  const common=['kind','phase','sequence','atMs','instanceId'];
  const fields=raw.kind==='port'?[...common,'portRef']
    :raw.kind==='decision'?[...common,'facetId','cellId','facts','values']
    :[...common,'facetId','cellId','from','to','input','guards'];
  only(raw,fields);
  requireThat(Number.isSafeInteger(raw.sequence) && raw.sequence>=0
    && Number.isFinite(raw.atMs) && raw.atMs>=0
    && (raw.instanceId===undefined || token(raw.instanceId)),
  'live.event','Observation needs a bounded sequence, monotonic time and optional opaque instance.');
  requireThat(raw.phase === (raw.kind==='port'?'returned':'evaluated')
    || raw.kind==='transition' && raw.phase==='applied',
  'live.phase','The event phase does not match its declared family.');
  if(raw.kind==='port') { requireThat(token(raw.portRef),'live.port','Use a declared port identity.');return; }
  requireThat(token(raw.facetId) && (raw.cellId===null || raw.cellId===undefined || token(raw.cellId)),
    'live.facet','Use a bounded declared facet and cell identity.');
  if(raw.kind==='decision') {
    if(raw.facts!==undefined) {
      only(raw.facts,Object.keys(facet.compiled.axes));
      requireThat(Object.entries(raw.facts).every(([axis,value])=>facet.compiled.axes[axis]?.includes(value)),
        'live.facts','Decision facts must be declared finite axis values.');
    }
    if(raw.values!==undefined) {
      only(raw.values,Object.keys(facet.compiled.columns));
      requireThat(Object.entries(raw.values).every(([column,value])=>facet.compiled.cells.some(cell=>
        canonicalJson(cell.values?.[column])===canonicalJson(value))),
      'live.values','Decision outputs must be values declared in this finite table.');
    }
    return;
  }
  requireThat(token(raw.from) && token(raw.to) && facet.compiled.inputs.includes(raw.input),
    'live.input','Machine input must be declared; states must be bounded names.');
  if(raw.guards!==undefined) {
    only(raw.guards,facet.compiled.guards);
    requireThat(Object.values(raw.guards).every(value=>typeof value==='boolean'),
      'live.guards','Machine guards must be declared booleans.');
  }
}

/** Maps declared raw observations to model entities for both file and live capture. */
export function eventFor(raw, view, { live = false } = {}) {
  requireThat(raw && typeof raw === 'object' && ['decision', 'transition', 'port'].includes(raw.kind),
    'observation.event', 'Unsupported observation family.');
  if (raw.kind === 'port') {
    if(live)validateLiveObservation(raw,null);
    const key = entityKey('port', raw.portRef);
    requireThat(view.architecture.entities.some(entity => entity.key === key),
      'observation.port', `Port '${raw.portRef}' is absent from the compiled product.`);
    return { kind: 'port', entityKey: key, summary: `Port ${raw.portRef}` };
  }
  const kind = raw.kind === 'decision' ? 'decision-table' : 'machine';
  const facet = view.facets.find(item => item.kind === kind && item.id === raw.facetId);
  requireThat(facet, 'observation.facet', `Declared ${kind} '${raw.facetId}' is absent from the compiled model.`);
  if(live)validateLiveObservation(raw,facet);
  const cell = raw.cellId === null || raw.cellId === undefined ? null : facet.compiled.cells.find(item => item.id === raw.cellId);
  // An applied result may contradict the declaration. Keep it on the facet instead of dropping the evidence.
  requireThat(live || raw.phase === 'applied' || raw.cellId === null || raw.cellId === undefined || cell,
    'observation.cell', `Cell '${raw.cellId}' is absent from ${raw.facetId}.`);
  requireThat(raw.kind !== 'decision' || cell || live, 'observation.cell', `Decision '${raw.facetId}' must name its cell.`);
  const logic = raw.kind === 'decision'
    ? { facetId: raw.facetId, cellId: raw.cellId, facts: raw.facts, values: raw.values }
    : { facetId: raw.facetId, cellId: cell?.id ?? (live ? raw.cellId ?? null : null),
      from: raw.from, to: raw.to, input: raw.input, guards: raw.guards };
  return { kind: raw.kind, entityKey: cell
    ? entityKey('cell', cell.id, `${kind}/${raw.facetId}`) : entityKey('facet', raw.facetId, kind),
  summary: raw.kind === 'decision' ? `${raw.facetId}: ${raw.cellId}` : `${raw.from} → ${raw.to} via ${raw.input}`,
  logic, ...(raw.phase ? { phase: raw.phase } : {}), ...(raw.instanceId ? { instanceId: raw.instanceId } : {}) };
}
