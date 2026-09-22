// Explicit test process only. Loads the pinned AMUX grammar, never the bridge.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadContractEvaluator, checkWorkspaceContracts, readDocumentationInputs } from '../lib/documentation.mjs';
import { scanSourceContracts } from '../lib/service-contracts.mjs';
const root=process.argv[2];assert(root,'Pass the AMUX checkout as the only argument.');
const evaluateContract=await loadContractEvaluator(root);
const good=[
 ['Routes capture commands to the recording owner.','Keeps microphone effects outside conversation delivery.'],
 ['Stores user settings and exposes their current values.','Keeps persistence details outside domain calculations and presentation.'],
 ['Reads device battery observations.','Keeps platform manager access outside battery presentation.'],
 ['Reports runtime execution incidents.','Keeps failure receipts separate from restart policy.'],
 ['Fetches current weather observations.','Keeps network lifecycle outside presentation code.'],
 ['Reads build distribution capabilities.','Keeps native configuration outside feature presentation.'],
 ['Schedules provider refresh requests.','Keeps acquisition cadence separate from page visibility.'],
 ['Dispatches pending network requests.','Keeps transport effects outside scheduling decisions.'],
 ['Tracks active position subscriptions.','Keeps physical acquisition separate from durable HOME state.'],
 ['Stores the user selected HOME reference.','Keeps persisted coordinates independent from physical GPS subscriptions.'],
 ['Routes playback commands to the media owner.','Keeps document mutations outside rendering decisions.'],
 ['Maps backend progress into activity presentation.','Keeps job ownership outside frontend status rendering.'],
];
const bad=[
 ['Handles things.','Makes everything nice.'],
 ['Manages weather.','Keeps weather clean and simple.'],
 ['This helper stores settings.','This exists to manage settings.'],
 ['Responsible for recordings.','Used to record things.'],
 ['Stores state.','Stores state.'],
 ['A service for data.','Provides a way to handle data.'],
];
for(const [what,why] of good)assert.deepEqual(evaluateContract(`WHAT: ${what}\nWHY: ${why}`,{kind:'service'}),[],what);
for(const [what,why] of bad)assert(evaluateContract(`WHAT: ${what}\nWHY: ${why}`,{kind:'service'}).length,what);
const prefix="import {service as svc} from '@v1d/product-spec';\n";
const undocumented=scanSourceContracts([{path:'service.ts',text:prefix+"const s=svc({id:'s'});"}],{evaluateContract});
assert(undocumented.diagnostics.some(d=>d.rule==='contract.missing'));
const documented=scanSourceContracts([{path:'service.ts',text:prefix+`/** WHAT: ${good[0][0]}\n * WHY: ${good[0][1]} */\nconst s=svc({id:'s'});`}],{evaluateContract});
assert.equal(documented.contracts[0].contract.status,'validated');
console.log(JSON.stringify({corpus:{good:good.length,bad:bad.length},scannerMutation:{missing:'rejected',documented:'validated'}}));
const report=await checkWorkspaceContracts(root,{evaluateContract});
console.log(JSON.stringify({owner:'AMUX',projects:report.projects.map(p=>({id:p.id,services:p.serviceCount,complete:p.complete,ok:p.ok,diagnostics:p.diagnostics}))}));
const kit=path.resolve(import.meta.dirname,'../..');
for(const sourceRoot of ['skydiving-legos/src','link-product/src','showcase-product/src']) {
 const inputs=await readDocumentationInputs(kit,{sourceRoots:[sourceRoot]});
 const scan=scanSourceContracts(inputs.sources,{evaluateContract});
 console.log(JSON.stringify({owner:sourceRoot,files:scan.files,services:scan.serviceCount,complete:scan.complete,diagnostics:[...inputs.diagnostics,...scan.diagnostics],contracts:scan.contracts.map(c=>({id:c.id,file:c.source.file,line:c.source.line,status:c.contract.status}))}));
}
assert(report.ok,'The actual AMUX companion sources must pass the same scanner and grammar.');
