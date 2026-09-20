// Worker-side smoke probe against an ACTUALLY INSTALLED public ProductSpec entry.
// Not run in this review: package download was blocked by DNS.
// Usage: node check-decision-contracts.mjs file:///.../node_modules/@v1d/product-spec/dist/src/index.js
// Obtain that URL with import.meta.resolve('@v1d/product-spec') in the consumer directory.
// No model, native process, network or app writes. This does NOT replace repo/compiler suites.
import assert from 'node:assert/strict';
const entry=process.argv[2];
if(!entry || !entry.startsWith('file:')) throw Error('Pass the installed public entry URL resolved in the consumer');
const {defineDecisionTable,on,choice,decide,decisionPoints}=await import(entry);
const checks=[];
const run=(id,fn)=>{try{fn();checks.push({id,passed:true});}catch(e){checks.push({id,passed:false,error:String(e)});}};
const declare=()=>({id:'review.permission',axes:{bound:['YES','NO'],fresh:['YES','NO']},
 columns:{action:choice(['APPLY','HOLD'])},cells:[
 on('unbound',{bound:'NO'},{action:'HOLD'}),
 on('stale',{bound:'YES',fresh:'NO'},{action:'HOLD'}),
 on('apply',{bound:'YES',fresh:'YES'},{action:'APPLY'})]});
run('complete-table',()=>{
 const t=defineDecisionTable(declare()); assert.equal(decisionPoints(t.axes).length,4);
 assert.equal(decide(t,{bound:'YES',fresh:'YES'}).values.action,'APPLY');
});
run('missing-cell-refused',()=>{const d=declare();d.cells.pop();assert.throws(()=>defineDecisionTable(d),/no cell covers/);});
run('overlap-refused',()=>{const d=declare();d.cells.push(on('too-wide',{}, {action:'HOLD'}));assert.throws(()=>defineDecisionTable(d),/covered by/);});
run('unknown-input-refused',()=>{const t=defineDecisionTable(declare());assert.throws(()=>decide(t,{bound:'MAYBE',fresh:'YES'}));});
run('omitted-new-axis-stays-covered',()=>{
 const d=declare();d.axes.extra=['A','B'];const t=defineDecisionTable(d);
 assert.equal(decisionPoints(t.axes).length,8);
 assert.equal(decide(t,{bound:'YES',fresh:'YES',extra:'B'}).values.action,'APPLY');
});
console.log(JSON.stringify({entry,scope:'Installed public DSL smoke probe only',checks},null,2));
process.exitCode=checks.some(c=>!c.passed)?1:0;
