import test from 'node:test';
import assert from 'node:assert/strict';
import { architectureOf, queryArchitecture, architectureSlice, entityKey as key } from '../lib/architecture.mjs';
import { planForChanges } from '../lib/plan.mjs';
import { createInspectionBundle, validateInspectionBundle, compatibilityReport, checkSourceIdentity } from '../lib/inspection.mjs';
import { digest } from '../lib/util.mjs';
const product = () => ({ id: 'example.system', kind: 'product-spec-ir', schemaVersion: 9,
  nodes: ['a','b','c','d'].map(id => ({ id, nodeTypeRef: 'service' })), nodeTypes: [{ id: 'service', kind: 'service' }],
  componentTypes: [{ id: 'screen' }], components: [{ id: 'view', componentTypeRef: 'screen' }],
  artifacts: [{ id: 'phone', entryScreen: 'main', serves: ['compact'] }],
  artifactScopes: [{ artifactRef: 'phone', screenRef: 'main', surface: 'compact', includedMounts: [{ mountRef: 'main-view', componentInstanceRef: 'view' }] }],
  portRegistry: {
    nodePorts: ['a','b','c','d'].flatMap(ownerId => ['in','out'].map(p => ({ ref: `${ownerId}.${p}`, ownerId, purpose: 'data' }))),
    componentPorts: [{ ref: 'view.in', ownerId: 'view', purpose: 'data' }],
    bindings: [{ from: 'a.out', to: 'b.in' }, { from: 'b.out', to: 'c.in' }, { from: 'c.out', to: 'b.in' }, { from: 'c.out', to: 'view.in' }, { from: 'a.in', to: 'd.in', purpose: 'context' }],
  } });
const graph = () => architectureOf(product());
const bundle = () => createInspectionBundle({ productId: 'example.system', compiler: { name: '@v1d/product-spec', version: '0.3.65' }, product: product() });

