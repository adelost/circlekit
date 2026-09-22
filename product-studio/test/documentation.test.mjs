import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readDocumentationInputs, checkWorkspaceContracts, documentationFor } from '../lib/documentation.mjs';
import { digest } from '../lib/util.mjs';

const source=`import {service} from '@v1d/product-spec';\n/**\n * WHAT: Routes recording commands to the recorder.\n * WHY: Keeps sensor interpretation separate from persistence effects.\n */\nexport const recorder=service({id:'recorder',runtime:{effects:['record.write']}});`;
const evaluator=()=>[]; // Delegation mechanics only; the real AMUX grammar is tested separately.
async function workspace(t, files={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-contract-'));
  t.after(async()=>{const {rm}=await import('node:fs/promises');await rm(root,{recursive:true,force:true});});
  for(const [f,text] of Object.entries(files)){await mkdir(path.dirname(path.join(root,f)),{recursive:true});await writeFile(path.join(root,f),text);}
  return root;
}
const manifest=(documentation={sourceRoots:['src']})=>JSON.stringify({version:2,projects:[{id:'app',label:'App',documentation}]});

test('Given selected source roots When checking Then private services are counted and optional missing evidence is informational',async t=>{
  const root=await workspace(t,{'studio.workspace.json':manifest({sourceRoots:['src'],bddReports:['test-results/bdd-run.json']}),'src/service.ts':source,'src/generated/ignored.ts':source});
  const result=await checkWorkspaceContracts(root,{evaluateContract:evaluator});
  assert.equal(result.ok,true);assert.equal(result.projects[0].serviceCount,1);
  assert.equal(result.projects[0].diagnostics[0].rule,'evidence.missing');
});
test('Given a selected service without intent When checking Then the authoring result fails',async t=>{
  const root=await workspace(t,{'studio.workspace.json':manifest(),'src/service.ts':"import {service} from '@v1d/product-spec'; const a=service({id:'a'});"});
  assert.equal((await checkWorkspaceContracts(root,{evaluateContract:evaluator})).ok,false);
});
test('Given an empty or missing source scope When checking Then zero services cannot masquerade as coverage',async t=>{
  for(const scope of [[],['missing']]){
    const root=await workspace(t,{'studio.workspace.json':manifest({sourceRoots:scope})});
    assert.equal((await checkWorkspaceContracts(root,{evaluateContract:evaluator})).ok,false);
  }
});
test('Given an unknown product or missing evaluator When checking Then selection fails explicitly',async t=>{
  const root=await workspace(t,{'studio.workspace.json':manifest(),'src/service.ts':source});
  await assert.rejects(checkWorkspaceContracts(root,{product:'other',evaluateContract:evaluator}),e=>e.code==='workspace.selection');
  await assert.rejects(checkWorkspaceContracts(root),e=>e.code==='contract.grammar');
});
test('Given a path escape or symlink When scanning Then it is an error instead of silently complete coverage',async t=>{
  const root=await workspace(t,{'src/service.ts':source});
  await symlink(path.join(root,'src'),path.join(root,'linked'));
  for(const p of ['../secret','linked']){
    const inputs=await readDocumentationInputs(root,{sourceRoots:[p]});
    assert(inputs.diagnostics.some(d=>d.severity==='error'));assert.equal(inputs.sources.length,0);
  }
});
test('Given no product execution permission When scanning Then declarations remain unevaluated',async t=>{
  const root=await workspace(t,{'src/service.ts':source+"\nthrow new Error('must not execute');"});
  const inputs=await readDocumentationInputs(root,{sourceRoots:['src']});
  assert.equal(inputs.sources.length,1);assert.equal(inputs.diagnostics.length,0);
});
test('Given exact exported source identity When presenting Then intent is matched while altered source stays source-only',()=>{
  const inputs={sources:[{path:'src/service.ts',text:source}],reports:[],diagnostics:[],roots:['src'],repository:'owner/app'};
  const architecture={entities:[{key:'node-type::recorder',id:'recorder',kind:'node-type',data:{kind:'service'}}]};
  const plain=documentationFor(inputs,architecture);
  assert.equal(plain.contracts[0].correlation,'source-only');
  const inspection={origins:[{entityKey:'node-type::recorder',file:'src/service.ts',sourceDigest:digest(source),span:plain.contracts[0].source.span}]};
  assert.equal(documentationFor(inputs,architecture,{inspection}).contracts[0].correlation,'matched-source');
  assert.equal(documentationFor({...inputs,sources:[{path:'src/service.ts',text:source+'\n'}]},architecture,{inspection}).contracts[0].correlation,'source-only');
});
test('Given an external service type When presenting Then it remains an explicit unmapped gap',()=>{
  const view=documentationFor({sources:[],reports:[],diagnostics:[],roots:[]},{entities:[{key:'node-type::external',id:'external',kind:'node-type',data:{kind:'service'}}]});
  assert.equal(view.unresolved.length,1);assert.equal(view.contracts.length,0);
});
