import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { kernel, KERNEL_VERSION } from '../lib/kernel.mjs';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { entityKey } from '../lib/architecture.mjs';
import { Workbench } from '../lib/workspaces.mjs';
import { digest } from '../lib/util.mjs';
const exec=promisify(execFile);
const table=()=>kernel.defineDecisionTable({id:'other.policy',axes:{allowed:['YES','NO']},columns:{action:kernel.choice(['RUN','HOLD'])},cells:[kernel.on('allow',{allowed:'YES'},{action:'RUN'}),kernel.on('deny',{allowed:'NO'},{action:'HOLD'})]});
const temp=async t=>{const root=await mkdtemp(path.join(os.tmpdir(),'studio-bundle-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;};
async function setup(t,{source='export const marker = { id: "other.policy" };',version=KERNEL_VERSION}={}){
 const root=await temp(t);await mkdir(path.join(root,'generated'));
 const bundle=createInspectionBundle({productId:'other',compiler:{name:'@v1d/product-spec',version},sources:[{file:'logic.mjs',digest:digest(source)}],facets:[{id:'other.policy',kind:'decision-table',compiled:table()}]});
 await writeFile(path.join(root,'logic.mjs'),source);
 await writeFile(path.join(root,'generated/other.studio.json'),JSON.stringify(bundle));
 await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:2,projects:[{id:'other',label:'Other product',bundle:'generated/other.studio.json'}]}));
 const app=new Workbench({dataDir:path.join(root,'local-data')});await app.initialize([root]);
 const view=app.view(app.require(app.list().find(p=>p.label==='Other product').key));return{root,app,view,bundle};
}
test('one bundle attaches another app, its sources and logic without a product-specific parser',async t=>{
 const {view}=await setup(t,{source:'throw new Error("must not execute"); export const marker = {id:"other.policy"};'});
 assert.equal(view.facets.length,1);assert.equal(view.sources.length,1);assert.equal(view.sourceIdentity.kind,'matched');
 assert.equal(view.sources[0].valid,false);assert.equal(view.facets[0].runnable,true);assert.equal(view.diagnostics.length,0);
});
test('different producer version permits inspection, never silent evaluator substitution',async t=>{
 const{app,view}=await setup(t,{version:'9.9.9'});assert.equal(view.compatibility.simulate,false);
 assert.throws(()=>app.evaluate({project:view.key,facetId:'other.policy',bundleDigest:view.bundleDigest,facts:{allowed:'YES'}}),/compiled with/);
});
test('changed exported source is flagged, while the saved model remains inspectable',async t=>{
 const{app,root,view}=await setup(t);await writeFile(path.join(root,'logic.mjs'),'// changed source');
 const next=await app.refresh(view.key);assert.equal(next.sourceIdentity.kind,'stale');assert.equal(next.modelDigest,view.modelDigest);
 assert.equal(next.sourceIndex.origins.length,0);
});
test('standalone source with a known different consumer pin is also blocked for simulation',async t=>{
 const root=await temp(t),text=await readFile(new URL('../fixtures/amux.mjs',import.meta.url),'utf8');
 await writeFile(path.join(root,'policy.mjs'),text);await writeFile(path.join(root,'package-lock.json'),JSON.stringify({packages:{'node_modules/@v1d/product-spec':{version:'9.0.0'}}}));
 await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:1,projects:[{id:'other',label:'Other',sources:['policy.mjs']}]}));
 const app=new Workbench({dataDir:path.join(root,'data')});await app.initialize([root]);const view=app.view(app.require(app.list().find(p=>p.label==='Other').key));
 assert.equal(view.compatibility.simulate,false);assert.equal(view.facets[0].runnable,false);
});
test('unknown facet is explicitly inspect-only, not dropped or executed',async t=>{
 const root=await temp(t),app=new Workbench({dataDir:root});
 const bundle=createInspectionBundle({productId:'media',compiler:{name:'@v1d/product-spec',version:KERNEL_VERSION},facets:[{kind:'media.recipe.v1',id:'recipe.one',compiled:{id:'recipe.one',fps:30}}]});
 const view=await app.importArtifact({text:JSON.stringify(bundle)});assert.equal(view.facets[0].runnable,false);assert.equal(view.architecture.entities[0].kind,'facet');
});
test('traces bind to exact model and named cells, and contradictory evidence stays visible',async t=>{
 const{app,view}=await setup(t);const trace={kind:'product-studio-trace',version:1,productId:view.productId,modelDigest:view.modelDigest,sessionId:'s1',clock:{domain:'monotonic',unit:'ms'},provenance:'recorded',truncation:{droppedBefore:0,gaps:[]},events:[{sequence:0,atMs:1,kind:'decision',entityKey:entityKey('facet','other.policy','decision-table'),logic:{facetId:'other.policy',cellId:'allow',facts:{allowed:'YES'},values:{action:'RUN'}}}]};
 app.importTrace({project:view.key,bundleDigest:view.bundleDigest,text:JSON.stringify(trace)});
 assert.equal(app.traceFrame({project:view.key,bundleDigest:view.bundleDigest,filter:{cursor:0}}).logicCheck.kind,'consistent');
 trace.events[0].logic.values.action='HOLD';app.importTrace({project:view.key,bundleDigest:view.bundleDigest,text:JSON.stringify(trace)});
 const frame=app.traceFrame({project:view.key,bundleDigest:view.bundleDigest,filter:{cursor:0}});assert.equal(frame.logicCheck.kind,'different');assert.equal(frame.current.logic.values.action,'HOLD');
});
test('named scenarios reopen only on the same logical model and declaration',async t=>{
 const{app,view}=await setup(t);const context={project:view.key,bundleDigest:view.bundleDigest,facetId:'other.policy'};
 const r=await app.saveScenario({...context,title:'Allow case',scenario:{id:'allow',facetId:context.facetId,bundleDigest:context.bundleDigest,events:[{atMs:0,facts:{allowed:'YES'},expect:{values:{action:'RUN'}}}]}});
 const open=await app.openScenario({...context,id:r.id});assert.equal(open.scenario.events.length,1);
 await assert.rejects(app.openScenario({...context,facetId:'wrong',id:r.id}),/different model or declaration/);
});
test('CLI accepts generic repository argument and doctor reports bundle/source identity',async t=>{
 const{root}=await setup(t);const cli=new URL('../bin/studio.mjs',import.meta.url).pathname;
 const result=await exec(process.execPath,[cli,'doctor',root]);const report=JSON.parse(result.stdout);assert.equal(report.projects[0].product,'Other product');assert.equal(report.projects[0].sourceIdentity,'matched');
});
test('producer diagnostics stay visible and an error blocks simulated execution',async t=>{
 const root=await temp(t),app=new Workbench({dataDir:root});
 const bundle=createInspectionBundle({productId:'other',compiler:{name:'@v1d/product-spec',version:KERNEL_VERSION},facets:[{kind:'decision-table',id:'other.policy',compiled:table()}],diagnostics:[{severity:'error',rule:'producer.failed',message:'Product validation was incomplete.'}]});
 const view=await app.importArtifact({text:JSON.stringify(bundle)});
 assert.ok(view.diagnostics.some(d=>d.rule==='producer.failed'));
 assert.equal(view.capabilities.simulate,false);
 assert.throws(()=>app.evaluate({project:view.key,facetId:'other.policy',bundleDigest:view.bundleDigest,facts:{allowed:'YES'}}),/producer/i);
});
test('a saved compatible model may simulate while source editing refuses a changed consumer pin',async t=>{
 const source="import {defineDecisionTable,choice,on} from '@v1d/product-spec'; export const policy=defineDecisionTable({id:'other.policy',axes:{allowed:['YES','NO']},columns:{action:choice(['RUN','HOLD'])},cells:[on('allow',{allowed:'YES'},{action:'RUN'}),on('deny',{allowed:'NO'},{action:'HOLD'})]});";
 const{root,app,view}=await setup(t,{source});
 await writeFile(path.join(root,'package-lock.json'),JSON.stringify({packages:{'node_modules/@v1d/product-spec':{version:'9.9.9'}}}));
 const next=await app.refresh(view.key);
 assert.equal(app.evaluate({project:next.key,facetId:'other.policy',bundleDigest:next.bundleDigest,facts:{allowed:'YES'}}).values.action,'RUN');
 const draft=await app.propose({project:next.key,facetId:'other.policy',bundleDigest:next.bundleDigest,text:source});
 assert.equal(draft.valid,false);assert.ok(draft.diagnostics.some(d=>d.rule==='compiler.version'));
});
