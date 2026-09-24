import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_STUDIO_PORT } from './cli.mjs';
import { requireThat, StudioError } from './util.mjs';

const PRIVATE_TICKET='files/studio-observation/ticket';
const serialShape=/^[A-Za-z0-9._:-]+$/u;
const quote=value=>`'${value.replaceAll("'","'\\''")}'`;

/** Select one explicitly declared Android target, never a package guessed from a connected device. */
export async function resolveNativeProject(root,requested) {
  let workspace;
  try { workspace=JSON.parse(await readFile(path.join(root,'studio.workspace.json'),'utf8')); }
  catch { throw new StudioError('live.workspace',`No readable studio.workspace.json in ${root}. Use a checkout with its project manifest.`); }
  requireThat(Array.isArray(workspace.projects),'live.workspace','studio.workspace.json must declare projects.');
  const eligible=workspace.projects.filter(project=>project.nativeLive);
  const selected=requested===null?eligible.length===1?eligible[0]:null
    :workspace.projects.find(project=>project.id===requested);
  requireThat(selected,'live.product',requested===null
    ?'Select one native project with --product ID from studio.workspace.json.'
    :`Project ${requested} is not in studio.workspace.json. Select one of: ${workspace.projects.map(project=>project.id).join(', ')}.`);
  const native=selected.nativeLive;
  requireThat(native&&typeof native==='object','live.native-config',
    `Project ${selected.id} has no nativeLive package/action. Declare them in studio.workspace.json.`);
  const packageName=native.package,action=native.action;
  requireThat(typeof packageName==='string'&&/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/u.test(packageName)
    &&action===`${packageName}.STUDIO_OBSERVE`,'live.native-config',
    `Project ${selected.id} needs a valid nativeLive.package and its own <package>.STUDIO_OBSERVE action.`);
  const install=native.install??[];
  requireThat(Array.isArray(install)&&install.every(value=>typeof value==='string'&&/^[A-Za-z0-9_./:-]+$/u.test(value)),
    'live.native-config',`Project ${selected.id} has an invalid nativeLive.install command list.`);
  return {product:selected.id,packageName,action,install};
}

function installCommand(root,device,native) {
  if(native.install.length===0)return `Install a debuggable ${native.packageName} APK explicitly on ${device}, then retry.`;
  return `cd ${quote(root)} && ANDROID_SERIAL=${quote(device)} ${native.install.map(quote).join(' ')}`;
}

export function parseLiveConnectArgs(args) {
  let device=null,port=DEFAULT_STUDIO_PORT,product=null;
  for(let i=0;i<args.length;i++){
    if(args[i]==='--device'&&args[i+1])device=args[++i];
    else if(args[i]==='--product'&&args[i+1])product=args[++i];
    else if(args[i]==='--port'&&args[i+1]){
      const value=args[++i];requireThat(/^\d+$/u.test(value),'live.port','Choose an integer local Studio port.');port=Number(value);
    }else requireThat(false,'live.option',`Unsupported live connect option: ${args[i]}`);
  }
  requireThat(serialShape.test(device??''),'live.device','Select exactly one device with --device SERIAL from adb devices -l.');
  requireThat(Number.isInteger(port)&&port>0&&port<=65535,'live.port','Choose a valid local Studio port.');
  return {device,port,product};
}

/** No shell: arguments and the private stdin channel remain separate. */
export async function executeAdb(args,stdin='') {
  return new Promise((resolve,reject)=>{
    const child=spawn('adb',args,{stdio:['pipe','pipe','pipe']});
    const output=[],errors=[];let size=0;
    const timer=setTimeout(()=>child.kill('SIGTERM'),10000).unref();
    const collect=(list,chunk)=>{size+=chunk.length;if(size>256_000)child.kill('SIGTERM');else list.push(chunk);};
    child.stdout.on('data',chunk=>collect(output,chunk));child.stderr.on('data',chunk=>collect(errors,chunk));
    child.stdin.on('error',error=>{if(error.code!=='EPIPE')reject(error);});
    child.once('error',error=>{clearTimeout(timer);reject(new StudioError('live.adb',
      error.code==='ENOENT'?'adb is not installed. Add Android platform-tools to PATH.':`adb failed: ${error.message}`));});
    child.once('close',code=>{clearTimeout(timer);resolve({code:code??1,stdout:Buffer.concat(output).toString('utf8'),stderr:Buffer.concat(errors).toString('utf8')});});
    child.stdin.end(stdin);
  });
}

async function jsonResponse(url,options) {
  let response;
  try{response=await fetch(url,{...options,signal:AbortSignal.timeout(5000)});}
  catch{throw new StudioError('live.disabled','Start the matching local Studio with --live before connecting Android.');}
  const body=await response.json();
  requireThat(response.ok,body.error?.code??'live.server',body.error?.message??'Local Studio refused pairing.');
  return body;
}

