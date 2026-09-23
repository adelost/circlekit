import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareInspection, writeInspectionBundle } from '../lib/exporter.mjs';
import { digest } from '../lib/util.mjs';

test('authoring export documents the exact source snapshot that was compiled', async () => {
  const sourceFiles=['src/service.ts'];
  const snapshot=[{relative:'src/service.ts',text:`import { service } from '@v1d/product-spec';
/** WHAT: Routes commands to the owner. WHY: Keeps effects outside presentation. */
export const owner = service({id:'example.owner',inputs:[],outputs:[],runtime:{stateOwner:'none',lifetime:'call',durability:'transient',clockDomain:'none',contextInputs:[],effects:[]}});
`}];
  const bundle=await prepareInspection({
    root:process.cwd(),productId:'snapshot-test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},
    sourceFiles,sourceSnapshot:snapshot,evaluateContract:()=>[],
  });
  assert.equal(bundle.sources[0].digest,digest(snapshot[0].text));
  assert.equal(bundle.contracts[0].id,'example.owner');
  assert.equal(bundle.contracts[0].contract.status,'validated');
});

test('authoring export refuses a source snapshot that does not match the selected file list', async () => {
  await assert.rejects(
    prepareInspection({
      root:process.cwd(),productId:'snapshot-test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},
      sourceFiles:['src/service.ts'],sourceSnapshot:[{relative:'src/other.ts',text:''}],
    }),
    error=>error.code==='export.snapshot',
  );
});

test('workspace export creates a missing generated directory but refuses an escaping parent',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-export-dir-'));
  const outside=await mkdtemp(path.join(os.tmpdir(),'studio-export-outside-'));
  t.after(async()=>{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});});
  await writeFile(path.join(root,'source.mjs'),'export const product = true;\n');
  const options={root,productId:'export-test',compiler:{name:'@v1d/product-spec',version:'0.3.65'},sourceFiles:['source.mjs']};
  await writeInspectionBundle({...options,output:'generated/nested/export-test.studio.json'});
  const saved=JSON.parse(await readFile(path.join(root,'generated/nested/export-test.studio.json'),'utf8'));
  assert.equal(saved.productId,'export-test');
  await symlink(outside,path.join(root,'escape'));
  await assert.rejects(writeInspectionBundle({...options,output:'escape/nested/export-test.studio.json'}),
    error=>error.code==='export.escape');
  await assert.rejects(readFile(path.join(outside,'nested/export-test.studio.json')));
});
