import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { Workbench } from '../lib/workspaces.mjs';
import { createServer } from '../server.mjs';
import { openHeadlessStudio, SemanticStudio } from '../lib/semantic.mjs';
import { documentationFixture } from './documentation-fixture.mjs';
async function setup(t,options={}) {
  const fixture=await documentationFixture(options);t.after(fixture.cleanup);
  const app=new Workbench({dataDir:path.join(fixture.root,'data'),evaluateContract:options.evaluateContract});
  await app.initialize([fixture.root],{includeFixtures:false});
  const p=app.require(app.list()[0].key),view=app.view(p),ctx={project:view.key,bundleDigest:view.bundleDigest};
  return {...fixture,app,p,view,ctx};
}
test('Given a real bundle transport When loading Then type intent has exact provenance and no source executes',async t=>{
  const {view}=await setup(t);
  assert.equal(view.documentation.contracts[0].correlation,'matched-source');
  assert.equal(view.documentation.contracts[0].contract.status,'present');
  assert.equal(view.documentation.legacy.length,1);assert.equal(view.facets.length,1);
  assert.equal(view.documentation.reports[0].tests[0].associationStatus,'source-reference-only');
  assert.equal(view.documentation.reports[0].tests[1].status,'skipped');
});
test('Given a documentation summary When transporting Then prose and report bodies stay demand-loaded',async t=>{
  const {app,p}=await setup(t),summary=app.summary(p),text=JSON.stringify(summary);
  assert.equal(summary.documentation.contracts,1);
  assert(!text.includes('the input is delivered once'));
  assert(!text.includes('Keeps input acquisition outside transforms'));
  assert(summary.sources.every(s=>s.text===undefined));
});
test('Given a selected node When inspecting Then its type intent and actual declared consumer are returned',async t=>{
  const {app,ctx}=await setup(t),r=app.entityDetails({...ctx,entity:'node::ingest.reader'});
  assert.equal(r.entity.intent.typeKey,'node-type::example.reader');
  assert.equal(r.entity.intent.declared.consumers[0].id,'processing.transform');
  assert.equal(r.entity.intent.tests[0].association,'source-reference');
  const q=app.query({...ctx});assert.equal(q.canvas.nodes.find(n=>n.id==='node::ingest.reader').description,'Routes recorded input to the processing boundary.');
});
test('Given the semantic CLI When inspecting Then it exposes the same type-owned intent as the GUI',async t=>{
  const {root}=await setup(t),session=await openHeadlessStudio({roots:[root]});
  const service=new SemanticStudio(session.workbench,session.projects[0].key);
  const r=await service.execute('inspect',{entity:'node::ingest.reader'});
  assert.equal(r.result.intent.typeKey,'node-type::example.reader');
});
test('Given missing intent When opening Studio Then Problems reports it but finite computation remains available',async t=>{
  const {app,ctx,view}=await setup(t,{missing:true});
  assert(view.problems.some(d=>d.rule==='contract.missing'));
  assert(!view.diagnostics.some(d=>d.rule==='contract.missing'));
  assert.equal(app.evaluate({...ctx,facetId:'processing.admission',facts:{input:'READY',permission:'ALLOWED'}}).values.action,'PROCESS');
});
test('Given caller-owned grammar warnings When loading Then the exact AMUX finding is retained without altering semantics',async t=>{
  let called=0;
  const {view}=await setup(t,{evaluateContract:()=>{called++;return [{code:'CONTRACT_FIXTURE',msg:'Caller wording finding',sev:'warn'}];}});
  assert(called>0);assert(view.problems.some(d=>d.rule==='CONTRACT_FIXTURE'));
  assert.equal(view.documentation.contracts[0].contract.status,'invalid');assert.equal(view.facets[0].runnable,true);
});
test('Given changed source When reloading Then old-model prose cannot become a graph caption',async t=>{
  const {app,root,view}=await setup(t);
  const file=path.join(root,'src/reader.ts');await writeFile(file,(await readFile(file,'utf8')).replace('Routes recorded input','Routes new input'));
  const next=await app.refresh(view.key);
  assert.equal(next.documentation.contracts[0].correlation,'source-only');assert.equal(next.modelDigest,view.modelDigest);
  assert.notEqual(next.canvas.nodes.find(n=>n.id==='node::ingest.reader').description,'Routes new input to the processing boundary.');
});
test('Given an invalid optional BDD report When reloading Then it is visible without becoming a compiler failure',async t=>{
  const {app,root,view}=await setup(t);await writeFile(path.join(root,'test-results/bdd-run.json'),' {"schemaVersion":"future"}');
  const next=await app.refresh(view.key);assert.equal(next.documentation.reports[0].status,'invalid');
  assert(next.problems.some(d=>d.rule==='evidence.report'));assert.equal(next.modelDigest,view.modelDigest);assert.equal(next.facets[0].runnable,true);
});
test('Given page arguments or a stale view When querying documentation Then unsafe or stale requests refuse',async t=>{
  const {app,ctx}=await setup(t);
  assert.throws(()=>app.documentation({...ctx,section:'commands'}));
  assert.throws(()=>app.documentation({...ctx,limit:201}));
  assert.throws(()=>app.documentation({...ctx,bundleDigest:'0'.repeat(64)}));
  const page=app.documentation({...ctx,section:'reports',limit:1});assert.equal(page.rows.length,1);assert.equal(page.nextOffset,1);assert.equal(page.total,2);
});
test('Given HTTP documentation routes When reading Then token and exact revision remain required',async t=>{
  const fixture=await documentationFixture();t.after(fixture.cleanup);
  const server=await createServer({roots:[fixture.root],port:0,dataDir:path.join(fixture.root,'data')});
  t.after(()=>{server.server.closeAllConnections();server.server.close();});
  const view=server.app.view(server.app.require(server.app.list()[0].key));
  const request=(token,body)=>fetch(server.origin+'/api/documentation',{method:'POST',headers:{'Content-Type':'application/json',...(token?{'x-studio-token':token}:{})},body:JSON.stringify(body)});
  const ctx={project:view.key,bundleDigest:view.bundleDigest,section:'contracts'};
  assert.equal((await request(null,ctx)).status,403);
  assert.equal((await request(server.token,{...ctx,bundleDigest:'0'.repeat(64)})).status,409);
  const response=await request(server.token,ctx);assert.equal(response.status,200);assert.equal((await response.json()).rows[0].id,'example.reader');
  const module=await fetch(server.origin+'/documentation.js');assert.equal(module.status,200);assert.match(module.headers.get('content-security-policy'),/script-src 'self'/);
});
