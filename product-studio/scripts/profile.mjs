/** Local measurement only. Run manually; no release/CI gate and no baseline claims. */
import { performance } from 'node:perf_hooks';
import { architectureOf, queryArchitecture, entityKey } from '../lib/architecture.mjs';
import { freezeData } from '../lib/snapshot.mjs';
const samples = [];
for (const count of [100,1000]) {
 const product={nodes:Array.from({length:count},(_,i)=>({id:'node'+i,nodeTypeRef:'type'})),nodeTypes:[{id:'type',kind:'service'}],components:[],componentTypes:[],artifacts:[],
  portRegistry:{nodePorts:Array.from({length:count},(_,i)=>['in','out'].map(port=>({ref:`node${i}.${port}`,ownerId:'node'+i,purpose:'data'}))).flat(),componentPorts:[],bindings:[]}};
 for(let i=0;i<count;i++)for(let step=1;step<=5;step++)if(i+step<count)product.portRegistry.bindings.push({from:`node${i}.out`,to:`node${i+step}.in`});
 const builds=[],queries=[];
 for(let run=0;run<3;run++) {
  let start=performance.now();const graph=freezeData(architectureOf(product));builds.push(performance.now()-start);
  start=performance.now();for(let q=0;q<20;q++)queryArchitecture(graph,{kind:'path',from:entityKey('node','node0'),to:entityKey('node','node'+(count-1))});queries.push((performance.now()-start)/20);
 }
 const median=n=>[...n].sort((a,b)=>a-b)[1];
 samples.push({owners:count,bindings:product.portRegistry.bindings.length,medianBuildMs:median(builds),meanQueryMedianMs:median(queries)});
}
console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,samples,memory:process.memoryUsage(),
 notice:'Synthetic CPU measurements, not browser latency or native product correctness. Compare on the same machine and installed dependency set.'},null,2));
