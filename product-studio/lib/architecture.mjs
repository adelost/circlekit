import { canonicalJson, digest, plain, requireThat } from './util.mjs';

export const entityKey = (kind, id, parent = '') => [kind, parent, id].map(encodeURIComponent).join(':');
const ID = value => typeof value === 'string' && value.length > 0 && value.length <= 600;

/** Compiler data is authoritative. Groups and facet associations retain their origin. */
export function architectureOf(product, facets = [], metadata = {}) {
  const edgeKeys = new Set();
  const entities = [], edges = [], groups = [], byKey = new Map(), portOwners = new Map();
  const add = (kind, id, data, parent = '') => {
    requireThat(ID(id), 'architecture.id', 'An architecture entity needs a stable identity.');
    const key = entityKey(kind, id, parent);
    requireThat(!byKey.has(key), 'architecture.duplicate', `Duplicate architecture entity '${key}'.`);
    const item = { key, id, kind, label: id, data, parent: parent || null };
    entities.push(item); byKey.set(key, item); return key;
  };
  const connect = (from, to, kind, details = {}) => {
    requireThat(byKey.has(from) && byKey.has(to), 'architecture.edge', 'An association names an unknown architecture entity.');
    const id = `edge:${digest(canonicalJson({ from, to, kind, details })).slice(0, 24)}`;
    if (!edgeKeys.has(id)) { edgeKeys.add(id); edges.push({ id, from, to, kind, ...details }); }
  };
  const types = new Map([...(product?.nodeTypes ?? []), ...(product?.componentTypes ?? [])].map(t => [t.id, t]));
  for (const n of product?.nodes ?? []) add('node', n.id, { declaration: n, type: types.get(n.nodeTypeRef) ?? null });
  for (const n of product?.components ?? []) add('component', n.id, { declaration: n, type: types.get(n.componentTypeRef) ?? null });
  for (const [kind, list] of [['node', product?.portRegistry?.nodePorts], ['component', product?.portRegistry?.componentPorts]]) {
    for (const p of list ?? []) {
      const owner = entityKey(kind, p.ownerId), key = add('port', p.ref, p);
      requireThat(byKey.has(owner), 'architecture.port', `Unknown owner of '${p.ref}'.`);
      portOwners.set(p.ref, owner); byKey.get(key).owner = owner;
      connect(owner, key, 'owns', { evidence: 'compiler' });
    }
  }
  for (const b of product?.portRegistry?.bindings ?? []) {
    const from = entityKey('port', b.from), to = entityKey('port', b.to);
    const source = byKey.get(from), target = byKey.get(to);
    connect(from, to, 'binding', { purpose: b.purpose ?? target?.data.purpose ?? source?.data.purpose ?? 'data', evidence: 'compiler', binding: b });
  }
  for (const a of product?.artifacts ?? []) add('artifact', a.id, a);
  for (const scope of product?.artifactScopes ?? []) {
    for (const mount of scope.includedMounts ?? []) {
      const id = `${scope.artifactRef}/${scope.screenRef}/${scope.surface}/${mount.mountRef}`;
      const key = add('mount', id, { ...mount, artifactRef: scope.artifactRef, screenRef: scope.screenRef, surface: scope.surface });
      connect(entityKey('artifact', scope.artifactRef), key, 'contains', { evidence: 'compiler' });
      connect(key, entityKey('component', mount.componentInstanceRef), 'mounts', { evidence: 'compiler' });
    }
  }
  for (const [kind, items] of [
    ['authority', product?.stateAuthorities], ['config', product?.configs], ['finite-value', product?.finiteValues],
    ['component-type', product?.componentTypes], ['node-type', product?.nodeTypes],
  ]) for (const item of items ?? []) add(kind, item.id, item);
  if (product?.navigation) add('navigation', product.navigation.id ?? 'navigation', product.navigation);
  if (product?.lanes) add('lanes', product.lanes.id ?? 'lanes', product.lanes);
  for (const f of facets) {
    const key = add('facet', f.id, f, f.kind);
    for (const cell of Array.isArray(f.compiled?.cells) ? f.compiled.cells : []) {
      const child = add('cell', cell.id, { facetId: f.id, facetKind: f.kind, cell }, `${f.kind}/${f.id}`);
      connect(key, child, 'contains', { evidence: 'compiler' });
    }
  }
  const assigned = new Set();
  for (const g of metadata.groups ?? []) {
    requireThat(ID(g.id) && ID(g.label) && Array.isArray(g.members), 'group.shape', 'A group needs an ID, label and explicit members.');
    requireThat(!groups.some(prior => prior.id === g.id), 'group.duplicate', 'Duplicate group identity.');
    for (const key of g.members) {
      requireThat(byKey.has(key) && ['node', 'component'].includes(byKey.get(key).kind), 'group.member', `Unknown or non-owner group member '${key}'.`);
      requireThat(!assigned.has(key), 'group.overlap', `Owner '${key}' is in more than one group.`);
      assigned.add(key); byKey.get(key).group = g.id;
    }
    groups.push({ ...g, evidence: g.evidence === 'compiler' ? 'compiler' : 'adapter' });
  }
  for (const relation of metadata.relations ?? []) {
    requireThat(['associated', 'implements', 'controls', 'declares'].includes(relation.kind), 'relation.kind', 'Unsupported adapter association kind.');
    connect(relation.from, relation.to, relation.kind, { evidence: 'adapter', label: relation.label ?? relation.kind });
  }
  return { entities, edges, groups, coverage: {
    owners: entities.filter(e => ['node', 'component'].includes(e.kind)).length,
    ports: portOwners.size, bindings: (product?.portRegistry?.bindings ?? []).length,
    explicitGroups: groups.length,
    notice: 'Declared dependencies, not observed execution. Associations supplied by an adapter are labelled. Ungrouped owners are not assigned a domain from their names.',
  } };
}

