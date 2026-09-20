// Independent oracle over actual AMUX policy authoring, not the ProductSpec compiler.
// Usage: node check-amux-enumeration.mjs /path/to/agentmux/policies/context-cost.mjs
// Only a reviewed local policy file should be passed. No network, compact or launch effects.
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const path=process.argv[2];
if(!path) throw Error('Provide the local policies/context-cost.mjs path');
const raw=fs.readFileSync(path), source=raw.toString('utf8');
const expectedImport='import { choice, decide, defineDecisionTable, on } from "@v1d/product-spec";';
if(!source.startsWith(expectedImport)) throw Error('Policy import changed: inspect before adapting this isolated probe');
const points=(axes)=>Object.entries(axes).reduce((out,[k,vs])=>out.flatMap(p=>vs.map(v=>({...p,[k]:v}))),[{}]);
const covers=(region,p)=>Object.entries(region).every(([k,v])=>Array.isArray(v)?v.includes(p[k]):v===p[k]);
const oracle=(table,p)=>{
 const cells=table.cells.filter(c=>covers(c.region,p));
 assert.equal(cells.length,1,`${table.id}: coverage at ${JSON.stringify(p)}`);
 return {at:p,cell:cells[0].id,values:cells[0].values};
};
// These four small collaborators capture data and independently enumerate it.
// They deliberately do NOT claim ProductSpec validation, freezing, typing or emission.
const capture={choice:values=>({kind:'choice',values}), on:(id,region,values)=>({id,region,values}),
 defineDecisionTable:x=>x, decide:oracle};
const code=source.slice(expectedImport.length).replace(/^export /gm,'')+
 '\n;globalThis.result={contextCostDeclaration,codexLaunchRules,contextCostDecision,CONTEXT_COST_POLICY};';
const ctx=vm.createContext(capture);
vm.runInContext(code,ctx,{timeout:1000});
const {contextCostDeclaration:context,codexLaunchRules:launch,contextCostDecision,CONTEXT_COST_POLICY}=ctx.result;
const renames=[{need:'compactionNeed',readiness:'compactionSafety',attempt:'compactAttempt'},
 {identity:'sessionKnowledge',selection:'modelChange',receipt:'compactReceipt',blocked:'transitionBlocked'}];
const checks=[];
const run=(id,fn)=>{try{checks.push({id,passed:true,observed:fn()});}catch(e){checks.push({id,passed:false,error:String(e)});}};
for(const [i,table] of [context,launch].entries()) {
 run(`${table.id}.all-points-and-invariants`,()=>{
  for(const p of points(table.axes)) { const d=oracle(table,p); for(const inv of table.invariants) assert.equal(inv.when(d),false,inv.refuse); }
  return {points:points(table.axes).length,cells:table.cells.length};
 });
 run(`${table.id}.rename-parity`,()=>{
  const map=renames[i],rename=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[map[k],v]));
  const candidate={...table,axes:rename(table.axes),cells:table.cells.map(c=>({...c,region:rename(c.region)}))};
  for(const p of points(table.axes)) {
   const a=oracle(table,p),b=oracle(candidate,rename(p));
   assert.equal(b.cell,a.cell);assert.deepEqual(b.values,a.values);
   const oldPoint=Object.fromEntries(Object.entries(map).map(([old,newKey])=>[old,b.at[newKey]]));
   for(const inv of table.invariants) assert.equal(inv.when({...b,at:oldPoint}),false,inv.refuse);
  }
  return {points:points(table.axes).length,note:'Axis mapping only. A real code migration and installed compiler run remain required.'};
 });
}
run('adapter-current-threshold',()=>{
 const limit=CONTEXT_COST_POLICY.maxTokens;
 assert.equal(contextCostDecision({tokens:limit,idleMs:600000,safe:true}).values.action,'CONTINUE');
 assert.equal(contextCostDecision({tokens:limit+1,idleMs:600000,safe:true}).values.action,'COMPACT');
 assert.equal(contextCostDecision({tokens:NaN,idleMs:600000,safe:true}).values.action,'HOLD');
 return {maxTokens:limit};
});
run('rename-must-preserve-NONE-plus-FAILED',()=>{
 const witness=oracle(context,{need:'NONE',readiness:'SAFE',attempt:'FAILED'});
 assert.equal(witness.values.action,'CONTINUE');
 return witness;
});
run('omitted-axis-is-not-future-state-refusal',()=>{
 const expanded={...context,axes:{...context.axes,newContext:['A','B']}};
 for(const p of points(expanded.axes)) oracle(expanded,p);
 return {points:points(expanded.axes).length,note:'Independent enumeration confirms omitted-axis wildcard semantics, not compiler execution.'};
});
const report={git_blob:createHash('sha1').update(`blob ${raw.length}\0`).update(raw).digest('hex'),
 scope:'Exact policy text; recording collaborators substitute ProductSpec import. Independent 42-point enumeration and adapter probes, NOT installed DSL/runtime.',
 node:process.version,checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length};
console.log(JSON.stringify(report,null,2));
process.exitCode=report.failed?1:0;
