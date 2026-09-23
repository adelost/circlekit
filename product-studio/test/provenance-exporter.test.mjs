import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { indexSource, locateEntities, sourceSelection } from '../lib/provenance.mjs';
import { architectureOf, entityKey as key } from '../lib/architecture.mjs';
import { prepareInspection, writeInspectionBundle } from '../lib/exporter.mjs';
import { digest } from '../lib/util.mjs';
import { saveScenarioDocument,readScenarioDocument,listScenarioDocuments } from '../lib/scenario-store.mjs';
const text=`import { defineMachine as machine } from '@v1d/product-spec';\nexport const x=machine({ id:'test.machine',cells:[{id:'go',from:'IDLE',on:'Go',to:'RUNNING'}] });`;
const f={id:'test.machine',kind:'machine',compiled:{id:'test.machine',cells:[{id:'go'}]}};
const a=()=>architectureOf(null,[f]);
const temp=async t=>{const d=await mkdtemp(path.join(os.tmpdir(),'studio-export-'));t.after(()=>rm(d,{force:true,recursive:true}));return d;};

test('source index records exact spans without executing source or importing its module',()=>{const i=indexSource(text,'x.ts');assert.equal(i.candidates.length,2);const go=i.candidates.find(c=>c.id==='go');assert.match(text.slice(go.span.start,go.span.end),/from:'IDLE'/);assert.equal(go.constructor,'defineMachine');});
test('source-to-graph selection chooses the innermost unique mapped cell',()=>{const p=locateEntities(a(),[{path:'x.ts',text}]);const go=p.origins.find(o=>o.entityKey===key('cell','go','machine/test.machine'));assert.ok(go);assert.equal(sourceSelection(p.origins,'x.ts',text.indexOf("from:'IDLE'"))?.entityKey,go.entityKey);});
test('duplicate lexical identities are unresolved, not arbitrarily mapped',()=>{const p=locateEntities(a(),[{path:'a.ts',text},{path:'b.ts',text}]);assert.equal(p.origins.length,0);assert.match(p.unresolved[0].reason,/Several/);});
test('explicit provenance is refused when source content changes',()=>{const p=locateEntities(a(),[{path:'x.ts',text}], [{entityKey:key('facet','test.machine','machine'),file:'x.ts',sourceDigest:digest(text+' '),span:{start:0,end:12},editing:'inspect'}]);assert.equal(p.origins.some(o=>o.entityKey===key('facet','test.machine','machine')),false);});
test('compiler bundle helper packages exact caller output and source positions without evaluation',async t=>{const root=await temp(t);await writeFile(path.join(root,'x.ts'),text);const b=await prepareInspection({root,sourceFiles:['x.ts'],productId:'test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},facets:[f]});assert.deepEqual(b.facets,[f]);assert.equal(b.origins.length,2);assert.equal(b.sources[0].digest,digest(text));});
test('export writes only generated inspection output and preserves source',async t=>{const root=await temp(t);await mkdir(path.join(root,'generated'));await writeFile(path.join(root,'x.ts'),text);const receipt=await writeInspectionBundle({root,output:'generated/test.studio.json',sourceFiles:['x.ts'],productId:'test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},facets:[f]});assert.equal(JSON.parse(await readFile(path.join(root,receipt.output),'utf8')).bundleDigest,receipt.bundleDigest);assert.equal(await readFile(path.join(root,'x.ts'),'utf8'),text);});
test('export refuses an output directory resolving outside its selected root',async t=>{const root=await temp(t),inside=path.join(root,'inside');await mkdir(inside);await symlink(root,path.join(inside,'outside'));await assert.rejects(writeInspectionBundle({root:inside,output:'outside/test.studio.json',productId:'test',compiler:{name:'@v1d/product-spec',version:'0.3.65'}}),/outside/);});
test('scenario documents persist immutably and have independent content identities',async t=>{const root=await temp(t),doc={kind:'product-studio-scenario',version:1,title:'A case',modelDigest:'a'.repeat(64),facetId:'test',scenario:{events:[]}};const a=await saveScenarioDocument(root,doc),b=await saveScenarioDocument(root,doc);assert.equal(a.id,b.id);assert.deepEqual(await readScenarioDocument(root,a.id),doc);assert.equal((await listScenarioDocuments(root)).length,1);});
test('native source is not interpreted as TypeScript; explicit provenance still opens it',()=>{
 const native='val stage = Thing(id: "test.machine")';
 const i=indexSource(native,'Recording.kt');assert.equal(i.candidates.length,0);assert.equal(i.diagnostics[0]?.rule,'source.language');
 const p=locateEntities(a(),[{path:'Recording.kt',text:native}],[{entityKey:key('facet','test.machine','machine'),file:'Recording.kt',sourceDigest:digest(native),span:{start:0,end:native.length},editing:'external'}]);
 assert.equal(p.origins.length,1);assert.equal(p.origins[0].editing,'external');
});
test('concurrent scenario saves publish one complete immutable document',async t=>{
 const root=await temp(t),doc={kind:'product-studio-scenario',version:1,title:'Concurrent case',modelDigest:'a'.repeat(64),facetId:'test',scenario:{events:[]}};
 const results=await Promise.all(Array.from({length:8},()=>saveScenarioDocument(root,doc)));
 assert.equal(new Set(results.map(r=>r.id)).size,1);assert.deepEqual(await readScenarioDocument(root,results[0].id),doc);
});
test('scenario corruption is detected on reopen and cannot be overwritten by a retry',async t=>{
 const root=await temp(t),doc={kind:'product-studio-scenario',version:1,title:'A case',modelDigest:'a'.repeat(64),facetId:'test',scenario:{events:[]}};
 const r=await saveScenarioDocument(root,doc);await writeFile(path.join(root,'scenarios',r.id+'.json'),'{"changed":true}');
 await assert.rejects(readScenarioDocument(root,r.id),/corrupted or has changed/);await assert.rejects(saveScenarioDocument(root,doc),/differs/);
});
