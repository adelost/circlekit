import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanSourceContracts } from '../lib/service-contracts.mjs';

const doc = `/**\n * WHAT: Routes recording commands to the session owner.\n * WHY: Keeps recorder effects outside sensing and presentation.\n */`;
const pre = `import { service, derive } from '@v1d/product-spec';\n`;
const scan = source => scanSourceContracts([{path:'src/services.ts',text:source}]);

test('Given an undocumented private service When scanning Then authoring fails',()=>{
  const r=scan(pre+`const hidden=service({id:'hidden'});`);
  assert.equal(r.contracts.length,1); assert.equal(r.contracts[0].contract.status,'missing');
  assert.ok(r.diagnostics.some(d=>d.rule==='contract.missing'));
});
test('Given a service with intent When scanning Then source identity and type own the contract',()=>{
  const r=scan(pre+doc+`\nexport const recording=service({id:'recording.runtime'});`);
  assert.equal(r.diagnostics.length,0);const c=r.contracts[0];
  assert.equal(c.entityKey,'node-type::recording.runtime');assert.equal(c.source.line,6);
  assert.equal(c.contract.what,'Routes recording commands to the session owner.');
  assert.equal(c.contract.status,'present');assert.match(c.source.digest,/^[a-f0-9]{64}$/);
});
for(const [name,source] of [
  ['import alias',`import {service as svc} from '@v1d/product-spec';\n${doc}\nconst s=svc({id:'s'});`],
  ['namespace',`import * as ps from '@v1d/product-spec';\n${doc}\nconst s=ps.service({id:'s'});`],
  ['const alias',pre+`const svc=service;\n${doc}\nconst s=svc({id:'s'});`],
  ['satisfies and parentheses',pre+doc+`\nconst s=(service(({id:'s'} as const) satisfies Options));`],
  ['default export',pre+doc+`\nexport default service({id:'s'});`],
])test(`Given ${name} When scanning Then exactly one documented service is found`,()=>{
  const r=scan(source);assert.equal(r.contracts.length,1);assert.equal(r.contracts[0].contract.status,'present');assert.deepEqual(r.diagnostics,[]);
});
test('Given a shadowed import or unrelated function When scanning Then neither is ProductSpec',()=>{
  const r=scan(pre+`function f(service: Function){return service({id:'not-product'});}\n`+
   `const other={service(x){return x}};other.service({id:'also-not-product'});`);
  assert.equal(r.contracts.length,0);assert.equal(r.diagnostics.length,0);
});
test('Given a documented service factory with a computed ID When scanning Then intent is checked but identity stays explicit',()=>{
  const r=scan(pre+doc+`\nfunction make(id:string){return service({id});}`);
  assert.ok(r.diagnostics.some(d=>d.rule==='contract.service.id'&&d.severity==='info'));
  assert.equal(r.complete,true);assert.equal(r.identityComplete,false);
  assert.equal(r.contracts[0].contract.status,'present');
});
test('Given an escaped constructor When scanning Then callback-based services cannot disappear',()=>{
  const r=scan(pre+`const all=options.map(service);`);
  assert.ok(r.diagnostics.some(d=>d.rule==='contract.service.escape'));assert.equal(r.complete,false);
});
test('Given reused IDs When scanning Then neither location is arbitrarily selected',()=>{
  const r=scan(pre+doc+`\nconst a=service({id:'s'});\n`+doc+`\nconst b=service({id:'s'});`);
  assert.ok(r.diagnostics.some(d=>d.rule==='contract.duplicate'));assert.equal(r.complete,false);
});
test('Given prose on a neighboring declaration When scanning Then it cannot document another service',()=>{
  const r=scan(pre+doc+`\nconst unrelated=123;\nconst s=service({id:'s'});`);
  assert.equal(r.contracts[0].contract.status,'missing');
});
test('Given two declarations sharing one comment When scanning Then ambiguity is not accepted',()=>{
  const r=scan(pre+doc+`\nconst a=service({id:'a'}), b=service({id:'b'});`);
  assert.ok(r.contracts.every(c=>c.contract.status!=='present'));
});
test('Given a DTO or debt tag on a service When scanning Then WHAT and WHY are still mandatory',()=>{
  for(const tag of ['DTO: Carries a payload.','REFACTOR: Replace this owner.']){
    const r=scan(pre+`/** ${tag} */\nconst s=service({id:'s'});`);
    assert.ok(r.diagnostics.some(d=>d.rule==='contract.missing'));
  }
});
test('Given repeated tags When scanning Then ambiguous wording is rejected',()=>{
  const r=scan(pre+doc.replace(' * WHY:', ' * WHAT: Stores other data.\n * WHY:')+`\nconst s=service({id:'s'});`);
  assert.ok(r.diagnostics.some(d=>d.rule==='contract.tags'));
});
test('Given an evaluator When scanning Then its original findings determine validation',()=>{
  const input=pre+doc+`\nconst s=service({id:'s'});`;
  const r=scanSourceContracts([{path:'s.ts',text:input}],{evaluateContract:(raw,meta)=>{
    assert.ok(!raw.includes('*'));assert.equal(meta.kind,'service');
    return [{code:'CONTRACT060',sev:'warn',msg:'Existing grammar warning'}];
  }});
  assert.equal(r.contracts[0].contract.status,'invalid');assert.equal(r.diagnostics[0].severity,'warning');
});
test('Given derive and present declarations When scanning Then no service-specific obligation is added',()=>{
  const r=scan(pre+`const d=derive({id:'d'});`);assert.equal(r.contracts.length,0);assert.deepEqual(r.diagnostics,[]);
});
test('Given syntax errors When scanning Then an empty result cannot be reported as complete',()=>{
  assert.equal(scan(pre+`const s=service({`).complete,false);
});
test('Given legacy scheduled-service copy When scanning Then it remains separate from ProductSpec intent',()=>{
  const r=scan(`export const services=[{id:'LIVE_SHARE',runs:{kind:'CLOCK'},reason:'Sends positions every five seconds.'}];`);
  assert.equal(r.legacy.length,1);assert.equal(r.legacy[0].id,'LIVE_SHARE');assert.equal(r.contracts.length,0);
});

test('Given a namespace alias When discovering Then actual imported services still require intent',()=>{
  const r=scanSourceContracts([{path:'app.ts',text:"import * as ps from '@v1d/product-spec'; const api=ps; const a=api.service({id:'a'});"}]);
  assert.equal(r.serviceCount,1);assert(r.diagnostics.some(d=>d.rule==='contract.missing'));
});
test('Given computed namespace construction When discovering Then the scope is not called complete',()=>{
  const r=scanSourceContracts([{path:'app.ts',text:"import * as ps from '@v1d/product-spec'; const k=getName(); const a=ps[k]({id:'a'});"}]);
  assert.equal(r.complete,false);assert(r.diagnostics.some(d=>d.rule==='contract.service.escape'));
});
test('Given one comment for two array members When discovering Then a shared comment is not two type contracts',()=>{
  const r=scanSourceContracts([{path:'app.ts',text:"import { service } from '@v1d/product-spec';\n/** WHAT: Stores recorded sessions.\n * WHY: Keeps persistence separate from presentation. */\nconst both=[service({id:'a'}),service({id:'b'})];"}]);
  assert.equal(r.contracts.filter(c=>c.contract.status==='present').length,0);
});
