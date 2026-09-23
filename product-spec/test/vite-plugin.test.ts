import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { observationVitePlugin } from '../src/vite-plugin.js';

test('the one dev plugin selects an observed entry and refuses stale source identity',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'v1d-vite-'));
  try {
    await mkdir(path.join(root,'src'));
    const source='export const active = true;\n';
    await writeFile(path.join(root,'src/app.ts'),source);
    const digest=createHash('sha256').update(source).digest('hex');
    await writeFile(path.join(root,'product.studio.json'),JSON.stringify({kind:'product-studio-bundle',version:2,
      productId:'fixture',modelDigest:'a'.repeat(64),compiler:{version:'0.3.68'},
      sources:[{file:'src/app.ts',digest}],facets:[{id:'door',kind:'machine'}]}));
    const plugin=observationVitePlugin({bundle:'product.studio.json'});
    assert.equal(plugin.apply,'serve');
    assert.match(JSON.stringify(plugin.config()),/observed\.js/);
    plugin.configResolved({root});
    const id=plugin.resolveId('virtual:v1d-observation-bootstrap');
    assert.ok(id);
    const code=plugin.load(id!);
    assert.ok(code);
    assert.match(code,/connectBrowserObservation/);
    assert.match(code,/fixture/);
    assert.doesNotMatch(code,/A{43}/u);
    assert.match(JSON.stringify(plugin.transformIndexHtml.handler()),/virtual:v1d-observation-bootstrap/);
    let changed:((file:string)=>void)|null=null;const notices:string[]=[];
    plugin.configureServer({watcher:{add:()=>{},on:(_name:string,handler:(file:string)=>void)=>{changed=handler;}},
      moduleGraph:{getModuleById:()=>null,invalidateModule:()=>{}},ws:{send:(notice:{type:string})=>notices.push(notice.type)}});
    await writeFile(path.join(root,'src/app.ts'),'export const active = false;\n');
    assert.ok(changed);(changed as (file:string)=>void)(path.join(root,'src/app.ts'));
    assert.deepEqual(notices,['full-reload']);
    assert.throws(()=>plugin.load(id!),/stale|regenerate/i);
  } finally { await rm(root,{recursive:true,force:true}); }
});
