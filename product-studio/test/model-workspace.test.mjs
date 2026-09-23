import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { decodeArtifact, graphOf, attachSnapshot } from '../lib/model.mjs';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { Workbench } from '../lib/workspaces.mjs';
import { createTraceRecorder } from '../lib/trace.mjs';
import { digest, boundedJson, safeFile, unifiedPatch } from '../lib/util.mjs';
const machine = await readFile(new URL('../fixtures/workflow.ts', import.meta.url), 'utf8');
export const product = () => ({ kind: 'product-spec-ir', schemaVersion: 9, id: 'fifth-product', nodes: [{id:'sensor',nodeTypeRef:'sensor-type'}], components: [{id:'view',componentTypeRef:'view-type'}], nodeTypes: [{id:'sensor-type',kind:'service'}], componentTypes: [{id:'view-type'}], artifacts: [], portRegistry: {nodePorts:[{ref:'sensor.out',ownerId:'sensor',contract:'sample'}],componentPorts:[{ref:'view.in',ownerId:'view',contract:'sample'}],bindings:[{from:'sensor.out',to:'view.in',purpose:'data'}]}, showcase: {cases:[{id:'real.case',title:'A case',scenarios:[]}]}});
async function temporary(t) { const root = await mkdtemp(path.join(os.tmpdir(),'studio-test-')); t.after(()=>rm(root,{recursive:true,force:true})); return root; }
test('fifth product works without product-specific view logic and preserves extensions',()=>{ const p=product(); const d=decodeArtifact(JSON.stringify(p)); assert.deepEqual(d.product.showcase,p.showcase); const g=graphOf(d.product); assert.equal(g.nodes.length,2); assert.equal(g.edges[0].source,'sensor'); assert.equal(g.edges[0].target,'view'); });
test('ProductIr machines merge by exact ID with exported facets and refuse conflicting definitions',()=>{
  const p=product(),machine={id:'fixture.machine',ownerNodeTypeRef:'sensor-type',states:['IDLE'],initial:'IDLE',inputs:['GO'],guards:[],cells:[]};
  const table={id:'fixture.table',ownerNodeTypeRef:'sensor-type',axes:{ready:['YES']},columns:{action:['GO']},cells:[]};
  p.machines=[machine];p.decisionTables=[table];p.productSpecVersion='0.3.66';
  const standalone=decodeArtifact(JSON.stringify(p));
  assert.equal(standalone.facets.find(f=>f.id===machine.id)?.compiled.ownerNodeTypeRef,'sensor-type');
  assert.equal(standalone.facets.find(f=>f.id===table.id)?.compiled.ownerNodeTypeRef,'sensor-type');
  const bundle=createInspectionBundle({productId:p.id,compiler:{name:'@v1d/product-spec',version:'0.3.66'},product:p,
    facets:[{kind:'machine',id:machine.id,compiled:machine}]});
  assert.equal(decodeArtifact(JSON.stringify(bundle)).facets.filter(f=>f.id===machine.id).length,1);
  const conflicting=createInspectionBundle({productId:p.id,compiler:{name:'@v1d/product-spec',version:'0.3.66'},product:p,
    facets:[{kind:'machine',id:machine.id,compiled:{...machine,ownerNodeTypeRef:'other-type'}}]});
  assert.throws(()=>decodeArtifact(JSON.stringify(conflicting)),/Conflicting exported definitions/);
});
test('unknown schema fails, never partial green',()=>{ const p=product(); p.schemaVersion=42; assert.throws(()=>decodeArtifact(JSON.stringify(p)),/schema 9/); });
test('duplicate owner and missing port are rejected',()=>{ const p=product(); p.nodes.push({...p.nodes[0]}); assert.throws(()=>decodeArtifact(JSON.stringify(p)),/Duplicate/); const q=product();q.portRegistry.bindings[0].to='absent';assert.throws(()=>decodeArtifact(JSON.stringify(q)),/undeclared port/); });
test('unsafe JSON keys and excessive nesting are refused',()=>{ assert.throws(()=>boundedJson('{"__proto__":1}'),/Reserved/); assert.throws(()=>boundedJson('['.repeat(60)+'0'+']'.repeat(60)),/deeply/); });
test('snapshot requires exact product AND graph identity',()=>{ const p=product(),text=JSON.stringify(p), graph='graph LR'; const snapshot={dumpSchemaVersion:1,productId:p.id,schemaVersion:9,productSha256:digest(text),graphSha256:digest(graph),takenAtMs:100,activeNodes:['sensor'],ports:[{port:'sensor.out',count:1,lastAtMs:90}]}; const e=attachSnapshot(p,digest(text),digest(graph),JSON.stringify(snapshot)); assert.equal(e.kind,'recorded-snapshot'); assert.match(e.notice,/does not contain an event timeline/); assert.throws(()=>attachSnapshot(p,'different',digest(graph),JSON.stringify(snapshot)),/does not match/); });
test('unknown active node and repeated snapshot port are refused',()=>{ const p=product(), d='exact';const s={dumpSchemaVersion:1,productId:p.id,schemaVersion:9,productSha256:d,graphSha256:d,takenAtMs:100,activeNodes:['invented'],ports:[]};assert.throws(()=>attachSnapshot(p,d,d,JSON.stringify(s)),/active node/i);s.activeNodes=['sensor'];s.ports=[{port:'sensor.out',count:1,lastAtMs:90},{port:'sensor.out',count:1,lastAtMs:90}];assert.throws(()=>attachSnapshot(p,d,d,JSON.stringify(s)),/duplicate/i); });
test('workspace rejects traversal and symlink escape',async t=>{ const root=await temporary(t),inside=path.join(root,'inside');await mkdir(inside);await writeFile(path.join(root,'secret.txt'),'secret');await symlink(path.join(root,'secret.txt'),path.join(inside,'linked.ts'));await assert.rejects(safeFile(inside,'../secret.txt'),/relative/);await assert.rejects(safeFile(inside,'linked.ts'),/outside/); });
test('workspace loads only a matching product-owned test trace from traceFile',async t=>{
  const root=await temporary(t);
  const artifactText=JSON.stringify(product());
  await writeFile(path.join(root,'product.json'),artifactText);
  await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:2,projects:[{
    id:'fifth-product',label:'Fifth product',sources:[],artifact:'product.json',traceFile:'trace.json',
  }]}));
  const first=new Workbench({dataDir:path.join(root,'data')});
  await first.initialize([root],{includeFixtures:false});
  const source=first.view(first.require(first.list()[0].key));
  const owner=source.architecture.entities.find(e=>e.kind==='node');
  assert(owner,'Expected a real compiled owner to trace.');
  const recorder=createTraceRecorder({productId:source.productId,artifactSha256:digest(artifactText),
    sessionId:'test:owner',clock:'monotonic',provenance:'test-run'});
  recorder.record({atMs:1,kind:'message',entityKey:owner.key,summary:'Owner exercised by test'});
  await writeFile(path.join(root,'trace.json'),JSON.stringify(recorder.snapshot()));
  const second=new Workbench({dataDir:path.join(root,'data')});
  await second.initialize([root],{includeFixtures:false});
  const loaded=second.view(second.require(second.list()[0].key));
  assert.equal(loaded.trace?.provenance,'test-run');
  assert.equal(loaded.trace.events[0].entityKey,owner.key);
  await writeFile(path.join(root,'trace.json'),JSON.stringify({kind:'product-studio-trace',version:1,
    artifactSha256:digest(artifactText),events:[{kind:'message',entityKey:owner.key,summary:'Owner exercised by test'}]}));
  const compact=new Workbench({dataDir:path.join(root,'data')});
  await compact.initialize([root],{includeFixtures:false});
  const compactTrace=compact.view(compact.require(compact.list()[0].key)).trace;
  assert.equal(compactTrace.sessionId,'trace.json');
  assert.equal(compactTrace.events[0].sequence,0);
  assert.equal(compactTrace.provenance,'test-run');
  const wrong={...recorder.snapshot(),artifactSha256:'b'.repeat(64)};
  await writeFile(path.join(root,'trace.json'),JSON.stringify(wrong));
  const third=new Workbench({dataDir:path.join(root,'data')});
  await third.initialize([root],{includeFixtures:false});
  const rejected=third.view(third.require(third.list()[0].key));
  assert.equal(rejected.trace,null);
  assert(rejected.problems.some(problem=>problem.rule==='trace.identity'));
});
test('draft validation and local persistence do not modify repository source',async t=>{ const root=await temporary(t);await writeFile(path.join(root,'machine.ts'),machine);await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:1,projects:[{id:'my-app',label:'My app',sources:['machine.ts']}]}));const app=new Workbench({dataDir:path.join(root,'data')});await app.initialize([root]);const view=app.view(app.require(app.list().find(p=>p.label==='My app').key));const d=await app.propose({project:view.key,facetId:'example.request',bundleDigest:view.bundleDigest,cellId:'reply-failure',field:'to',value:'SUCCESS'});assert.equal(d.valid,true);const saved=await app.saveDraft(d.id);assert.equal(saved.persistence,'studio-local-only');assert.equal(await readFile(path.join(root,'machine.ts'),'utf8'),machine);assert.equal((await app.savedDraft(d.id)).text,d.text);assert.equal((await app.saveDraft(d.id)).id,saved.id); });
test('source conflict after inspection refuses editing',async t=>{ const root=await temporary(t);await writeFile(path.join(root,'machine.ts'),machine);await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:1,projects:[{id:'test',label:'Conflict',sources:['machine.ts']}]}));const app=new Workbench({dataDir:path.join(root,'data')});await app.initialize([root]);const v=app.view(app.require(app.list().find(p=>p.label==='Conflict').key));await writeFile(path.join(root,'machine.ts'),machine+'\n// concurrent edit');await assert.rejects(app.propose({project:v.key,facetId:'example.request',bundleDigest:v.bundleDigest,text:machine}),/Source changed on disk/); });
test('imported source and artifact do not become real workspace writes',async t=>{ const root=await temporary(t),app=new Workbench({dataDir:root});const a=await app.importSource({text:machine});assert.equal(a.originKind,'source-draft');assert.equal(a.capabilities.liveExecution,false);const b=await app.importArtifact({text:JSON.stringify(product())});assert.equal(b.originKind,'imported-artifact');assert.equal(b.capabilities.documentWrites,false); });
test('patch preserves no-final-newline information',()=>{const patch=unifiedPatch('logic.ts','before','after');assert.equal(patch.match(/No newline at end of file/g).length,2);assert.equal(unifiedPatch('logic.ts','same','same'),'');});
test('an invalid imported source can be corrected, not trapped in read-only mode',async t=>{
 const app=new Workbench({dataDir:await temporary(t)});
 const v=await app.importSource({text:'export const broken = {',file:'broken.ts'});
 assert.equal(v.facets.length,0);
 const d=await app.propose({project:v.key,bundleDigest:v.bundleDigest,file:'broken.ts',text:machine});
 assert.equal(d.valid,true);assert.ok(d.facets.length);assert.equal(d.before,'export const broken = {');
});
test('a corrupted saved draft cannot be reported as a successful idempotent save',async t=>{
 const root=await temporary(t),app=new Workbench({dataDir:root});
 const v=await app.importSource({text:machine,file:'workflow.ts'});
 const d=await app.propose({project:v.key,facetId:'example.request',bundleDigest:v.bundleDigest,cellId:'reply-failure',field:'to',value:'SUCCESS'});
 await app.saveDraft(d.id);await writeFile(path.join(root,'drafts',d.id+'.json'),'{"version":1,"text":"wrong"}');
 await assert.rejects(app.saveDraft(d.id),/conflict|different/i);
});
