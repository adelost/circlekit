#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root=path.resolve(process.argv[2]??'.');
const [manifest,lock]=await Promise.all(['package.json','package-lock.json'].map(async file=>
  JSON.parse(await readFile(path.join(root,file),'utf8'))));
const peer='>=0.3.64 <0.4.0',name='@v1d/product-spec';
const errors=[];
if(manifest.dependencies?.[name]!==undefined)errors.push(`${name} must be a peer, not a direct dependency`);
if(manifest.peerDependencies?.[name]!==peer)errors.push(`${name} peer must be ${peer}`);
if(lock.packages?.['']?.peerDependencies?.[name]!==peer)errors.push('package-lock must carry the same ProductSpec peer');

// The existing shared checker still validates every immutable direct and dev tarball pin.
const module=await import(pathToFileURL(path.join(root,'node_modules/@v1d/product-spec/dist/src/pin-check.js')).href);
const immutable=module.checkV1dPins({...manifest,peerDependencies:undefined},lock);
errors.push(...immutable.errors);
try { execFileSync('npm',['ls',name,'--depth=0'],{cwd:root,stdio:'ignore',timeout:10000}); }
catch { errors.push(`${name} must be installed at the package root and satisfy its peer range`); }

if(errors.length) {
  console.error(`v1d peer pin check failed:\n${errors.map(error=>'- '+error).join('\n')}`);
  process.exitCode=1;
} else console.log(`ok - ${immutable.dependencies.length} immutable @v1d pins and one ${name} peer (${peer})`);
