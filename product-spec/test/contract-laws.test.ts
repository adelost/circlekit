import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertContractPayload, compileProductGraph, field,
  port, portContracts, service, type LegoContract } from '../src/index.js';
import { createObservationScope } from '../src/observation.js';
import { boxPx, imageSizePx, normalizeXywh, normalizeYolo, visionContracts, xyxyPx,
  xywhPx, yoloRatio } from '../src/examples/vision-box.js';

const runtime={stateOwner:'none',lifetime:'call',durability:'transient',clockDomain:'none',
  contextInputs:[],effects:['vision.call']} as const;
function graphFor(sourceContract:LegoContract,targetContract:LegoContract) {
  const source=service({id:'vision.source',inputs:[],outputs:[port('value',sourceContract)],runtime});
  const sink=service({id:'vision.sink',inputs:[port('value',targetContract)],outputs:[],runtime});
  return compileProductGraph({nodeTypes:[source,sink],nodes:[
    {id:'vision.source',nodeTypeRef:source.id,config:{},bindings:{},
      activation:{kind:'lifetime',lifecycleSources:[]}},
    {id:'vision.sink',nodeTypeRef:sink.id,config:{},bindings:{value:'vision.source.value'},
      activation:{kind:'lifetime',lifecycleSources:[]}},
  ],configs:[],componentTypes:[],components:[],mountedScopes:[]});
}

test('U6 direct YOLO to pixel box and ratio in a pixel port are refused',()=>{
  assert.throws(()=>graphFor(yoloRatio,boxPx),/incompatible ports.*vision.source.value.*vision.sink.value/u);
  const ratioCorners={...xyxyPx,id:'vision.xyxy.ratio',fields:[
    field('left','number',{unit:'ratio'}),field('top','number',{unit:'ratio'}),
    field('right','number',{unit:'ratio'}),field('bottom','number',{unit:'ratio'}),
  ]} as const;
  assert.throws(()=>graphFor(ratioCorners,boxPx),/incompatible ports/u);
});

test('U6 the three declared normalizers yield the one pixel box format',()=>{
  assert.deepEqual(normalizeXywh({x:10,y:20,width:30,height:40}),{left:10,top:20,right:40,bottom:60});
  assert.deepEqual(normalizeYolo({cx:.5,cy:.5,w:.2,h:.4},{width:100,height:50}),
    {left:40,top:15,right:60,bottom:35});
  assert.equal(visionContracts.length,5);
});

test('U6 a broken ratio law names its authored contract field',()=>{
  assert.throws(()=>assertContractPayload(yoloRatio,{cx:.5,cy:.5,w:1.2,h:.1}),
    /vision\.yolo\.cxcywh\.ratio.*w.*0\.\.1.*vision-box\.ts:\d+/u);
});

// One generated law proof per authored contract. Cases come from the fields, not a copied registry.
for(const contract of visionContracts) test(`${contract.id} generates a positive and every negative field-law case`,()=>{
  const valid:Record<string,string|number|boolean>=Object.fromEntries(contract.fields.map(item=>[item.name,
    item.value==='boolean'?false:item.value==='string'?'ok':item.min??0.5]));
  for(const item of contract.fields)if(item.gteField)valid[item.name]=valid[item.gteField]!;
  assert.doesNotThrow(()=>assertContractPayload(contract,valid));
  let cases=0;
  for(const item of contract.fields){
    for(const [condition,value] of [[item.min,item.min===undefined?null:item.min-1],
      [item.max,item.max===undefined?null:item.max+1]] as const){
      if(condition===undefined)continue;
      assert.throws(()=>assertContractPayload(contract,{...valid,[item.name]:value}),
        error=>error instanceof Error&&error.message.includes(contract.id)&&error.message.includes(item.name));cases++;
    }
    if(item.gteField){
      assert.throws(()=>assertContractPayload(contract,{...valid,[item.name]:(valid[item.gteField!] as number)-1}),
        error=>error instanceof Error&&error.message.includes(contract.id)&&error.message.includes(item.name));cases++;
    }
  }
  assert.ok(cases>0,`${contract.id} declared no law to prove`);
});

test('U6 test recording refuses a broken payload; debug-live reports it without changing the return',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'contract-record-'));
  const previous=process.env.V1D_STUDIO_TRACE_DIR;
  process.env.V1D_STUDIO_TRACE_DIR=dir;
  t.after(async()=>{if(previous===undefined)delete process.env.V1D_STUDIO_TRACE_DIR;
    else process.env.V1D_STUDIO_TRACE_DIR=previous;await rm(dir,{recursive:true,force:true});});
  const {bindPortImplementations:recordPorts}=await import('../src/studio-trace.js');
  const contracts=portContracts(graphFor(yoloRatio,yoloRatio).portRegistry);
  const broken={cx:.5,cy:.5,w:1.2,h:.1};
  const ordinary={'vision.source.value':()=>broken};
  const recorded=recordPorts(ordinary,contracts);
  assert.throws(()=>recorded['vision.source.value'](),/vision.yolo.cxcywh.ratio.*w.*0.*1/u);
  const failures:Error[]=[],events:unknown[]=[];
  const observed=createObservationScope({onObservation:event=>events.push(event),onFailure:error=>failures.push(error as Error)});
  const live=observed.bindPortImplementations(ordinary,contracts);
  assert.equal(live['vision.source.value'](),broken);
  assert.match(failures[0]!.message,/vision.yolo.cxcywh.ratio.*w.*0.*1/u);
  assert.equal(events.length,1);
});
