import test from 'node:test';
import assert from 'node:assert/strict';
import { documentationView, intentPanel } from '../public/documentation.js';
const E=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const p={bundleDigest:'abc',sources:[{path:'src/type.ts'}],documentation:{scope:{files:1,services:1,complete:true,sourceRoots:['src']}}};
const c={id:'type',entityKey:'node-type::type',contract:{what:'Routes <img onerror=bad()>',why:'Keeps <script>bad()</script> out.',status:'present'},validation:'presence-only',correlation:'source-only',source:{file:'src/type.ts',line:2}};
test('Given untrusted comment text When displaying Then markup is escaped and unvalidated source stays labelled',()=>{
  const html=documentationView(p,{documentationPage:{ticket:'abc:contracts:0',value:{section:'contracts',rows:[c],total:1,offset:0,nextOffset:null,scope:p.documentation.scope}}},E);
  assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(html.includes('&lt;script&gt;'));
  assert(html.includes('wording not evaluated'));assert(html.includes('source-only'));
});
test('Given a stale page response When displaying Then it cannot replace the current page',()=>{
  const html=documentationView(p,{documentationPage:{ticket:'old:contracts:0',value:{rows:[c]}}},E);
  assert(html.includes('Loading selected documentation'));assert(!html.includes('Routes'));
});
test('Given missing test evidence When displaying an entity Then no service pass is invented',()=>{
  const html=intentPanel({typeKey:'node-type::type',contract:c,declared:null,tests:[],testTotal:0,notice:'Source reference only.'},p,E);
  assert(html.includes('No test-body source associations'));assert(!html.includes('✓'));
});
