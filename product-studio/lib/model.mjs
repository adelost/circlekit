import { compileDeclaration, KERNEL_VERSION } from './kernel.mjs';
import { boundedJson, digest, plain, requireThat, StudioError, canonicalJson } from './util.mjs';
import { validateInspectionBundle, compatibilityReport } from './inspection.mjs';
import { validateGraphProduct } from './graph-data.mjs';

export function decodeArtifact(text, name = 'artifact.json') {
  const data = boundedJson(text);
  if (data?.kind === 'product-studio-bundle' && data.version === 2) {
    const inspection = validateInspectionBundle(data), compatibility = compatibilityReport(inspection, KERNEL_VERSION);
    const product = data.product ? decodeProductLike(data.product) : null;
    const facets = mergeFacets(data.facets, (product?.decisionTables ?? []).map(compiled => ({ id: compiled.id, kind: 'decision-table', compiled })));
    const producerErrors = inspection.diagnostics.some(d => d.severity === 'error');
    const decoded = facets.map(f => decodeFacet(f, compatibility));
    return { product, facets: producerErrors ? decoded.map(f => ({ ...f, runnable:false, blockedReason:'The producer reported validation errors. Inspect the model, but resolve them before simulation.' })) : decoded, inspection, compatibility,
      identity: { source: name, productDigest: data.artifacts.productSha256 ?? null, modelDigest: data.modelDigest }, raw: text };
  }
  if (data?.kind === 'product-studio-bundle' && data.version === 1) {
    requireThat(Array.isArray(data.facets) && data.facets.length <= 100, 'bundle.facets', 'Invalid facet list.');
    const product = data.product ? decodeProductLike(data.product) : null;
    return { product, facets: mergeFacets(data.facets, (product?.decisionTables ?? []).map(compiled => ({ kind: 'decision-table', compiled }))).map(f => decodeFacet(f)),
      identity: { source: name, productDigest: null }, raw: text };
  }
  if (data?.kind === 'product-spec-ir') return { product: decodeProduct(data), facets: tableFacets(data), identity: { source: name, productDigest: digest(text) }, raw: text };
  if (data?.states && data.inputs && data.cells) return { product: null, facets: [decodeFacet({ kind: 'machine', compiled: data })], identity: { source: name }, raw: text };
  if (data?.axes && data.columns && data.cells) return { product: null, facets: [decodeFacet({ kind: 'decision-table', compiled: data })], identity: { source: name }, raw: text };
  throw new StudioError('artifact.schema', 'Expected ProductSpec IR, a machine, a decision table, or a supported Product Studio inspection bundle.');
}
function mergeFacets(explicit, embedded) {
  const result = new Map();
  for (const f of [...explicit, ...embedded]) {
    const id = f.id ?? f.compiled?.id;
    requireThat(typeof id === 'string', 'facet.id', 'Facet identity is missing.');
    const prior = result.get(id);
    requireThat(!prior || prior.kind === f.kind && canonicalJson(prior.compiled) === canonicalJson(f.compiled), 'facet.conflict', `Conflicting exported definitions for '${id}'.`);
    if (!prior) result.set(id, { ...f, id });
  }
  return [...result.values()];
}
function decodeFacet(f, compatibility = null) {
  requireThat(plain(f) && typeof f.kind === 'string' && plain(f.compiled), 'facet.shape', 'Malformed compiled facet.');
  const raw = f.compiled;
  if (!['machine', 'decision-table'].includes(f.kind) || compatibility?.simulate === false) {
    return { id: raw.id, kind: f.kind, compiled: raw, validation: 'inspect-only', runnable: false,
      blockedReason: compatibility?.reason ?? 'This facet needs an owned inspection/runner adapter.', editable: false, source: null };
  }
  const descriptions = (raw.invariants ?? []).filter(v => typeof v === 'string');
  const declaration = descriptions.length ? { ...raw, invariants: [] } : raw;
  const compiled = compileDeclaration(f.kind, declaration);
  return { id: compiled.id, kind: f.kind, compiled: { ...compiled, ...(descriptions.length ? { invariants: descriptions } : {}) },
    validation: descriptions.length ? 'structure-only-invariant-code-unavailable' : 'shared-kernel',
    runnable: true, kernelVersion: KERNEL_VERSION, editable: false, source: null };
}
function tableFacets(product) { return (product.decisionTables ?? []).map(compiled => decodeFacet({ kind: 'decision-table', compiled })); }

function decodeProductLike(product) {
  if (product?.kind === 'product-spec-graph') return validateGraphProduct(product);
  return decodeProduct(product);
}

