import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { Workbench } from '../lib/workspaces.mjs';
import { loadContractEvaluator } from '../lib/documentation.mjs';

const [webRoot,amuxRoot]=process.argv.slice(2).map(p=>path.resolve(p));
assert(webRoot&&amuxRoot,'Pass web and AMUX checkout roots.');
const evaluateContract=await loadContractEvaluator(amuxRoot);
const workbench=new Workbench({dataDir:path.join(os.tmpdir(),'studio-skyvw-web-smoke'),evaluateContract});
await workbench.initialize([webRoot],{includeFixtures:false});
const project=workbench.list().find(p=>p.id==='skyvw-web-logbook');
assert(project,'Missing SKYVW web Studio project.');
const loaded=workbench.require(project.key),view=workbench.view(loaded);
assert.equal(view.product?.kind,'product-spec-graph','Web inspection must stay explicitly narrower than ProductIr.');
assert.equal(view.product?.id,'skyvw-web-logbook');
assert.equal(view.sourceIdentity?.kind,'matched','Web graph must correlate to exact exported source digests.');
assert.equal(view.compatibility?.inspect,true);
assert.equal(view.compatibility?.simulate,false,'ProductSpec 0.3.52 graph must not be simulated by a different Studio kernel.');
assert(view.architecture.coverage.owners>0&&view.architecture.coverage.bindings>0,'Compiled web graph must expose real owners and bindings.');
const webServices=view.documentation.contracts.filter(c=>c.kind==='service');
assert.equal(webServices.length,7,'Expected the seven reviewed SKYVW web service boundaries.');
assert(webServices.every(c=>c.contract.status==='validated'),'Every SKYVW web service WHAT/WHY must pass the shared AMUX grammar.');
const host=view.architecture.entities.find(e=>e.key==='node-type::logbook.host');
assert(host,'Web compiled graph is missing logbook.host.');
const details=workbench.entityDetails({project:view.key,bundleDigest:view.bundleDigest,entity:host.key});
assert.match(details.entity.intent.contract.contract.what,/Loads authorised records/);
assert(details.entity.intent.declared?.runtime?.effects?.includes('browser.navigate'),'Declared facts must expose the real host navigation effect.');
console.log(JSON.stringify({product:view.productId,kind:view.product.kind,owners:view.architecture.coverage.owners,
  bindings:view.architecture.coverage.bindings,contracts:webServices.length,sourceIdentity:view.sourceIdentity.kind,
  producer:view.compatibility?.producer,evaluator:view.compatibility?.evaluator},null,2));
