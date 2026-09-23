import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSourceContracts } from '../lib/service-contracts.mjs';
const evaluateContract=()=>[];
const scan=text=>scanSourceContracts([{path:'product.ts',text}],{evaluateContract});
const doc='/** WHAT: Routes wake detections to the status boundary. WHY: Keeps microphone effects outside conversation delivery. */';

test('real AMUX one-line WHAT and WHY are separate tags, not a missing WHY',()=>{
  const r=scan(`import {service} from '@v1d/product-spec';\n${doc}\nconst wake=service({id:'wake'});`);
  assert.deepEqual(r.diagnostics,[]);
  assert.equal(r.contracts[0].contract.what,'Routes wake detections to the status boundary.');
  assert.equal(r.contracts[0].contract.status,'validated');
});
test('optional non-service documentation cannot introduce a new service authoring obligation',()=>{
  const r=scan("import {defineDecisionTable} from '@v1d/product-spec';\n/** WHAT: Builds the current policy. */\nconst table=defineDecisionTable({id:'policy'});");
  assert.equal(r.serviceCount,0);
  assert.equal(r.diagnostics.filter(d=>d.severity==='error'||d.severity==='warning').length,0);
});
test('a const declaration argument keeps its exact literal identity',()=>{
  const r=scan(`import {service} from '@v1d/product-spec';\nconst declaration={id:'wake'} as const;\n${doc}\nconst wake=service(declaration);`);
  assert.equal(r.contracts[0].id,'wake');
  assert.deepEqual(r.diagnostics,[]);
});
test('a documented factory is checked at the real service call without inventing a product ID',()=>{
  const r=scan("import {service} from '@v1d/product-spec';\nexport function makeWake(product:string){\n"+doc+"\nconst wake=service({id:`${product}.wake`});return wake;}");
  assert.equal(r.serviceCount,1);
  assert.equal(r.contracts[0].contract.status,'validated');
  assert.equal(r.contracts[0].entityKey,null);
  assert.equal(r.complete,true);
  assert.equal(r.identityComplete,false);
  assert.equal(r.diagnostics.filter(d=>d.severity==='error'||d.severity==='warning').length,0);
});
test('an undocumented factory still fails at its actual service declaration',()=>{
  const r=scan("import {service} from '@v1d/product-spec'; function make(product){return service({id:`${product}.wake`});}");
  assert(r.diagnostics.some(d=>d.rule==='contract.missing'&&d.severity==='error'));
});