test('upstream and downstream terminate through a cycle without adding context edges', () => {
  const down = queryArchitecture(graph(), { kind: 'downstream', from: key('node','a') });
  assert.deepEqual(new Set(down.keys), new Set(['a','b','c'].map(id => key('node',id)).concat(key('component','view'))));
  assert.equal(down.keys.includes(key('node','d')), false);
  const up = queryArchitecture(graph(), { kind: 'upstream', from: key('component','view') });
  assert.equal(up.keys.length, 4);
});
test('path query returns an actual directed shortest declared path', () => {
  const r = queryArchitecture(graph(), { kind: 'path', from: key('node','a'), to: key('component','view') });
  assert.deepEqual(r.keys, [key('node','a'),key('node','b'),key('node','c'),key('component','view')]);
  assert.equal(r.edgeIds.length,3);
});
test('no path is not reported as an empty success', () => {
  const r = queryArchitecture(graph(), { kind: 'path', from: key('node','d'), to: key('node','a') });
  assert.equal(r.found,false); assert.deepEqual(r.paths,[]);
});
test('selected port seeds only its own bindings', () => {
  const r = queryArchitecture(graph(), { kind: 'downstream', from: key('port','a.in'), purposes:['data','context'] });
  assert.deepEqual(r.keys,[key('node','a'),key('node','d')]);
});
test('impact lists actual mounted consumers and admits potential causality', () => {
  const r = queryArchitecture(graph(), { kind:'impact', from:key('node','a') });
  assert.equal(r.affectedMounts[0].artifactRef,'phone'); assert.match(r.message,/does not prove/);
});
test('compiled type instance reaches declared consumers through two bindings', () => {
  const a=graph(), type=key('node-type','service');
  assert(a.edges.some(e=>e.from===type&&e.to===key('node','a')));
  const impact=queryArchitecture(a,{kind:'impact',from:type});
  assert(impact.keys.includes(key('node','a')));
  assert(impact.keys.includes(key('node','c')));
  assert(impact.keys.includes(key('component','view')));
  const component=queryArchitecture(a,{kind:'downstream',from:key('component-type','screen')});
  assert(component.keys.includes(key('component','view')));
  assert.equal(queryArchitecture(a,{kind:'downstream',from:key('node','a'),maxDepth:1}).truncated,true);
});
test('ungrouped is honest; no domain is guessed from an ID prefix', () => {
  const a=graph(); assert.equal(a.groups.length,0);
  const s=architectureSlice(a,{mode:'domains'}); assert.equal(s.nodes[0].label,'Ungrouped'); assert.equal(s.nodes[0].count,5);
});
test('explicit groups aggregate nodes and keep cross-domain edge purposes', () => {
  const a=architectureOf(product(),[],{groups:[{id:'input',label:'Inputs',members:[key('node','a')]},{id:'processing',label:'Processing',members:[key('node','b'),key('node','c')]}]});
  assert.equal(architectureSlice(a,{mode:'domains'}).nodes.length,3);
  assert.equal(architectureSlice(a,{group:'processing'}).nodes.length,2);
});
test('overlapping and unknown group assignments refuse instead of silently reparenting', () => {
  assert.throws(()=>architectureOf(product(),[],{groups:[{id:'x',label:'X',members:[key('node','missing')]}]}),/Unknown/);
  assert.throws(()=>architectureOf(product(),[],{groups:[{id:'x',label:'X',members:[key('node','a')]},{id:'y',label:'Y',members:[key('node','a')]}]}),/more than one/);
});
test('facet impact needs an explicit relation rather than a same-name guess', () => {
  const f={id:'a',kind:'machine',compiled:{id:'a',cells:[]}};
  const r=queryArchitecture(architectureOf(product(),[f]),{kind:'impact',from:key('facet','a','machine')});
  assert.equal(r.supported,false);
  assert.match(r.message,/owner not declared/);
  assert.match(queryArchitecture(architectureOf(product(),[f]),{kind:'owner',from:key('facet','a','machine')}).message,/owner not declared/);
  const a=architectureOf(product(),[f],{relations:[{from:key('facet','a','machine'),to:key('node','a'),kind:'controls'}]});
  assert.equal(queryArchitecture(a,{kind:'impact',from:key('facet','a','machine')}).association,true);
});
test('compiled facet owner reaches node-type instances and their consumers in impact and plan', () => {
  const facet={id:'policy',kind:'machine',compiled:{id:'policy',ownerNodeTypeRef:'service',cells:[]}};
  const architecture=architectureOf(product(),[facet]);
  const facetKey=key('facet','policy','machine'), typeKey=key('node-type','service');
  assert(architecture.edges.some(e=>e.from===facetKey&&e.to===typeKey&&e.kind==='owner'&&e.evidence==='compiler'));
  const result=queryArchitecture(architecture,{kind:'impact',from:facetKey});
  assert(result.keys.includes(key('node','a')));
  assert(result.keys.includes(key('node','c')));
  assert(result.keys.includes(key('component','view')));
  assert(queryArchitecture(architecture,{kind:'owner',from:facetKey}).keys.includes(typeKey));
  const view={productId:'example.system',architecture,documentation:{reports:[]},sourceIndex:{origins:[]}};
  const plan=planForChanges(view,{sources:[],config:{root:process.cwd()}},[facetKey]).markdown;
  assert.match(plan,/Owners: .*node::a/);
  assert.match(plan,/Consumers: .*component::view/);
  assert.match(plan,/Facets: .*owner node-type::service/);
  assert.doesNotMatch(plan,/owner not declared/);
  assert.match(planForChanges(view,{sources:[],config:{root:process.cwd()}},[typeKey]).markdown,/facet:machine:policy \(owner node-type::service\)/);
});
test('bundle identities are deterministic and tampered model cannot load', () => {
  const a=bundle(),b=bundle();assert.equal(a.bundleDigest,b.bundleDigest);
  a.product.id='changed';assert.throws(()=>validateInspectionBundle(a),/identities differ/);
  const c=bundle();c.product.nodes[0].id='changed';assert.throws(()=>validateInspectionBundle(c),/identity does not match/);
});
test('unknown evaluator version preserves inspection but blocks simulation', () => {
  const a=bundle(); assert.equal(compatibilityReport(a,'0.3.65').simulate,true);
  const other=compatibilityReport(a,'0.3.66');assert.equal(other.inspect,true);assert.equal(other.simulate,false);
});
test('inspection is serializable data, not source callbacks or executable plugins', () => {
  assert.throws(()=>createInspectionBundle({productId:'x',compiler:{name:'@v1d/product-spec',version:'0.3.65'},facets:[{id:'t',kind:'decision-table',compiled:{id:'t',when:()=>true}}]}),/serializable data/);
});
test('provenance must have exact source identity; ambiguous locations refuse', () => {
  const text='const x = 1;',source={file:'src/x.ts',digest:digest(text)};
  const origin={entityKey:key('node','a'),file:source.file,sourceDigest:source.digest,span:{start:0,end:8},editing:'inspect'};
  const b=createInspectionBundle({productId:'x',compiler:{name:'@v1d/product-spec',version:'0.3.65'},sources:[source],origins:[origin]});
  assert.equal(checkSourceIdentity(b,[{path:source.file,text}]).kind,'matched');
  assert.equal(checkSourceIdentity(b,[{path:source.file,text:text+'\n'}]).kind,'stale');
  assert.equal(checkSourceIdentity(b,[]).kind,'unavailable');
  assert.throws(()=>createInspectionBundle({...b,origins:[origin,origin]}),/Ambiguous/);
});
test('query results do not mutate source graph',()=>{const a=graph(),before=JSON.stringify(a);queryArchitecture(a,{kind:'impact',from:key('node','a')});architectureSlice(a,{mode:'domains'});assert.equal(JSON.stringify(a),before);});

test('a path to a specific input does not end at another port of that owner',()=>{
  const p=product();p.portRegistry.componentPorts.push({ref:'view.other',ownerId:'view',purpose:'data'});
  const a=architectureOf(p);
  const r=queryArchitecture(a,{kind:'path',from:key('node','a'),to:key('port','view.other')});
  assert.equal(r.found,false);
});


test('grouped query view does not reintroduce excluded edge purposes', () => {
  const p = product(); p.portRegistry.bindings.push({ from: 'a.in', to: 'b.in', purpose: 'context' });
  const a = architectureOf(p, [], { groups: [
    { id: 'first', label: 'First', members: [key('node', 'a')] },
    { id: 'second', label: 'Second', members: [key('node', 'b')] },
  ] });
  const result = queryArchitecture(a, { kind: 'path', from: key('node', 'a'), to: key('node', 'b'), purposes: ['data'] });
  const grouped = architectureSlice(a, { mode: 'domains', result });
  assert.equal(grouped.edges.length, 1); assert.equal(grouped.edges[0].purpose, 'data');
});
