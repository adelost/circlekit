import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { requireThat, StudioError } from './util.mjs';

/** Read-only same-user discovery. No UI token or producer ticket is stored here. */
export async function discoverLive(dataDir=path.join(os.homedir(),'.local/state/product-studio'),port) {
  const directory=path.join(dataDir,'live-discovery');
  const files=await readdir(directory).catch(error=>error.code==='ENOENT'?[]:Promise.reject(error));
  const candidates=[];
  for(const file of files.filter(name=>/^\d+-\d+\.json$/u.test(name))) {
    const full=path.join(directory,file),info=await lstat(full);
    if(!info.isFile()||(info.mode&0o077)!==0||(process.getuid?.()!==undefined&&info.uid!==process.getuid()))continue;
    let receipt;
    try{receipt=JSON.parse(await readFile(full,'utf8'));}catch{continue;}
    if(!/^http:\/\/127\.0\.0\.1:\d+$/u.test(receipt.origin)||typeof receipt.readToken!=='string')continue;
    if(port!==undefined&&new URL(receipt.origin).port!==String(port))continue;
    try {
      const response=await fetch(receipt.origin+'/api/live-read',{headers:{'x-studio-read-token':receipt.readToken},signal:AbortSignal.timeout(1500)});
      if(response.ok)candidates.push(receipt);
    }catch{}
  }
  requireThat(candidates.length>0,'live.unavailable','No enabled local Studio is running. Start v1d-studio --live first.',404);
  requireThat(candidates.length===1,'live.ambiguous','Several live Studios are running. Select the exact one with --port.',409);
  return candidates[0];
}

export async function readLive(receipt,{session,max,offset,cut,raw=false}={}) {
  const url=new URL(raw?'/api/live-raw':'/api/live-read',receipt.origin);
  for(const [key,value] of Object.entries({session,max,offset,cut}))if(value!==undefined)url.searchParams.set(key,String(value));
  const response=await fetch(url,{headers:{'x-studio-read-token':receipt.readToken},signal:AbortSignal.timeout(5000)});
  const body=await response.json();
  if(!response.ok)throw new StudioError(body.error?.code??'live.unavailable',body.error?.message??'Live read failed.',response.status);
  return body;
}
