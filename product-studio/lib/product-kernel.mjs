import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { relativeSourcePath } from './inspection.mjs';
import { requireThat, safeFile, StudioError } from './util.mjs';

const exec=promisify(execFile);

/** Resolve the product's installed, locked evaluator without loading product source. */
export async function loadProductKernel(root,packageRoot='.',expectedVersion=null) {
  requireThat(packageRoot==='.'||relativeSourcePath(packageRoot),
    'kernel.root','Select a repository-relative package root.');
  const base=await realpath(root),owner=await realpath(path.resolve(base,packageRoot));
  requireThat(owner===base||owner.startsWith(base+path.sep),
    'kernel.root','The ProductSpec package owner must be inside this repository.');
  let entry;
  try {
    entry=(await exec(process.execPath,['--input-type=module','-e',
      "process.stdout.write(import.meta.resolve('@v1d/product-spec'))"],
    {cwd:owner,timeout:5000,maxBuffer:1000000})).stdout.trim();
  } catch {
    throw new StudioError('kernel.unavailable',
      'ProductSpec is not installed in '+packageRoot+'. Run the product owner’s locked setup; Studio will not substitute its own kernel.');
  }
  let directory=path.dirname(fileURLToPath(entry)),installed=null;
  while(directory!==path.dirname(directory)) {
    try {
      const candidate=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
      if(candidate.name==='@v1d/product-spec'){installed=candidate;break;}
    } catch {}
    directory=path.dirname(directory);
  }
  requireThat(installed,'kernel.unavailable','The resolved ProductSpec entry has no package identity.');
  const lock=JSON.parse((await safeFile(owner,'package-lock.json',4000000)).text);
  requireThat(lock.packages?.['node_modules/@v1d/product-spec']?.version===installed.version,
    'kernel.lock','Installed ProductSpec differs from the product lockfile. Run its locked setup.');
  requireThat(expectedVersion===null||expectedVersion===installed.version,
    'kernel.version','The loaded artifact was produced by another ProductSpec version. Regenerate it with the product owner.');
  return {kernel:await import(entry),version:installed.version,entry};
}

/** Declaration laws require the product evaluator's structural validation API. */
export async function loadProductSpecKernel(root,packageRoot='.') {
  const selected=await loadProductKernel(root,packageRoot);
  requireThat(typeof selected.kernel.validateProductNodeType==='function'
    &&typeof selected.kernel.defineMachine==='function'
    &&typeof selected.kernel.defineDecisionTable==='function',
  'kernel.api','The selected ProductSpec package lacks the declaration validation API required by Studio evidence.');
  return {...selected,packageRoot};
}
