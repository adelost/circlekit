import { mkdir, writeFile, readFile, readdir, mkdtemp, link, rm } from 'node:fs/promises';
import path from 'node:path';
import { digest, canonicalJson, boundedJson, requireThat } from './util.mjs';

/** Immutable local scenario documents, never product documents or runtime state. */
export async function saveScenarioDocument(dataDir, document) {
  requireThat(document.kind === 'product-studio-scenario' && document.version === 1
    && typeof document.title === 'string' && document.title.length <= 150
    && typeof document.modelDigest === 'string' && typeof document.facetId === 'string'
    && Array.isArray(document.scenario?.events) && document.scenario.events.length <= 1000,
    'scenario.document', 'Invalid scenario document.');
  const json = canonicalJson(document), id = digest(json);
  requireThat(Buffer.byteLength(json) <= 2000000, 'scenario.document', 'Scenario document exceeds its budget.');
  const directory = path.join(dataDir,'scenarios'); await mkdir(directory,{recursive:true,mode:0o700});
  const file=path.join(directory,`${id}.json`);
  const staging = await mkdtemp(path.join(directory,'.stage-'));
  try {
    const temporary=path.join(staging,'scenario.json');
    await writeFile(temporary,json+'\n',{flag:'wx',mode:0o600});
    // Publish a completed file without replacing a concurrent save. Same filesystem.
    try { await link(temporary,file); }
    catch(error) { if(error.code!=='EEXIST') throw error; requireThat(canonicalJson(boundedJson(await readFile(file,'utf8')))===json,'scenario.conflict','Stored scenario content differs; it was not overwritten.'); }
  } finally { await rm(staging,{recursive:true,force:true}); }
  return {id,persistence:'studio-local-only',message:'Scenario saved locally. No product or runtime changed.'};
}
export async function readScenarioDocument(dataDir,id) {
  requireThat(/^[a-f0-9]{64}$/.test(id),'scenario.id','Invalid scenario identity.');
  const doc=boundedJson(await readFile(path.join(dataDir,'scenarios',`${id}.json`),'utf8'),2000000);
  requireThat(digest(canonicalJson(doc))===id,'scenario.digest','Saved scenario is corrupted or has changed.');return doc;
}
export async function listScenarioDocuments(dataDir) {
  let names;try {names=await readdir(path.join(dataDir,'scenarios'));}catch(e){if(e.code==='ENOENT')return[];throw e;}
  const result=[];
  for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).slice(0,200)) {
    const id=name.slice(0,-5),doc=await readScenarioDocument(dataDir,id);
    result.push({id,title:doc.title,modelDigest:doc.modelDigest,facetId:doc.facetId});
  }
  return result;
}
