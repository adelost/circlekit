import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { Workbench } from '../lib/workspaces.mjs';
import { loadContractEvaluator } from '../lib/documentation.mjs';

const [nativeRoot,webRoot,amuxRoot]=process.argv.slice(2).map(p=>path.resolve(p));
assert(nativeRoot&&webRoot&&amuxRoot,'Pass native, web and AMUX checkout roots.');
const evaluateContract=await loadContractEvaluator(amuxRoot);

async function load(root,id) {
  const workbench=new Workbench({dataDir:path.join(os.tmpdir(),'studio-skyvw-smoke'),evaluateContract});
  await workbench.initialize([root],{includeFixtures:false});
  const project=workbench.list().find(p=>p.id===id);
  assert(project,`Missing Studio project ${id}`);
  const loaded=workbench.require(project.key),view=workbench.view(loaded);
  return {workbench,loaded,view};
}

const native=await load(nativeRoot,'skyvw');
assert.equal(native.view.product?.id,'skyvw','Native Studio must load the real generated SKYVW product.');
assert(native.view.architecture.coverage.owners>0&&native.view.architecture.coverage.bindings>0,'Native artifact must expose real owners and bindings.');
const recording=native.view.documentation.contracts.find(c=>c.id==='recording.foreground-ingestion');
assert(recording,'Native recording service WHAT/WHY is missing.');
assert.equal(recording.contract.status,'validated');
assert.match(recording.contract.what,/Routes pressure and position observations/);
assert.match(recording.contract.why,/hidden context stream/);
const recordingEntity=native.view.architecture.entities.find(e=>e.key==='node-type::recording.foreground-ingestion');
assert(recordingEntity,'Native artifact does not contain recording.foreground-ingestion.');
const details=native.workbench.entityDetails({project:native.view.key,bundleDigest:native.view.bundleDigest,entity:recordingEntity.key});
assert.equal(details.entity.intent.typeKey,'node-type::recording.foreground-ingestion');
assert(details.entity.intent.declared?.runtime,'Declared recording runtime was not derived from ProductSpec.');
assert(details.entity.intent.declared.inputs.some(p=>p.id==='pressure'),'Declared pressure input is missing from the service facts.');
const legacy=native.view.documentation.legacy.find(v=>v.id==='LIVE_SHARE');
assert(legacy&&/latest position/.test(legacy.reason),'LIVE_SHARE legacy reason must remain visible and separate.');
assert.equal(native.view.documentation.contracts.some(c=>c.id==='LIVE_SHARE'),false,'Legacy service must not be guessed into a ProductSpec type.');

const web=await load(webRoot,'skyvw-web-logbook');
assert.equal(web.view.product?.kind,'product-spec-graph','Web inspection must stay explicitly narrower than ProductIr.');
assert.equal(web.view.product?.id,'skyvw-web-logbook');
assert.equal(web.view.sourceIdentity?.kind,'matched','Web graph must correlate to the exact exported source digests.');
assert.equal(web.view.compatibility?.inspect,true);
assert.equal(web.view.compatibility?.simulate,false,'ProductSpec 0.3.52 graph must not be simulated by a different Studio kernel.');
const webServices=web.view.documentation.contracts.filter(c=>c.kind==='service');
assert.equal(webServices.length,7,'Expected the seven reviewed SKYVW web service boundaries.');
assert(webServices.every(c=>c.contract.status==='validated'),'Every SKYVW web service WHAT/WHY must pass the shared AMUX grammar.');
const host=web.view.architecture.entities.find(e=>e.key==='node-type::logbook.host');
assert(host,'Web compiled graph is missing logbook.host.');
const hostDetails=web.workbench.entityDetails({project:web.view.key,bundleDigest:web.view.bundleDigest,entity:host.key});
assert(hostDetails.entity.intent.declared?.runtime?.effects?.includes('browser.navigate'),'Web declared facts must expose the real host navigation effect.');

console.log(JSON.stringify({
  native:{product:native.view.productId,owners:native.view.architecture.coverage.owners,bindings:native.view.architecture.coverage.bindings,
    contracts:native.view.documentation.contracts.filter(c=>c.kind==='service').length,legacy:native.view.documentation.legacy.length},
  web:{product:web.view.productId,kind:web.view.product.kind,owners:web.view.architecture.coverage.owners,
    bindings:web.view.architecture.coverage.bindings,contracts:webServices.length,sourceIdentity:web.view.sourceIdentity.kind,
    producer:web.view.compatibility?.producer,evaluator:web.view.compatibility?.evaluator}
},null,2));
