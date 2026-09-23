import WebSocket from 'ws';
import {createServer} from '../server.mjs';

const root=process.argv[2],port=Number(process.argv[3]??4333);
if(!root)throw new Error('Pass a read-only product checkout path.');
const running=await createServer({roots:[root],port,liveEnabled:true});
const project=running.app.list().find(item=>item.id==='skyvw');
if(!project)throw new Error('The selected checkout has no SKYVW Studio project.');
const view=running.app.view(running.app.require(project.key));
const machine=view.facets.find(facet=>facet.id==='recording.session');
if(!machine)throw new Error('The compiled recording.session facet is unavailable.');
const identity=view.artifactSha256?{artifactSha256:view.artifactSha256}:{modelDigest:view.modelDigest};
const raw=(sequence,phase,logic)=>({sequence,atMs:sequence*1000,kind:'transition',phase,instanceId:'fixture-one',...logic});
const start={facetId:machine.id,cellId:'start-armed',from:'STOPPED',to:'ARMED',input:'Start',guards:{START_NOW:false}};
const record={facetId:machine.id,cellId:'record-now-armed',from:'ARMED',to:'RECORDING',input:'RecordNow',guards:{}};
let socket=null;
const reply=message=>new Promise((resolve,reject)=>{
  socket.once('message',bytes=>resolve(JSON.parse(bytes.toString())));
  socket.send(JSON.stringify(message),error=>error&&reject(error));
});
async function connect(id){
  const {ticket}=running.live.issueTicket({project:project.key,producer:'node'});
  socket=new WebSocket(running.origin.replace('http:','ws:')+'/runtime/v1','v1d-runtime.v1');
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const welcome=await reply({type:'hello',protocol:1,ticket,productId:view.productId,identity,
    productSpecVersion:view.toolVersions.productSpec,captureId:id,buildId:'local-fixture',
    scope:{events:['transition'],facets:[machine.id],appliedTransitions:true}});
  if(welcome.type!=='welcome')throw new Error(welcome.code??'Fixture pairing failed.');
}
await connect('fixture-recording');
const commands={
  first:()=>reply({type:'batch',through:1,events:[raw(0,'evaluated',start),raw(1,'applied',start)],dropped:[]}),
  second:()=>reply({type:'batch',through:4,events:[raw(3,'evaluated',record),raw(4,'applied',{...record,to:'STOPPED'})],
    dropped:[{from:2,to:2,reason:'fixture-loss'}]}),
  end:()=>reply({type:'end',through:4}),
  next:async()=>{await connect('fixture-followup');return reply({type:'batch',through:1,
    events:[raw(0,'evaluated',start),raw(1,'applied',start)],dropped:[]});},
};
process.stdin.setEncoding('utf8');
process.stdin.on('data',async text=>{
  for(const command of text.trim().split(/\s+/u))try{
    const result=await commands[command]?.();
    console.log(JSON.stringify({command,type:result?.type,status:running.live.status(project.key)}));
  }catch(error){console.error(error.message);}
});
process.on('SIGINT',()=>{socket?.close();running.server.closeAllConnections();running.server.close(()=>process.exit(0));});
console.log(`Studio live fixture: ${running.origin} | project ${project.key} | commands: first, second, end, next`);
