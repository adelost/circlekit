import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../server.mjs';
import { decodeTrace } from '../lib/trace.mjs';
import { main } from '../bin/studio.mjs';

test('A29/A31 freeze keeps one v2 cut and its disagreement while live capture grows', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'studio-freeze-'));
  const running = await createServer({ port:0, dataDir:root, liveEnabled:true });
  t.after(async () => { running.server.closeAllConnections(); await new Promise(resolve=>running.server.close(resolve)); await rm(root,{recursive:true,force:true}); });
  const project=running.app.list().find(item=>item.id==='workflow-example');
  const view=running.app.view(running.app.require(project.key));
  const facet=view.facets.find(item=>item.kind==='machine');
  const cell=facet.compiled.cells[0];
  const {ticket}=running.live.issueTicket({project:project.key,producer:'node'});
  const session=running.live.hello({type:'hello',protocol:1,ticket,productId:view.productId,
    identity:{modelDigest:view.modelDigest},productSpecVersion:view.toolVersions.productSpec,captureId:'freeze-example',
    scope:{events:['transition'],facets:[facet.id],appliedTransitions:true}},{},null).session;
  const different=facet.compiled.states.find(state=>state!==cell.to);
  running.live.batch(session,{type:'batch',through:0,dropped:[],events:[{sequence:0,atMs:1,kind:'transition',phase:'evaluated',
    facetId:facet.id,cellId:cell.id,from:cell.from,to:different,input:cell.on,guards:{},instanceId:'one'}]});
  const frozen=running.live.freeze(project.key,'freeze-example',view);
  running.live.batch(session,{type:'batch',through:1,dropped:[{from:1,to:1,reason:'fixture-loss'}],events:[]});
  const selected=running.live.selectedSnapshot(project.key,frozen.id,view);
  assert.equal(selected.capture.through,0);
  assert.equal(selected.events.length,1);
  assert.equal(selected.events[0].phase,'evaluated');
  assert.equal(running.app.convergenceForTrace(running.app.require(project.key),selected).verdict,'Diverged');
  assert.equal(running.live.selectedSnapshot(project.key,'freeze-example',view).capture.through,1);
  assert.equal(running.app.convergenceForTrace(running.app.require(project.key),selected).verdict,
    running.app.convergenceForTrace(running.app.require(project.key),decodeTrace(JSON.stringify(frozen.trace),view)).verdict);
  const invoke=async args=>{let output='';const code=await main(args,{cwd:root,stdout:{write:value=>{output+=value;}}});return {code,body:JSON.parse(output)};};
  const read=await invoke(['live','--json','--data-dir',root,'--session',frozen.id,'--max','1']);
  assert.equal(read.code,0,JSON.stringify(read.body));
  assert.equal(read.body.through,0);
  assert.equal(read.body.events[0].phase,'evaluated');
  assert.equal(read.body.cut,selected.traceDigest);
  const receipt=JSON.parse(await readFile(path.join(root,'live-discovery',(await readdir(path.join(root,'live-discovery')))[0]),'utf8'));
  assert.equal((await fetch(running.origin+'/api/live-ticket',{method:'POST',headers:{'x-studio-token':receipt.readToken,
    'content-type':'application/json'},body:JSON.stringify({project:project.key,producer:'node'})})).status,403);
  assert.equal((await fetch(running.origin+'/api/live-read',{headers:{'x-studio-read-token':running.token}})).status,403);
  const expired=await invoke(['live','--json','--data-dir',root,'--session','freeze-example','--cut',selected.traceDigest]);
  assert.equal(expired.body.error.code,'live.cursor-expired');
  const output='saved.studio-trace.json';
  const saved=await invoke(['live','--data-dir',root,'--session',frozen.id,'--freeze','--output',output]);
  assert.equal(saved.code,0,JSON.stringify(saved.body));
  const reopened=decodeTrace(await readFile(path.join(root,output),'utf8'),view);
  assert.equal(reopened.traceDigest,selected.traceDigest);
  assert.equal(reopened.events[0].phase,selected.events[0].phase);
  assert.equal(reopened.capture.through,selected.capture.through);
  running.app.importTrace({project:project.key,bundleDigest:view.bundleDigest,text:await readFile(path.join(root,output),'utf8'),fileName:output});
  assert.equal(running.app.convergence(running.app.require(project.key)).verdict,'Diverged');
});

test('A39 read-only live CLI reports unavailable without starting Studio', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-no-live-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  let output='';
  const code=await main(['live','--json','--data-dir',root],{cwd:root,stdout:{write:value=>{output+=value;}}});
  assert.equal(code,1);
  assert.equal(JSON.parse(output).error.code,'live.unavailable');
});

test('A30 safe capture export refuses test report, existing target and symlink', async t => {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-export-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const { saveLiveCapture }=await import('../lib/live-export.mjs');
  const report=path.join(root,'test-results','app-studio-trace.json');
  const {mkdir}=await import('node:fs/promises');await mkdir(path.dirname(report));
  await writeFile(report,'test report');
  const snapshot={kind:'product-studio-trace',version:2,capture:{id:'sample',through:0}};
  await assert.rejects(saveLiveCapture(root,report,snapshot),error=>error.code==='live.output');
  const target=path.join(root,'saved.studio-trace.json');
  await writeFile(target,'keep');
  await assert.rejects(saveLiveCapture(root,target,snapshot),error=>error.code==='live.output');
  assert.equal(await readFile(target,'utf8'),'keep');
  const alias=path.join(root,'alias.studio-trace.json');await symlink(report,alias);
  await assert.rejects(saveLiveCapture(root,alias,snapshot),error=>error.code==='live.output');
  const fresh=path.join(root,'fresh.studio-trace.json');
  await saveLiveCapture(root,fresh,snapshot);
  assert.deepEqual(JSON.parse(await readFile(fresh,'utf8')),snapshot);
});
