// Synthetic documentation transport fixture, not a device or domain behavior proof.
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { product, policy } from './fixture-source.mjs';
import { writeInspectionBundle } from '../lib/exporter.mjs';
import { KERNEL_VERSION } from '../lib/kernel.mjs';
export const serviceSource=`import {service} from '@v1d/product-spec';
/**
 * WHAT: Routes recorded input to the processing boundary.
 * WHY: Keeps input acquisition outside transforms and presentation.
 */
export const reader=service({id:'example.reader',inputs:[],outputs:[],runtime:{effects:['fixture-read']}});
throw new Error('Documentation discovery must never execute this source.');
`;
export function reportedFixture() {
  return {schemaVersion:'bdd.run.v1',run:{framework:'vitest',frameworkVersion:'4.0.18',project:'documentation-fixture',repository:'synthetic/fixture',commitSha:'fixture',branch:null,startedAt:'2026-09-22T10:00:00Z',finishedAt:'2026-09-22T10:00:01Z',durationMs:1000,status:'passed'},
    summary:{total:2,passed:1,failed:0,skipped:1,pending:0},tests:[
      {id:'sha256:'+'a'.repeat(64),name:'sends once',fullName:'reader sends once',file:'test/reader.test.ts',line:2,level:'unit',documentation:'scenario',scenarios:[{name:'Synthetic input delivery',phases:{given:'one recorded input',when:'the reader receives demand',then:'the input is delivered once'},documented:true}],status:'passed',durationMs:10,retryCount:0,flaky:false},
      {id:'sha256:'+'b'.repeat(64),name:'native delivery',fullName:'native delivery',file:'test/ReaderTest.kt',line:null,level:'integration',documentation:'missing',scenarios:[],status:'skipped',durationMs:0,retryCount:0,flaky:false},
    ]};
}
export async function documentationFixture({evaluateContract,missing=false}={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'studio-documentation-'));
  for(const dir of ['src','generated','test','test-results'])await mkdir(path.join(root,dir));
  const source=missing?serviceSource.replace(/\/\*\*[\s\S]*?\*\//,''):serviceSource;
  await writeFile(path.join(root,'src/reader.ts'),source);
  await writeFile(path.join(root,'src/legacy.ts'),"export const background={id:'OLD_READER',runs:{kind:'CLOCK',intervalMs:1000},reason:'Reads one input on its legacy clock.'};\n");
  await writeFile(path.join(root,'test/reader.test.ts'),"// Association fixture, not executed by Studio.\ntest('sends once',()=>{deliver('ingest.reader.frames');});\n");
  await writeFile(path.join(root,'test-results/bdd-run.json'),JSON.stringify(reportedFixture()));
  const receipt=await writeInspectionBundle({root,output:'generated/system.studio.json',productId:product.id,
    compiler:{name:'@v1d/product-spec',version:KERNEL_VERSION},sourceRevision:'fixture',product,
    facets:[{id:policy.id,kind:'decision-table',compiled:policy}],sourceFiles:['src/reader.ts'],evaluateContract});
  const manifest={version:2,projects:[{id:'documentation',label:'Documentation example',bundle:'generated/system.studio.json',revision:'fixture',originKind:'example',
    provenance:'Synthetic transport fixture; reported test statuses are samples, not executed product evidence.',
    documentation:{sourceRoots:['src'],repository:'synthetic/fixture',bddReports:['test-results/bdd-run.json']}}]};
  await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify(manifest));
  return {root,receipt,source,cleanup:()=>rm(root,{recursive:true,force:true})};
}
