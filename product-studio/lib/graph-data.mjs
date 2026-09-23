import { plain, requireThat } from './util.mjs';

/**
 * WHAT: Validates a compiled ProductSpec graph without pretending it is full ProductIr.
 * WHY: Keeps bounded web bindings inspectable while product-specific semantics stay with their owner.
 */
export function validateCompiledGraph(graph) {
  requireThat(plain(graph),'graph.shape','Expected compileProductGraph output.');
  for(const key of ['nodeTypes','nodes','componentTypes','components','configs'])
    requireThat(Array.isArray(graph[key])&&graph[key].length<=10000,'graph.shape',`Missing or oversized graph ${key}.`);
  const types=new Set(), owners=new Set();
  for(const value of [...graph.nodeTypes,...graph.componentTypes]) {
    requireThat(typeof value?.id==='string'&&value.id.length>0&&!types.has(value.id),'graph.type','Missing or duplicated graph type.');
    types.add(value.id);
  }
  for(const value of [...graph.nodes,...graph.components]) {
    const ref=value?.nodeTypeRef??value?.componentTypeRef;
    requireThat(typeof value?.id==='string'&&value.id.length>0&&!owners.has(value.id)&&types.has(ref),'graph.owner','Missing, duplicated or untyped graph owner.');
    owners.add(value.id);
  }
  requireThat(plain(graph.portRegistry),'graph.ports','A compiled graph needs its real port registry.');
  const ports=new Set();
  for(const key of ['nodePorts','componentPorts']) {
    requireThat(Array.isArray(graph.portRegistry[key])&&graph.portRegistry[key].length<=30000,'graph.ports',`Missing or oversized ${key}.`);
    for(const p of graph.portRegistry[key]) {
      requireThat(typeof p?.ref==='string'&&owners.has(p.ownerId)&&!ports.has(p.ref),'graph.port','Invalid compiled port identity or owner.');
      ports.add(p.ref);
    }
  }
  requireThat(Array.isArray(graph.portRegistry.bindings)&&graph.portRegistry.bindings.length<=30000,'graph.bindings','A compiled graph needs bounded bindings.');
  for(const b of graph.portRegistry.bindings)
    requireThat(ports.has(b.from)&&ports.has(b.to),'graph.binding','Binding references an unknown compiled port.');
  return graph;
}

/** A viewer projection over real compiler output, explicitly not ProductIr. */
export function graphProduct(compiled,id) {
  validateCompiledGraph(compiled);
  requireThat(typeof id==='string'&&id.length>0&&id.length<=200,'graph.id','Graph inspection needs a stable product selection ID.');
  return {
    kind:'product-spec-graph', schemaVersion:1, id,
    nodeTypes:compiled.nodeTypes, nodes:compiled.nodes, configs:compiled.configs,
    componentTypes:compiled.componentTypes, components:compiled.components,
    portRegistry:compiled.portRegistry,
    artifacts:[], artifactScopes:[], finiteValues:[], stateAuthorities:[], decisionTables:[],
    navigation:null, lanes:null,
    scopeNotice:'Bounded compileProductGraph output. Full ProductIr, navigation, state authority and native conformance are not asserted.',
  };
}

export function validateGraphProduct(product) {
  requireThat(plain(product)&&product.kind==='product-spec-graph'&&product.schemaVersion===1&&typeof product.id==='string'&&product.id.length>0,
    'graph.product','Unsupported compiled graph inspection product.');
  validateCompiledGraph(product);
  requireThat(Array.isArray(product.artifacts)&&Array.isArray(product.artifactScopes)&&Array.isArray(product.finiteValues)
    &&Array.isArray(product.stateAuthorities)&&Array.isArray(product.decisionTables),'graph.product','Graph projection is missing explicit empty full-product fields.');
  return product;
}