const ownerKinds = new Set(['node', 'component']);
/** Owner-level reachability is potential impact: internal input-to-output causality is not asserted. */
function dependencyGraph(architecture, purposes) {
  const entities = new Map(architecture.entities.map(e => [e.key, e]));
  const connections = architecture.edges.filter(e => e.kind === 'binding' && purposes.includes(e.purpose))
    .map(e => ({ from: entities.get(e.from)?.owner, to: entities.get(e.to)?.owner, edge: e }));
  const toOwner = key => {
    const entity = entities.get(key);
    requireThat(entity, 'query.selection', 'Selected architecture entity is not in this bundle.');
    return ownerKinds.has(entity.kind) ? entity.key : entity.kind === 'port' ? entity.owner : null;
  };
  return { entities, connections, toOwner };
}

export function queryArchitecture(architecture, request) {
  const purposes = request.purposes ?? ['data'];
  requireThat(Array.isArray(purposes) && purposes.length > 0 && purposes.every(p => ['data', 'demand', 'context'].includes(p)), 'query.purpose', 'Select data, demand or context edges explicitly.');
  requireThat(['upstream', 'downstream', 'path', 'consumers', 'owner', 'impact'].includes(request.kind), 'query.kind', 'Unsupported architecture query.');
  const { entities, connections, toOwner } = dependencyGraph(architecture, purposes);
  const selected = entities.get(request.from);
  requireThat(selected, 'query.selection', 'Select a known entity.');
  let start = toOwner(request.from), association = false;
  if (!start && request.kind === 'impact') {
    const starts = architecture.edges.filter(e => e.from === selected.key && ['controls', 'implements', 'associated'].includes(e.kind))
      .map(e => toOwner(e.to)).filter(Boolean);
    if (!starts.length) return { kind: 'impact', keys: [selected.key], edgeIds: [], paths: [], supported: false,
      message: 'No explicit association connects this declaration to a runtime owner. Impact beyond the declaration is unknown.' };
    return combineImpact(architecture, request, starts);
  }
  requireThat(start, 'query.owner', 'This selection has no declared runtime owner. No dependency path is inferred from its name.');
  if (request.kind === 'owner') return { kind: 'owner', keys: [start], edgeIds: [], paths: [], supported: true, message: 'Declared port owner.' };
  const backwards = request.kind === 'upstream', adjacent = new Map();
  for (const c of connections) {
    const from = backwards ? c.to : c.from, to = backwards ? c.from : c.to;
    const list = adjacent.get(from) ?? []; list.push({ to, c }); adjacent.set(from, list);
  }
  const reached = new Set([start]), previous = new Map(), queue = [start], selectedEdges = new Map();
  const targetEntity = request.kind === 'path' ? entities.get(request.to) : null;
  const goal = request.kind === 'path' ? toOwner(request.to) : null;
  if (goal === start && targetEntity?.kind === 'port' && selected.key !== targetEntity.key) return { kind:'path', keys:[start], edgeIds:[], paths:[], supported:true, found:false, message:'No internal port-to-port route is declared by this owner-level graph. Inspect the implementation.' };
  if (request.kind === 'path') requireThat(goal, 'query.target', 'Choose a target owner or port for the path query.');
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const owner = queue[cursor];
    for (const { to, c } of adjacent.get(owner) ?? []) {
      if (request.kind === 'path' && to === goal && targetEntity?.kind === 'port' && c.edge.to !== targetEntity.key) continue;
      // A selected port seeds only its own edges. Later owners remain potential dependencies.
      if (owner === start && selected.kind === 'port' && (backwards ? c.edge.to : c.edge.from) !== selected.key) continue;
      selectedEdges.set(c.edge.id, c.edge);
      if (!reached.has(to)) {
        reached.add(to); previous.set(to, { owner, edge: c.edge });
        if (request.kind !== 'consumers') queue.push(to);
      }
    }
  }
  let keys = [...reached], edgeIds = [...selectedEdges.keys()], paths = [];
  if (request.kind === 'path') {
    if (!reached.has(goal)) return { kind: 'path', keys: [start, goal], edgeIds: [], paths: [], supported: true, found: false,
      message: 'No directed path exists in the selected declared dependencies.' };
    const nodes = [goal], links = [];
    while (nodes.at(-1) !== start) { const p = previous.get(nodes.at(-1)); nodes.push(p.owner); links.push(p.edge.id); }
    keys = nodes.reverse(); edgeIds = links.reverse(); paths = [{ keys, edgeIds }];
  }
  const mounts = architecture.entities.filter(e => e.kind === 'mount' && architecture.edges.some(edge => edge.from === e.key && edge.kind === 'mounts' && reached.has(edge.to)));
  return { kind: request.kind, keys, edgeIds, paths, supported: true, found: true, association,
    affectedMounts: request.kind === 'impact' ? mounts.map(m => ({ key: m.key, ...m.data })) : [],
    message: 'Possible impact through declared owner dependencies. This does not prove event order or internal algorithm causality.' };
}
function combineImpact(architecture, request, starts) {
  const results = starts.map(from => queryArchitecture(architecture, { ...request, from }));
  return { kind: 'impact', keys: [...new Set([request.from, ...results.flatMap(r => r.keys)])],
    edgeIds: [...new Set(results.flatMap(r => r.edgeIds))], paths: [], supported: true, association: true,
    affectedMounts: [...new Map(results.flatMap(r => r.affectedMounts).map(m => [m.key, m])).values()],
    message: 'Potential impact through an explicit adapter association and declared bindings, not observed execution.' };
}

