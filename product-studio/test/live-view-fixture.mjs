import WebSocket from 'ws';

const origin=process.argv[2]??'http://127.0.0.1:4333';
const bootstrap=await(await fetch(origin+'/api/bootstrap')).json();
const project=bootstrap.projects.find(item=>item.id==='skyvw');
if(!project)throw new Error('The selected checkout has no SKYVW Studio project.');
const headers={'x-studio-token':bootstrap.token};
const view=await(await fetch(origin+'/api/project?id='+encodeURIComponent(project.key)+'&mode=summary',{headers})).json();
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
  const response=await fetch(origin+'/api/live-ticket',{method:'POST',headers:{...headers,'content-type':'application/json'},
    body:JSON.stringify({project:project.key,producer:'node'})});
  if(!response.ok)throw new Error('The local Studio receiver refused fixture pairing.');
  const {ticket}=await response.json();
  socket=new WebSocket(origin.replace('http:','ws:')+'/runtime/v1','v1d-runtime.v1');
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
    const status=await(await fetch(origin+'/api/live-status?project='+encodeURIComponent(project.key),{headers})).json();
    console.log(JSON.stringify({command,type:result?.type,status}));
  }catch(error){console.error(error.message);}
});
process.on('SIGINT',()=>{socket?.close();process.exit(0);});
console.log(`Studio live fixture: ${origin} | project ${project.key} | commands: first, second, end, next`);
