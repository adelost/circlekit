import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Options={bundle:string;sourceRoot?:string;sourcePrefix?:string;studioPort?:number};
const virtual='virtual:v1d-observation-bootstrap',resolved='\0'+virtual;
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');

function inside(root:string,relative:string) {
  if(!relative||path.isAbsolute(relative)||relative.split(/[\\/]/u).some(part=>part==='..'))
    throw new Error(`Studio observation needs a repository-relative file: ${relative}`);
  const file=path.resolve(root,relative);
  if(file!==root&&!file.startsWith(root+path.sep))throw new Error('Studio observation source escaped the project root.');
  return file;
}

/** Dev-only Vite entry. It never runs in a production build and never embeds a pairing secret. */
export function observationVitePlugin(options:Options) {
  let root=process.cwd();
  const monitored=new Set<string>();
  const port=options.studioPort??4317;
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Choose a valid local Studio port.');
  const observed=fileURLToPath(new URL('./observed.js',import.meta.url));
  function descriptor() {
    const file=inside(root,options.bundle);
    monitored.clear();monitored.add(file);
    let bundle:Record<string,unknown>;
    try{bundle=JSON.parse(readFileSync(file,'utf8'));}
    catch{throw new Error(`Studio observation bundle missing or invalid: ${options.bundle}. Export it before dev.`);}
    const compiler=bundle.compiler as {version?:unknown}|undefined;
    const sources=bundle.sources as Array<{file:string;digest:string}>|undefined;
    if(bundle.kind!=='product-studio-bundle'||typeof bundle.productId!=='string'
      ||typeof bundle.modelDigest!=='string'||!/^([a-f0-9]{64})$/u.test(bundle.modelDigest)
      ||typeof compiler?.version!=='string'||!Array.isArray(sources)||!sources.length)
      throw new Error(`Studio observation needs a compiled, source-bound bundle: ${options.bundle}.`);
    const sourceRoot=inside(root,options.sourceRoot??'.');
    const prefix=options.sourcePrefix??'';
    for(const source of sources) {
      if(!source.file.startsWith(prefix))throw new Error(`Studio source mapping cannot place ${source.file}. Check sourcePrefix.`);
      const mapped=inside(sourceRoot,source.file.slice(prefix.length));
      monitored.add(mapped);
      let text:string;
      try{text=readFileSync(mapped,'utf8');}
      catch{throw new Error(`Studio model source missing: ${source.file}. Sync the product before dev.`);}
      if(digest(text)!==source.digest)throw new Error(`Studio model/source stale: ${source.file}. Regenerate and sync the bundle.`);
    }
    const facets=(bundle.facets??[]) as Array<{id:string;kind:string}>;
    const events:Array<'port'|'decision'|'transition'>=[];
    if(bundle.product)events.push('port');
    if(facets.some(f=>f.kind==='decision-table'))events.push('decision');
    if(facets.some(f=>f.kind==='machine'))events.push('transition');
    if(!events.length)throw new Error('Studio observation bundle has no declared observable boundary.');
    return {productId:bundle.productId,identity:{modelDigest:bundle.modelDigest},
      productSpecVersion:compiler.version,scope:{events,facets:facets.map(f=>f.id),appliedTransitions:false}};
  }
  return {
    name:'v1d-runtime-observation',apply:'serve' as const,
    config:()=>({resolve:{alias:[{find:/^@v1d\/product-spec$/u,replacement:observed}]}}),
    configResolved:(config:{root:string})=>{root=path.resolve(config.root);},
    configureServer:(server:any)=>{
      descriptor();server.watcher.add([...monitored]);
      server.watcher.on('change',(file:string)=>{
        if(!monitored.has(path.resolve(file)))return;
        const module=server.moduleGraph.getModuleById(resolved);
        if(module)server.moduleGraph.invalidateModule(module);
        server.ws.send({type:'full-reload'});
      });
    },
    resolveId:(id:string)=>id===virtual?resolved:null,
    load:(id:string)=>{
      if(id!==resolved)return null;
      const embedded=JSON.stringify(descriptor());
      return `import { connectBrowserObservation } from '@v1d/product-spec/browser';
const descriptor=${embedded};
const button=document.createElement('button');button.type='button';
button.textContent='Observe in Studio';button.setAttribute('aria-label','Connect debug observations to Product Studio');
button.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483647;background:#17212b;color:#fff;border:1px solid #56cdda;border-radius:8px;padding:8px 10px;font:12px system-ui;cursor:pointer';
if(document.body)document.body.append(button);else window.addEventListener('DOMContentLoaded',()=>document.body.append(button),{once:true});
let session=null;
button.onclick=async()=>{
  if(session){session.stop();session=null;button.textContent='Observe in Studio';return;}
  const ticket=window.prompt('Paste the one-time browser ticket from local Studio');
  if(!ticket)return;
  try{
    session=connectBrowserObservation({url:'ws://127.0.0.1:${port}/runtime/v1',ticket,descriptor,
      onStatus:status=>{button.textContent=status;}});
    await session.connected;button.textContent='Observing · Stop';
  }catch(error){session=null;button.textContent='Studio unavailable · retry';console.warn(String(error));}
};
import.meta.hot?.dispose(()=>{session?.stop();button.remove();});`;
    },
    transformIndexHtml:{order:'pre' as const,handler:()=>[{tag:'script',attrs:{type:'module'},
      children:`import '${virtual}';`,injectTo:'head-prepend' as const}]},
  };
}