export function architectureSlice(architecture, { mode = 'owners', group = null, query = '', result = null } = {}) {
  const owners = architecture.entities.filter(e => ownerKinds.has(e.kind));
  const byKey = new Map(architecture.entities.map(e => [e.key, e]));
  const wanted = result?.keys ? new Set(result.keys) : null;
  const text = query.toLowerCase();
  const selected = owners.filter(e => (!group || (group === '__ungrouped' ? !e.group : e.group === group))
    && (!text || `${e.id} ${e.kind} ${JSON.stringify(e.data.type?.outputs ?? [])}`.toLowerCase().includes(text))
    && (!wanted || wanted.has(e.key)));
  if (mode === 'domains') {
    const included = new Set(selected.map(e => e.key));
    const nodeMap = new Map();
    for (const entity of selected) {
      const id = entity.group ?? '__ungrouped';
      const g = architecture.groups.find(g => g.id === id);
      if (!nodeMap.has(id)) nodeMap.set(id, { id, label: g?.label ?? 'Ungrouped', kind: 'domain', count: 0, evidence: g?.evidence ?? 'none' });
      nodeMap.get(id).count++;
    }
    const edges = new Map();
    for (const edge of architecture.edges.filter(e => e.kind === 'binding')) {
      const a = byKey.get(edge.from)?.owner, b = byKey.get(edge.to)?.owner;
      if (!included.has(a) || !included.has(b)) continue;
      const from = byKey.get(a).group ?? '__ungrouped', to = byKey.get(b).group ?? '__ungrouped';
      const id = `${from}|${to}|${edge.purpose}`;
      if (!edges.has(id)) edges.set(id, { id, source: from, target: to, purpose: edge.purpose, count: 0 });
      edges.get(id).count++;
    }
    return { nodes: [...nodeMap.values()].map(n => ({ ...n, subtitle: `${n.count} owners · ${n.evidence === 'none' ? 'no group declared' : n.evidence}` })),
      edges: [...edges.values()].map(e => ({ ...e, label: `${e.count} ${e.purpose} bindings` })), totalOwners: owners.length, shownOwners: selected.length };
  }
  const included = new Set(selected.map(e => e.key));
  return { nodes: selected.map(e => ({ id: e.key, label: e.id, kind: e.kind === 'component' ? 'component' : e.data.type?.kind ?? 'code', subtitle: e.group ?? 'No declared group' })),
    edges: architecture.edges.filter(e => e.kind === 'binding' && included.has(byKey.get(e.from)?.owner) && included.has(byKey.get(e.to)?.owner)
      && (!result?.edgeIds || result.edgeIds.includes(e.id)))
      .map(e => ({ ...e, source: byKey.get(e.from).owner, target: byKey.get(e.to).owner, label: e.purpose })),
    totalOwners: owners.length, shownOwners: selected.length };
}
