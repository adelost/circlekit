import { spawn } from 'node:child_process';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openHeadlessStudio, selectProject } from './semantic.mjs';
import { storeTicketFile } from './ticket-file.mjs';
import { StudioError, requireThat } from './util.mjs';

export function parseLiveRunArgs(args) {
  const end=args.indexOf('--');
  requireThat(end>=0&&end<args.length-1,'live.command','Use live run --product ID -- node APP [ARGS].');
  let product=null,port=4317;
  for(let at=0;at<end;at++) {
    if(args[at]==='--product'&&args[at+1])product=args[++at];
    else if(args[at]==='--port'&&args[at+1]) {
      const value=args[++at];requireThat(/^\d+$/u.test(value),'live.port','Choose an integer local Studio port.');
      port=Number(value);
    } else requireThat(false,'live.option',`Unsupported live run option: ${args[at]}`);
  }
  requireThat(typeof product==='string'&&product.length>0,'live.product','Select one product with --product ID.');
  requireThat(Number.isInteger(port)&&port>0&&port<=65535,'live.port','Choose a valid local Studio port.');
  const command=args.slice(end+1);
  requireThat(['node','nodejs'].includes(path.basename(command[0]))||command[0]===process.execPath,
    'live.command','Run a direct Node process after --; do not wrap it with npm or a shell.');
  return {product,port,command};
}

async function responseJson(url,options) {
  let response;
  try {response=await fetch(url,options);}
  catch {throw new StudioError('live.disabled','Start local Studio with --live, then retry the direct Node command.');}
  const value=await response.json();
  requireThat(response.ok,value.error?.code??'live.server',value.error?.message??'Local Studio refused the request.');
  return value;
}

/** Explicit owner-run command. Descriptor is compiled from this checkout, never copied from the receiver. */
export async function runLiveNode(args,{cwd=process.cwd(),stdout=process.stdout}={}) {
  const input=parseLiveRunArgs(args),root=path.resolve(cwd);
  const {workbench,projects}=await openHeadlessStudio({roots:[root]});
  const chosen=selectProject(projects,input.product);
  const view=workbench.view(workbench.require(chosen.key));
  requireThat(view.compatibility?.simulate!==false,'live.kernel-unavailable',
    'Install this product\'s locked ProductSpec kernel before live run.');
  const url=`http://127.0.0.1:${input.port}`;
  const bootstrap=await responseJson(url+'/api/bootstrap');
  const candidates=bootstrap.projects.filter(p=>p.id===chosen.id);
  requireThat(candidates.length===1,'live.product','Studio must have exactly one loaded copy of this product.');
  const remote=await responseJson(url+'/api/project?id='+encodeURIComponent(candidates[0].key)+'&mode=summary',
    {headers:{'x-studio-token':bootstrap.token}});
  requireThat(remote.productId===view.productId && remote.modelDigest===view.modelDigest
    && remote.artifactSha256===view.artifactSha256
    && remote.toolVersions.productSpec===view.toolVersions.productSpec,
  'live.model-mismatch','Studio and this checkout use different compiled models. Open the matching build.');
  const kinds=new Set();
  if(view.architecture.entities.some(e=>e.kind==='port'))kinds.add('port');
  for(const facet of view.facets)if(facet.kind==='machine'||facet.kind==='decision-table')
    kinds.add(facet.kind==='machine'?'transition':'decision');
  requireThat(kinds.size>0,'live.scope','This product has no declared observable boundary.');
  const ticket=await responseJson(url+'/api/live-ticket',{method:'POST',
    headers:{'x-studio-token':bootstrap.token,'content-type':'application/json'},
    body:JSON.stringify({project:candidates[0].key,producer:'node'})});
  const ticketFile=await storeTicketFile(ticket.ticket);
  const directory=path.dirname(ticketFile),descriptorFile=path.join(directory,'descriptor.json');
  const descriptor={productId:view.productId,
    packageRoot:path.resolve(root,workbench.require(chosen.key).config.kernelRoot??'.'),
    identity:view.artifactSha256?{artifactSha256:view.artifactSha256}:{modelDigest:view.modelDigest},
    productSpecVersion:view.toolVersions.productSpec,
    scope:{events:[...kinds],facets:view.facets.map(f=>f.id),appliedTransitions:false}};
  try {
    await writeFile(descriptorFile,JSON.stringify(descriptor),{mode:0o600,flag:'wx'});
    const preload=fileURLToPath(new URL('./node-observer-preload.mjs',import.meta.url));
    const nodeOptions=[process.env.NODE_OPTIONS??'',`--conditions=v1d-observe`,`--import=${pathToFileURL(preload).href}`]
      .filter(Boolean).join(' ');
    const code=await new Promise((resolve,reject)=>{
      const child=spawn(input.command[0],input.command.slice(1),{cwd:root,stdio:'inherit',env:{...process.env,
        NODE_OPTIONS:nodeOptions,V1D_LIVE_URL:`ws://127.0.0.1:${input.port}/runtime/v1`,
        V1D_LIVE_TICKET_FILE:ticketFile,V1D_LIVE_DESCRIPTOR_FILE:descriptorFile}});
      child.once('error',reject);child.once('close',status=>resolve(status??1));
    });
    stdout.write(JSON.stringify({ok:code===0,command:'live run',product:chosen.id,exitCode:code})+'\n');
    return code;
  } finally {await rm(directory,{recursive:true,force:true});}
}