/** Viewer integrity checks, not the whole compiler or native-conformance proof. */
export function decodeProduct(product) {
  requireThat(plain(product) && product.kind === 'product-spec-ir' && product.schemaVersion === 9 && typeof product.id === 'string', 'product.schema', 'Only ProductSpec IR schema 9 is supported.');
  for (const key of ['nodes', 'components', 'componentTypes', 'nodeTypes', 'artifacts']) requireThat(Array.isArray(product[key]) && product[key].length <= 10000, 'product.shape', `Product '${key}' must be a bounded array.`);
  requireThat(plain(product.portRegistry), 'product.ports', 'Product port registry is missing.');
  const owners = new Set();
  for (const node of [...product.nodes, ...product.components]) {
    requireThat(typeof node.id === 'string' && !owners.has(node.id), 'product.identity', 'Duplicate or missing node/component identity.'); owners.add(node.id);
  }
  const ports = new Set();
  for (const key of ['nodePorts', 'componentPorts']) {
    requireThat(Array.isArray(product.portRegistry[key]) && product.portRegistry[key].length <= 30000, 'product.ports', `Missing or oversized ${key}.`);
    for (const p of product.portRegistry[key]) {
      requireThat(typeof p.ref === 'string' && owners.has(p.ownerId) && !ports.has(p.ref), 'product.port', 'Unknown owner, duplicate or missing port identity.'); ports.add(p.ref);
    }
  }
  requireThat(Array.isArray(product.portRegistry.bindings) && product.portRegistry.bindings.length <= 30000, 'product.bindings', 'Missing or oversized port bindings.');
  for (const b of product.portRegistry.bindings) requireThat(ports.has(b.from) && ports.has(b.to), 'product.edge', 'A binding references an undeclared port.');
  return product;
}

export function graphOf(product) {
  if (!product) return { nodes: [], edges: [], ports: [] };
  const types = new Map([...product.nodeTypes, ...product.componentTypes].map(t => [t.id, t]));
  const ports = [...product.portRegistry.nodePorts, ...product.portRegistry.componentPorts];
  const portOwners = new Map(ports.map(p => [p.ref, p.ownerId])), byOwner = new Map();
  for (const p of ports) { const list = byOwner.get(p.ownerId) ?? []; list.push(p); byOwner.set(p.ownerId, list); }
  const nodes = [...product.nodes.map(n => ({ ...n, component: false })), ...product.components.map(n => ({ ...n, component: true }))].map(n => {
    const type = types.get(n.nodeTypeRef ?? n.componentTypeRef);
    return { id: n.id, kind: n.component ? 'component' : type?.kind ?? 'code', domain: null,
      type: type ?? null, declaration: n, ports: byOwner.get(n.id) ?? [] };
  });
  return { nodes, ports, edges: product.portRegistry.bindings.map(e => ({ ...e, id: digest(canonicalJson(e)), source: portOwners.get(e.from), target: portOwners.get(e.to) })) };
}

export function attachSnapshot(product, productDigest, graphDigest, text) {
  const snapshot = boundedJson(text);
  requireThat(product && snapshot.productId === product.id && snapshot.schemaVersion === product.schemaVersion
    && snapshot.productSha256 === productDigest && graphDigest && snapshot.graphSha256 === graphDigest,
  'evidence.identity', 'Snapshot does not match this exact product and graph. Load matching generated files first.');
  requireThat(snapshot.dumpSchemaVersion === 1 && Number.isFinite(snapshot.takenAtMs) && Array.isArray(snapshot.ports)
    && Array.isArray(snapshot.activeNodes), 'evidence.schema', 'Unsupported port snapshot.');
  const graph = graphOf(product), known = new Set(graph.ports.map(p => p.ref));
  const active = new Set(product.nodes.map(n => n.id));
  requireThat(snapshot.activeNodes.every(id => active.has(id)) && new Set(snapshot.activeNodes).size === snapshot.activeNodes.length, 'evidence.active', 'Unknown or duplicate active node in snapshot.');
  requireThat(new Set(snapshot.ports.map(p => p.port)).size === snapshot.ports.length, 'evidence.duplicate', 'Duplicate snapshot port.');
  for (const p of snapshot.ports) requireThat(known.has(p.port) && Number.isSafeInteger(p.count) && p.count >= 0
    && Number.isFinite(p.lastAtMs) && p.lastAtMs <= snapshot.takenAtMs, 'evidence.port', 'Invalid port identity, count or timestamp.');
  return { kind: 'recorded-snapshot', snapshot,
    notice: 'Port activity at capture time, not source freshness. This snapshot does not contain an event timeline.' };
}
