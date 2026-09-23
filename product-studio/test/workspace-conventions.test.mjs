import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { repositoryFromRemote, workspaceConventions } from '../lib/workspaces.mjs';
import { main } from '../bin/studio.mjs';

const exec=promisify(execFile);
async function temporary(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-conventions-'));
  t.after(()=>rm(root,{recursive:true,force:true}));return root;
}
async function pin(root,owner,version,{installed=true}={}) {
  await mkdir(path.join(root,owner),{recursive:true});
  await writeFile(path.join(root,owner,'package-lock.json'),JSON.stringify({packages:{
    'node_modules/@v1d/product-spec':{version},
  }}));
  if(installed) {
    const location=path.join(root,owner,'node_modules/@v1d/product-spec');
    await mkdir(location,{recursive:true});
    await writeFile(path.join(location,'package.json'),JSON.stringify({name:'@v1d/product-spec',version}));
  }
}

test('one nearest package, Git repository and present test-results replace workspace boilerplate',async t=>{
  const root=await temporary(t);
  await pin(root,'.','0.3.65');await pin(root,'ui','0.3.64');
  await mkdir(path.join(root,'test-results'));
  const project={id:'activity',label:'Activity',bundle:'ui/generated/activity.studio.json',
    authoring:{entry:'ui/src/activity.ts'},documentation:{sourceRoots:['ui/src']}};
  const minimal=await workspaceConventions(root,project,'adelost/ai-dsl');
  assert.equal(minimal.kernelRoot,'ui');assert.equal(minimal.documentation.repository,'adelost/ai-dsl');
  assert.equal(Object.hasOwn(minimal,'sources'),false);
  const policy=await workspaceConventions(root,{id:'policy',label:'Policy',sources:['policies/context.ts']},'adelost/ai-dsl');
  assert.equal(policy.kernelRoot,'.');
  assert.equal(minimal.traceFile,undefined);assert.equal(minimal.documentation.bddReports,undefined);
  for(const file of ['activity-studio-trace.json','activity-bdd-run.json','activity-laws.json'])
    await writeFile(path.join(root,'test-results',file),'{}');
  const recorded=await workspaceConventions(root,project,'adelost/ai-dsl');
  assert.equal(recorded.traceFile,'test-results/activity-studio-trace.json');
  assert.deepEqual(recorded.documentation.bddReports,[
    'test-results/activity-bdd-run.json','test-results/activity-laws.json',
  ]);
  await writeFile(path.join(root,'test-results/activity-studio-trace.json'),Buffer.alloc(8_000_001));
  assert.equal((await workspaceConventions(root,project)).traceFile,'test-results/activity-studio-trace.json');
  const explicit=await workspaceConventions(root,{...project,kernelRoot:'.',traceFile:'own/trace.json',
    documentation:{repository:'another/repo',sourceRoots:['ui/src'],bddReports:[]}},'adelost/ai-dsl');
  assert.equal(explicit.kernelRoot,'.');assert.equal(explicit.traceFile,'own/trace.json');
  assert.equal(explicit.documentation.repository,'another/repo');assert.deepEqual(explicit.documentation.bddReports,[]);
});

test('export uses the same inferred nested ProductSpec kernel as doctor',async t=>{
  const root=await temporary(t),ui=path.join(root,'ui'),amux=path.join(root,'trusted-amux');
  await pin(root,'ui','0.3.65',{installed:false});
  const installed=fileURLToPath(new URL('../node_modules/@v1d/product-spec/',import.meta.url));
  await mkdir(path.join(ui,'node_modules/@v1d'),{recursive:true});
  await symlink(installed,path.join(ui,'node_modules/@v1d/product-spec'));
  await mkdir(path.join(ui,'src'),{recursive:true});
  await writeFile(path.join(ui,'src/policy.mjs'),`import {choice,defineDecisionTable,on} from '@v1d/product-spec';
export const policy=defineDecisionTable({id:'fixture.policy',axes:{phase:['READY']},columns:{action:choice(['RUN'])},
  cells:[on('run',{phase:'READY'},{action:'RUN'})]});\n`);
  await mkdir(path.join(amux,'core'),{recursive:true});
  await writeFile(path.join(amux,'core/contract-lint.mjs'),'export function evaluateContract(){return {findings:[]}}\n');
  await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:2,projects:[{
    id:'nested',label:'Nested',bundle:'ui/generated/policy.studio.json',
    authoring:{entry:'ui/src/policy.mjs',exportName:'policy',kind:'decision-table',files:['ui/src/policy.mjs']},
  }]}));
  let output='';const code=await main(['export','--product','nested','--amux-root',amux],
    {cwd:root,stdout:{write:text=>{output+=text;}}});
  assert.equal(code,0,output);
  assert.equal(JSON.parse(output).ok,true);
  const bundle=JSON.parse(await readFile(path.join(ui,'generated/policy.studio.json'),'utf8'));
  assert.equal(bundle.compiler.version,'0.3.65');
  assert.equal(bundle.facets[0].id,'fixture.policy');
});

test('mixed package owners refuse an inferred kernel instead of picking one',async t=>{
  const root=await temporary(t);
  await pin(root,'a','0.3.64');await pin(root,'b','0.3.65');
  await assert.rejects(workspaceConventions(root,{id:'mixed',label:'Mixed',artifact:'a/generated/model.json',
    sources:['b/rules.ts']}),error=>error.code==='workspace.kernel');
});

test('an uninstalled pin stays inspect-only instead of loading Studio as its evaluator',async t=>{
  const root=await temporary(t);await pin(root,'.','9.0.0',{installed:false});
  const product=await workspaceConventions(root,{id:'policy',label:'Policy',sources:['policy.mjs']});
  assert.equal(product.kernelRoot,undefined);
});

test('repository convention accepts GitHub origin without exposing credentials',async t=>{
  const root=await temporary(t);
  await exec('git',['init',root]);
  await exec('git',['-C',root,'remote','add','origin','git@github.com:adelost/skyvw.git']);
  assert.equal(await repositoryFromRemote(root),'adelost/skyvw');
  await exec('git',['-C',root,'remote','set-url','origin','https://token:secret@github.com/adelost/ai-dsl.git']);
  assert.equal(await repositoryFromRemote(root),'adelost/ai-dsl');
  await exec('git',['-C',root,'remote','set-url','origin','https://gitlab.com/adelost/other.git']);
  assert.equal(await repositoryFromRemote(root),null);
});
