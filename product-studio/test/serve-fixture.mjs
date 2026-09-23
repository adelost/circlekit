// A temporary synthetic fixture server for browser acceptance, not a product build.
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { product, policy } from './fixture-source.mjs';
import { writeInspectionBundle, entityKey, createTraceRecorder } from '../adapter.mjs';
import { KERNEL_VERSION } from '../lib/kernel.mjs';
import { createServer } from '../server.mjs';
const root = await mkdtemp(path.join(os.tmpdir(),'studio-browser-fixture-'));
await mkdir(path.join(root,'src'));await mkdir(path.join(root,'generated'));
await copyFile(new URL('./fixture-source.mjs',import.meta.url),path.join(root,'src/model.mjs'));
const key=entityKey;
const receipt=await writeInspectionBundle({root,output:'generated/system.studio.json',productId:product.id,
  compiler:{name:'@v1d/product-spec',version:KERNEL_VERSION},sourceRevision:'synthetic-browser-fixture',product,
  facets:[{id:policy.id,kind:'decision-table',compiled:policy}],sourceFiles:['src/model.mjs'],
  groups:[{id:'ingest',label:'Input',members:[key('node','ingest.reader')]},{id:'processing',label:'Processing',members:[key('node','processing.transform')]},{id:'ui',label:'Interface',members:[key('node','presentation.model'),key('component','screen.preview')]}],
  relations:[{from:key('facet',policy.id,'decision-table'),to:key('node','processing.transform'),kind:'controls',label:'Explicit fixture association'}],
  diagnostics:[{rule:'fixture.structure',message:'Synthetic architecture fixture. No native product compiler or runtime has been exercised.'}],
});
await writeFile(path.join(root,'studio.workspace.json'),JSON.stringify({version:2,projects:[{id:'pipeline',label:'Architecture example',bundle:'generated/system.studio.json',originKind:'example',provenance:'Synthetic architecture and source fixture; not a running application.'}]}));
const recorder=createTraceRecorder({productId:product.id,modelDigest:receipt.modelDigest,sessionId:'synthetic-session-1',clock:'virtual',provenance:'synthetic'});
recorder.record({atMs:0,kind:'message',entityKey:key('node','ingest.reader'),summary:'Synthetic input selected',operationId:'case-1'});
recorder.record({atMs:8,kind:'port',entityKey:key('port','ingest.reader.frames'),summary:'One fixture frame delivered',operationId:'case-1',causedBy:0});
recorder.record({atMs:9,kind:'decision',entityKey:key('facet',policy.id,'decision-table'),summary:'Admission decision',operationId:'case-1',causedBy:1,logic:{facetId:policy.id,cellId:'ready',facts:{input:'READY',permission:'ALLOWED'},values:{action:'PROCESS'}}});
recorder.record({atMs:20,kind:'port',entityKey:key('port','processing.transform.result'),summary:'Synthetic transformed result',operationId:'case-1',causedBy:2});
recorder.record({atMs:22,kind:'port',entityKey:key('port','screen.preview.model'),summary:'Synthetic preview model',operationId:'case-1',causedBy:3});
const traceFile=path.join(root,'trace.json');await writeFile(traceFile,JSON.stringify(recorder.snapshot()));
const {server,origin}=await createServer({roots:[root],port:0,dataDir:path.join(root,'data')});
console.log(JSON.stringify({origin,traceFile,root,kernelVersion:KERNEL_VERSION}));
const stop=async()=>{server.closeAllConnections();server.close();await rm(root,{recursive:true,force:true});process.exit(0);};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
