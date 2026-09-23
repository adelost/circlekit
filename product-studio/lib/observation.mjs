import { entityKey } from './architecture.mjs';
import { requireThat } from './util.mjs';

/** Maps declared raw observations to model entities for both file and live capture. */
export function eventFor(raw, view) {
  requireThat(raw && typeof raw === 'object' && ['decision', 'transition', 'port'].includes(raw.kind),
    'observation.event', 'Unsupported observation family.');
  if (raw.kind === 'port') {
    const key = entityKey('port', raw.portRef);
    requireThat(view.architecture.entities.some(entity => entity.key === key),
      'observation.port', `Port '${raw.portRef}' is absent from the compiled product.`);
    return { kind: 'port', entityKey: key, summary: `Port ${raw.portRef}` };
  }
  const kind = raw.kind === 'decision' ? 'decision-table' : 'machine';
  const facet = view.facets.find(item => item.kind === kind && item.id === raw.facetId);
  requireThat(facet, 'observation.facet', `Declared ${kind} '${raw.facetId}' is absent from the compiled model.`);
  const cell = raw.cellId === null || raw.cellId === undefined ? null : facet.compiled.cells.find(item => item.id === raw.cellId);
  // An applied result may contradict the declaration. Keep it on the facet instead of dropping the evidence.
  requireThat(raw.phase === 'applied' || raw.cellId === null || raw.cellId === undefined || cell,
    'observation.cell', `Cell '${raw.cellId}' is absent from ${raw.facetId}.`);
  requireThat(raw.kind !== 'decision' || cell, 'observation.cell', `Decision '${raw.facetId}' must name its cell.`);
  const logic = raw.kind === 'decision'
    ? { facetId: raw.facetId, cellId: raw.cellId, facts: raw.facts, values: raw.values }
    : { facetId: raw.facetId, cellId: cell?.id ?? null, from: raw.from, to: raw.to, input: raw.input, guards: raw.guards };
  return { kind: raw.kind, entityKey: cell
    ? entityKey('cell', cell.id, `${kind}/${raw.facetId}`) : entityKey('facet', raw.facetId, kind),
  summary: raw.kind === 'decision' ? `${raw.facetId}: ${raw.cellId}` : `${raw.from} → ${raw.to} via ${raw.input}`,
  logic, ...(raw.phase ? { phase: raw.phase } : {}), ...(raw.instanceId ? { instanceId: raw.instanceId } : {}) };
}
