import {createServer} from '../server.mjs';
import {createLiveTraceRecorder,decodeTrace} from '../lib/trace.mjs';

const root=process.argv[2],port=Number(process.argv[3]??4333);
if(!root)throw new Error('Pass a read-only product checkout path.');
const running=await createServer({roots:[root],port});
const project=running.app.list().find(item=>item.id==='skyvw');
if(!project)throw new Error('The selected checkout has no SKYVW Studio project.');
const owner=running.app.require(project.key),view=running.app.view(owner);
const machine=view.facets.find(facet=>facet.id==='recording.session');
if(!machine)throw new Error('The compiled recording.session facet is unavailable.');
const writer=createLiveTraceRecorder(view,{id:'fixture-recording',scope:{events:['transition'],facets:[machine.id],appliedTransitions:true},buildId:'local-fixture'});
const entityKey='facet:machine:recording.session';
const observed=(sequence,phase,logic)=>({sequence,atMs:sequence*1000,kind:'transition',phase,entityKey,instanceId:'fixture-one',logic,
  summary:phase==='applied'?'Fixture applied in memory':'Fixture evaluated'});
const start={facetId:machine.id,cellId:'start-armed',from:'STOPPED',to:'ARMED',input:'Start',guards:{START_NOW:false}};
const record={facetId:machine.id,cellId:'record-now-armed',from:'ARMED',to:'RECORDING',input:'RecordNow',guards:{}};
const publish=()=>{owner.trace=decodeTrace(JSON.stringify(writer.snapshot()),view);};
publish();
const commands={
  first(){writer.append({through:1,events:[observed(0,'evaluated',start),observed(1,'applied',start)]});publish();},
  second(){writer.append({through:4,events:[observed(3,'evaluated',record),observed(4,'applied',{...record,to:'STOPPED'})],
    gaps:[{from:2,to:2,reason:'fixture-loss'}]});publish();},
  end(){writer.end(writer.snapshot().capture.through);publish();},
};
process.stdin.setEncoding('utf8');
process.stdin.on('data',text=>{
  for(const command of text.trim().split(/\s+/u))try{commands[command]?.();console.log(JSON.stringify({command,events:owner.trace.events.length,
    dropped:owner.trace.truncation.gaps.length,ending:owner.trace.capture.ending}));}
  catch(error){console.error(error.message);}
});
process.on('SIGINT',()=>{running.server.closeAllConnections();running.server.close(()=>process.exit(0));});
console.log(`Studio fixture: ${running.origin} | project ${project.key} | commands: first, second, end`);
