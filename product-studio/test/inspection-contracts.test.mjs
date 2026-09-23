import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInspectionBundle } from '../lib/inspection.mjs';
import { digest } from '../lib/util.mjs';

const contract=()=>({entityKey:'node-type::recorder',id:'recorder',kind:'service',symbol:'recorder',source:{file:'src/recorder.ts',digest:digest('source'),line:4,column:1,span:{start:20,end:100}},contract:{what:'Routes recorder commands.',why:'Keeps persistence separate from sensor interpretation.',status:'present'}});
const input=()=>({productId:'example',compiler:{name:'@v1d/product-spec',version:'0.3.65'},sources:[{file:'src/recorder.ts',digest:digest('source')}],contracts:[contract()]});

test('Given documentation-only metadata changes When exporting Then ProductIr and model identity stay unchanged',()=>{
  const a=createInspectionBundle(input());const changed=input();changed.contracts[0].contract.why='Keeps storage failures outside presentation.';
  const b=createInspectionBundle(changed);
  assert.equal(a.contracts[0].id,'recorder');assert.equal(a.modelDigest,b.modelDigest);assert.notEqual(a.bundleDigest,b.bundleDigest);assert.deepEqual(a.product,b.product);
});
for(const [name,mutate] of [
  ['source hash mismatch',v=>v.contracts[0].source.digest=digest('different')],
  ['unknown source',v=>v.contracts[0].source.file='src/other.ts'],
  ['duplicate entity keys',v=>v.contracts.push(contract())],
  ['invalid status',v=>v.contracts[0].contract.status='runtime-proven'],
  ['wrong entity identity',v=>v.contracts[0].entityKey='node::instance'],
  ['invalid source span',v=>v.contracts[0].source.span.end=10],
])test(`Given ${name} When exporting contracts Then the inspection is refused`,()=>{const v=input();mutate(v);assert.throws(()=>createInspectionBundle(v));});
test('Given a legacy bundle without contracts When decoding Then the optional extension is not required',()=>{
  const v=input();delete v.contracts;assert.doesNotThrow(()=>createInspectionBundle(v));
});
