import { compileDeclaration } from './kernel.mjs';
import { boundedJson, digest, plain, requireThat, StudioError } from './util.mjs';

export function decodeArtifact(text, name = 'artifact.json') {
  const data = boundedJson(text);
  if (data.kind === 'product-studio-bundle' && data.version === 1) {
    requireThat(Array.isArray(data.facets) && data.facets.length <= 100, 'bundle.facets', 'Invalid facet list.');
    const product = data.product ? decodeProduct(data.product) : null;
    return { product, facets: data.facets.map(decodeFacet), identity: { source: name, productDigest: product ? digest(JSON.stringify(product)) : null }, raw: text };
  }
  if (data.kind === 'product-spec-ir') return { product: decodeProduct(data), facets: tableFacets(data), identity: { source: name, productDigest: digest(text) }, raw: text };
  if (data.states && data.inputs && data.cells) return { product: null, facets: [decodeFacet({ kind: 'machine', compiled: data })], identity: { source: name }, raw: text };
  if (data.axes && data.columns && data.cells) return { product: null, facets: [decodeFacet({ kind: 'decision-table', compiled: data })], identity: { source: name }, raw: text };
  throw new StudioError('artifact.schema', 'Expected ProductSpec IR, a machine, a decision table, or a version-1 Product Studio bundle.');
}
function decodeFacet(f) {
  requireThat(['machine', 'decision-table'].includes(f.kind) && plain(f.compiled), 'facet.unsupported', 'Unsupported facet. Export a supported machine or decision table.');
  const raw = f.compiled;
  // Invariant descriptions are not executable invariants. Preserve and disclose them.
  const descriptions = (raw.invariants ?? []).filter(v => typeof v === 'string');
  const declaration = descriptions.length ? { ...raw, invariants: [] } : raw;
  const compiled = compileDeclaration(f.kind, declaration);
  return { id: compiled.id, kind: f.kind, compiled: { ...compiled, ...(descriptions.length ? { invariants: descriptions } : {}) },
    validation: descriptions.length ? 'structure-only-invariant-code-unavailable' : 'shared-kernel',
    editable: false, source: null };
}
function tableFacets(product) { return (product.decisionTables ?? []).map(compiled => decodeFacet({ kind: 'decision-table', compiled })); }

/** Input integrity for a viewer, NOT the whole ProductSpec compiler/conformance proof. */
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
    requireThat(Array.isArray(product.portRegistry[key]), 'product.ports', `Missing ${key}.`);
    for (const p of product.portRegistry[key]) {
      requireThat(typeof p.ref === 'string' && owners.has(p.ownerId) && !ports.has(p.ref), 'product.port', 'Unknown owner, duplicate or missing port identity.'); ports.add(p.ref);
    }
  }
  requireThat(Array.isArray(product.portRegistry.bindings), 'product.bindings', 'Missing port bindings.');
  for (const b of product.portRegistry.bindings) requireThat(ports.has(b.from) && ports.has(b.to), 'product.edge', 'A binding references an undeclared port.');
  return product; // Preserve product-owned extension fields without inventing semantics.
}

export function graphOf(product) {
  if (!product) return { nodes: [], edges: [], ports: [] };
  const types = new Map([...product.nodeTypes, ...product.componentTypes].map(t => [t.id, t]));
  const ports = [...product.portRegistry.nodePorts, ...product.portRegistry.componentPorts];
  const portOwners = new Map(ports.map(p => [p.ref, p.ownerId]));
  const nodes = [...product.nodes.map(n => ({ ...n, component: false })), ...product.components.map(n => ({ ...n, component: true }))].map(n => {
    const type = types.get(n.nodeTypeRef ?? n.componentTypeRef);
    return { id: n.id, kind: n.component ? 'component' : type?.kind ?? 'code', domain: n.id.split('.')[0],
      type: type ?? null, declaration: n, ports: ports.filter(p => p.ownerId === n.id) };
  });
  return { nodes, ports, edges: product.portRegistry.bindings.map((e, i) => ({ ...e, id: `binding-${i}`, source: portOwners.get(e.from), target: portOwners.get(e.to) })) };
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