async function issueNativeTicket({port,product}) {
  const origin=`http://127.0.0.1:${port}`,bootstrap=await jsonResponse(origin+'/api/bootstrap');
  requireThat(bootstrap.liveEnabled===true,'live.disabled','Start the matching local Studio with --live.');
  const candidates=bootstrap.projects.filter(project=>project.id===product);
  requireThat(candidates.length===1,'live.product',`Studio must have exactly one loaded ${product} project.`);
  const result=await jsonResponse(origin+'/api/live-ticket',{method:'POST',headers:{'x-studio-token':bootstrap.token,
    'content-type':'application/json'},body:JSON.stringify({project:candidates[0].key,producer:'native'})});
  return result.ticket;
}

/** Stage one explicit debug connection; never install, select or replace on the user's behalf. */
export async function stageLiveAndroid(input,{adb=executeAdb,issueTicket=issueNativeTicket,
  resolveProject=resolveNativeProject,cwd=process.cwd()}={}) {
  const {device,port}=input,run=(args,stdin)=>adb(['-s',device,...args],stdin);
  requireThat(serialShape.test(device??''),'live.device','Use an exact --device SERIAL.');
  const attached=await adb(['devices','-l']);
  requireThat(attached.code===0,'live.adb','adb devices -l failed. Check the Android SDK and USB authorization.');
  const devices=attached.stdout.split(/\r?\n/u).map(line=>line.match(/^(\S+)\s+device(?:\s|$)/u)?.[1]).filter(Boolean);
  requireThat(devices.length===1,'live.device-count','Exactly one authorized Android device may be attached for this action. Disconnect the others, then retry with --device SERIAL.');
  requireThat(devices[0]===device,'live.device','Selected serial is not the one authorized connected device. Check adb devices -l.');
  const reverse=await run(['reverse','--list']);
  requireThat(reverse.code===0,'live.reverse','Cannot inspect existing adb reverse mappings. No mapping was changed.');
  requireThat(!reverse.stdout.split(/\r?\n/u).some(line=>line.split(/\s+/u).includes(`tcp:${port}`)),
    'live.reverse-owned',`tcp:${port} already has an adb reverse mapping. Do not overwrite it; remove it with its owner first.`);
  const native=await resolveProject(cwd,input.product??null);
  const debug=await run(['shell','run-as',native.packageName,'id']);
  const install=debug.code===0?'':installCommand(cwd,device,native);
  requireThat(debug.code===0&&/\buid=/u.test(debug.stdout),'live.debug-app',
    `A debuggable ${native.packageName} is not installed on ${device}. Install it explicitly: ${install}`);
  const added=await run(['reverse','--no-rebind',`tcp:${port}`,`tcp:${port}`]);
  requireThat(added.code===0,'live.reverse','adb could not create the selected reverse mapping.');
  let ticketWritten=false;
  try{
    const ticket=await issueTicket({port,product:native.product});
    requireThat(typeof ticket==='string'&&/^[A-Za-z0-9_-]{43}$/u.test(ticket),'live.ticket','Studio returned an invalid one-time ticket.');
    const script=`umask 077\nmkdir -p files/studio-observation || exit 1\ntest ! -e ${PRIVATE_TICKET} || exit 1\nprintf '%s' '${ticket}' > ${PRIVATE_TICKET} || exit 1\nchmod 600 ${PRIVATE_TICKET}\n`;
    const staged=await run(['shell','-T','run-as',native.packageName,'sh'],script);
    requireThat(staged.code===0,'live.ticket-write','Could not write the one-time ticket to app-private storage through run-as stdin.');
    ticketWritten=true;
    const started=await run(['shell','am','broadcast','-p',native.packageName,'-a',native.action,'--es','cmd','start','--ei','port',String(port)]);
    requireThat(started.code===0,'live.start','The debug start action was not accepted; no live connection is claimed.');
    return {device,port,package:native.packageName,product:native.product,privateTicket:PRIVATE_TICKET,reverse:`tcp:${port}`,
      ticketStaged:true,startActionSent:true,connected:false,
      notice:'Ticket staged and debug start action sent. Confirm the live receiver before claiming observations.'};
  }catch(error){
    const cleaned=ticketWritten?await run(['shell','run-as',native.packageName,'rm','-f',PRIVATE_TICKET]).catch(()=>({code:1})):null;
    const current=await run(['reverse','--list']).catch(()=>({code:1,stdout:''}));
    const matching=current.stdout.split(/\r?\n/u).map(line=>line.trim().split(/\s+/u))
      .filter(parts=>parts[1]===`tcp:${port}`);
    // adb reverse --list identifies the selected transport as host-N, not necessarily the serial.
    const stillOurs=current.code===0&&matching.length===1&&matching[0][2]===`tcp:${port}`;
    const unmapped=current.code!==0?{code:1}:matching.length===0?{code:0}:stillOurs
      ?await run(['reverse','--remove',`tcp:${port}`]).catch(()=>({code:1})):{code:1};
    requireThat((!ticketWritten||cleaned.code===0)&&unmapped.code===0,'live.cleanup',
      `Connection failed and cleanup was incomplete. Check ${PRIVATE_TICKET} through run-as and ask the owner of tcp:${port} before changing its reverse mapping.`,400,
      {originalError:error.code??'live.operation'});
    throw error;
  }
}
