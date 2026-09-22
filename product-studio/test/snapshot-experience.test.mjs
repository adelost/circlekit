import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Workbench } from '../lib/workspaces.mjs';
import { freezeData, compareSnapshots } from '../lib/snapshot.mjs';
import { ChangeMonitor } from '../lib/changes.mjs';
import { digest } from '../lib/util.mjs';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { KERNEL_VERSION } from '../lib/kernel.mjs';
import { parseRoute, hasDrafts } from '../public/experience.js';

async function temp(t) {const root=await mkdtemp(path.join(os.tmpdir(),'studio-experience-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
const workflow=await readFile(new URL('../fixtures/workflow.ts',import.meta.url),'utf8');
async function sourceApp(t) {const root=await temp(t),app=new Workbench({dataDir:path.join(root,'drafts')});const v=await app.importSource({text:workflow,file:'workflow.ts'});return {root,app,v,p:app.require(v.key)};}
const context=v=>({project:v.key,bundleDigest:v.bundleDigest});

test('repeated views and semantic reads reuse one frozen snapshot',async t=>{
 const {app,p,v}=await sourceApp(t),count=app.metrics.snapshotBuilds;
 assert.strictEqual(app.view(p),app.view(p));app.checkedView(context(v));app.getFacet(v.key,'example.request',v.bundleDigest);
 assert.equal(app.metrics.snapshotBuilds,count);assert.ok(Object.isFrozen(v.architecture.entities));
 assert.throws(()=>{v.facets[0].compiled.initial='MUTATED';},TypeError);
});
test('transport summary excludes full source text, entity details and raw event arrays',async t=>{
 const {app,p,v}=await sourceApp(t),summary=app.summary(p);
 assert.equal(summary.sources[0].text,undefined);assert.equal(summary.architecture.entities[0].data,undefined);
 assert.equal(app.sourceText({...context(v),file:'workflow.ts',sourceDigest:v.sources[0].digest}).text,workflow);
 assert.throws(()=>app.sourceText({...context(v),file:'../../private'}),/attached/);
});
test('exact lazy source and entity calls refuse a different model view',async t=>{
 const {app,v}=await sourceApp(t);
 assert.throws(()=>app.sourceText({project:v.key,bundleDigest:'stale',file:'workflow.ts'}),/Reload/);
 assert.throws(()=>app.entityDetails({...context(v),entity:'node::invented'}),/not in/);
});
test('trace overlays reuse the model snapshot and pages keep absolute cursor positions',async t=>{
 const {app,p,v}=await sourceApp(t),before=app.metrics.snapshotBuilds;
 const events=Array.from({length:205},(_,i)=>({sequence:i,atMs:i,kind:'annotation',entityKey:v.architecture.entities[0].key,summary:'test',...(i?{causedBy:i-1}:{})}));
 const capture={kind:'product-studio-trace',version:1,productId:v.productId,modelDigest:v.modelDigest,sessionId:'test',clock:{domain:'virtual',unit:'ms'},provenance:'synthetic',truncation:{droppedBefore:0,gaps:[]},events};
 app.importTrace({...context(v),text:JSON.stringify(capture)});
 const page=app.tracePage({...context(v),traceDigest:app.view(p).trace.traceDigest,offset:200,limit:5,filter:{cursor:204}});
 assert.equal(page.events.length,5);assert.equal(page.events[0].eventIndex,200);assert.equal(page.causalPath[0].eventIndex,0);
 assert.equal(page.total,205);assert.equal(app.metrics.snapshotBuilds,before);assert.equal(app.summary(p).trace.events,undefined);
 assert.throws(()=>app.tracePage({...context(v),traceDigest:'wrong'}),/Trace changed/);
});
test('search index finds source and semantic identifiers without source text in rows',async t=>{
 const {app,v}=await sourceApp(t);const r=app.search({...context(v),text:'request',max:20});
 assert.ok(r.rows.length);assert.ok(r.rows.every(row=>!Object.hasOwn(row,'text')));
});
test('declared-model compare uses identities, not order or runtime claims',()=>{
 const v={productId:'p',modelDigest:'a',bundleDigest:'a',sources:[],compatibility:null,architecture:{entities:[{key:'node::a',kind:'node',data:{id:'a'}},{key:'node::b',kind:'node',data:{id:'b'}}],edges:[],groups:[]}};
 const reordered=structuredClone(v);reordered.architecture.entities.reverse();
 assert.deepEqual(compareSnapshots(v,reordered).counts,{added:0,removed:0,changed:0});
 reordered.architecture.entities[0].data.value=2;assert.equal(compareSnapshots(v,reordered).counts.changed,1);
 assert.throws(()=>compareSnapshots(v,{...v,productId:'other'}),/same declared product/);
});
test('pure data freezing preserves shared references while rejecting mutation',()=>{
 const shared={value:1},a=freezeData({a:shared,b:shared});assert.strictEqual(a.a,a.b);assert.throws(()=>{a.a.value=2;},TypeError);
});
test('passive changes require two stable scans and never run a generator',async t=>{
 const root=await temp(t);await mkdir(path.join(root,'generated'));const file='generated/app.studio.json';await writeFile(path.join(root,file),'old');
 const p={config:{root,bundle:file,sources:[]},readSet:[{file,digest:digest('old')}]},monitor=new ChangeMonitor({intervalMs:0});
 assert.equal((await monitor.inspect(p)).status,'current');await writeFile(path.join(root,file),'new contents');
 assert.equal((await monitor.inspect(p)).ready,false);const second=await monitor.inspect(p);assert.equal(second.ready,true);assert.equal(second.changed[0].file,file);
 assert.equal(await readFile(path.join(root,file),'utf8'),'new contents');
});
test('a newly created workspace manifest requires a restart, not guessed configuration',async t=>{
 const root=await temp(t),p={config:{root,sources:[]},readSet:[]},monitor=new ChangeMonitor({intervalMs:0});
 await monitor.inspect(p);await writeFile(path.join(root,'studio.workspace.json'),'{}');
 const result=await monitor.inspect(p);assert.equal(result.requiresRestart,true);assert.equal(result.ready,false);
});
test('an invalid regenerated bundle retains the original project',async t=>{
 const root=await temp(t),app=new Workbench({dataDir:path.join(root,'drafts')});
 const bundle=createInspectionBundle({productId:'test',compiler:{name:'@v1d/product-spec',version:KERNEL_VERSION}});
 await writeFile(path.join(root,'model.studio.json'),JSON.stringify(bundle));
 await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:2,projects:[{id:'p',label:'P',bundle:'model.studio.json'}]}));
 await app.initialize([root],{includeFixtures:false});const p=app.require(app.list()[0].key);
 await writeFile(path.join(root,'model.studio.json'),'{');
 await assert.rejects(app.refresh(p.key),/previous snapshot/);assert.strictEqual(app.require(p.key),p);
});
test('route decoder accepts only its own version and bounded semantic identity',()=>{
 const route={version:1,project:'local',model:'a'.repeat(64),view:'Logic',facet:'example.request'};
 assert.equal(parseRoute('#view='+encodeURIComponent(JSON.stringify(route))).facet,'example.request');
 assert.equal(parseRoute('#view='+encodeURIComponent(JSON.stringify({...route,version:2}))),null);
 assert.equal(parseRoute('#view='+encodeURIComponent(JSON.stringify({...route,view:'RunShell'}))),null);
});
test('saved but unapplied source drafts still protect against automatic reload',()=>{
 const state={loadedSources:[{path:'file.ts',text:'old'}],documents:new Map([['file.ts',{dirty:false,text:'new'}]])};
 assert.equal(hasDrafts(state),true);state.documents.get('file.ts').text='old';assert.equal(hasDrafts(state),false);
 state.scenarioDirty=true;assert.equal(hasDrafts(state),true);
 state.scenarioDirty=false;state.facetId='current';state.perFacet=new Map([['other',{scenarioDirty:true}]]);assert.equal(hasDrafts(state),true);
 state.facetId='other';assert.equal(hasDrafts(state),false); // The current live state supersedes its saved navigation cache.
});
