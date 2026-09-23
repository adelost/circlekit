import { canonicalJson, digest, requireThat } from './util.mjs';

/** Data only, never a second semantic model. Freeze once at the load boundary. */
export function freezeData(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freezeData(child, seen);
  return Object.freeze(value);
}

/** Exact tokens plus a bounded substring fallback. Index is private to a snapshot. */
export function buildSearchIndex(view) {
  const origins = new Map(view.sourceIndex.origins.map(o => [o.entityKey, o]));
  const contracts = new Map(view.sourceIndex.contracts.map(contract => [contract.entityKey, contract]));
  const rows = view.architecture.entities.map(e => ({ key: e.key, id: e.id, kind: e.kind,
    label: e.label, group: e.group ?? null, file: origins.get(e.key)?.file ?? null,
    text: `${e.key} ${e.id} ${e.label} ${e.kind} ${e.group ?? ''} ${origins.get(e.key)?.file ?? ''} ${contracts.get(e.key)?.what ?? ''} ${contracts.get(e.key)?.why ?? ''}`.toLowerCase() }));
  const tokens = new Map();
  rows.forEach((row, i) => {
    for (const token of new Set(row.text.split(/[^a-z0-9_-]+/).filter(Boolean))) {
      if (!tokens.has(token)) tokens.set(token, new Set());
      tokens.get(token).add(i);
    }
  });
  return (query, max = 50) => {
    requireThat(typeof query === 'string' && query.length <= 500 && Number.isInteger(max) && max >= 1 && max <= 200,
      'search.input', 'Use bounded search text and a limit of 1..200.');
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let selected = null;
    for (const word of words) {
      const hits = tokens.get(word);
      if (hits) selected = selected === null ? new Set(hits) : new Set([...selected].filter(i => hits.has(i)));
    }
    // Include substring matches when token intersection is empty or too narrow.
    const candidates = selected?.size ? [...selected].map(i => rows[i]) : rows;
    const matches = candidates.filter(r => words.every(w => r.text.includes(w)));
    const { length: total } = matches;
    return { total, truncated: total > max, rows: matches.slice(0, max).map(({ text, ...r }) => r) };
  };
}

/** Identity-keyed comparison: list reorder is not mistaken for entity replacement. */
export function compareSnapshots(before, after, limit = 500) {
  requireThat(before.productId === after.productId, 'compare.product', 'Compare revisions of the same declared product, not unrelated products.');
  const records = v => new Map([
    ...v.architecture.entities.map(e => [e.key, { kind: e.kind, value: e.kind === 'facet'
      ? { kind: e.data.kind, compiled: e.data.compiled } : e.data }]),
    ...v.architecture.edges.map(e => [`binding:${e.id}`, { kind: 'relationship', value: e }]),
    ...v.architecture.groups.map(g => [`group:${g.id}`, { kind: 'group', value: g }]),
  ]);
  const a = records(before), b = records(after), changes = [], counts = { added: 0, removed: 0, changed: 0 };
  for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
    const old = a.get(key), next = b.get(key);
    if (canonicalJson(old) === canonicalJson(next)) continue;
    const status = !old ? 'added' : !next ? 'removed' : 'changed'; counts[status]++;
    if (changes.length < limit) changes.push({ key, kind: (next ?? old).kind, status,
      before: old?.value ?? null, after: next?.value ?? null });
  }
  return { before: { modelDigest: before.modelDigest, bundleDigest: before.bundleDigest },
    after: { modelDigest: after.modelDigest, bundleDigest: after.bundleDigest }, counts, changes,
    truncated: Object.values(counts).reduce((a, b) => a + b, 0) > changes.length,
    sourceChanged: canonicalJson(before.sources.map(s => [s.path, s.digest])) !== canonicalJson(after.sources.map(s => [s.path, s.digest])),
    compatibility: before.compatibility?.producer === after.compatibility?.producer ? 'same-producer-label' : 'producer-changed',
    notice: 'Declared model comparison only. Changed facet and cell counts overlap; no scenario relevance or runtime behavior is inferred.' };
}

export const traceMetadata = trace => trace ? (({ events, ...meta }) => ({ ...meta, eventCount: events.length }))(trace) : null;

/** Omit source text, raw product duplication, native details and event arrays. */
export function summarizeView(view) {
  const { product, graph, architecture, sources, trace, evidence, gallery, ...rest } = view;
  return { ...rest, transport: 'summary-v1', product: product ? { kind: product.kind, schemaVersion: product.schemaVersion,
    id: product.id, artifacts: product.artifacts, artifactScopes: [] } : null,
    graph: { nodes: graph.nodes.map(({ id, kind }) => ({ id, kind })), ports: [], edges: [] },
    architecture: { ...architecture, edges: [], entities: architecture.entities.map(({ data, ...e }) => ({
      ...e, ...(e.kind === 'node' && data?.declaration?.nodeTypeRef ? { nodeTypeRef: data.declaration.nodeTypeRef } : {})
    })) },
    sources: sources.map(({ text, ...s }) => s), trace: traceMetadata(trace), evidence: evidence ? { kind: evidence.kind, notice: evidence.notice } : null,
    gallery: [], catalogAvailable: gallery.length > 0, interfaceLoaded: false,
    payloadNotice: 'Source text, entity details, catalogs and trace events load on demand.' };
}
