import assert from 'node:assert/strict';
import test from 'node:test';
import { defineMachine } from '../src/machine-model.js';
import { bool, defineDecisionTable, on } from '../src/decision-table-model.js';
import { createObservationScope } from '../src/observation.js';

const machine=defineMachine({id:'door',states:['CLOSED','OPEN'],initial:'CLOSED',inputs:['Open'],guards:[],
  cells:[{id:'open',from:'CLOSED',on:'Open',to:'OPEN'}],rests:['CLOSED','OPEN'],deadlines:[],ordering:'exclusive',otherwise:'stay'});

test('the transport-free seam observes an evaluation without claiming state application',()=>{
  const rows: unknown[]=[];
  const scope=createObservationScope({onObservation:row=>rows.push(row)});
  const result=scope.step(machine,'CLOSED','Open',new Set());
  assert.equal(result.to,'OPEN');
  assert.deepEqual(rows,[{kind:'transition',phase:'evaluated',facetId:'door',cellId:'open',from:'CLOSED',to:'OPEN',input:'Open',guards:{}}]);
});
test('a decision observation contains only declared finite facts and returned values',()=>{
  const table=defineDecisionTable({id:'lamp',axes:{phase:['DAY','NIGHT'] as const},
    columns:{lit:bool},cells:[on('day',{phase:'DAY'},{lit:false}),on('night',{phase:'NIGHT'},{lit:true})]});
  const rows: unknown[]=[];
  const result=createObservationScope({onObservation:row=>rows.push(row)}).decide(table,{phase:'NIGHT'});
  assert.equal(result.values.lit,true);
  assert.deepEqual(rows,[{kind:'decision',phase:'evaluated',facetId:'lamp',cellId:'night',facts:{phase:'NIGHT'},values:{lit:true}}]);
});
test('port wrapper keeps receiver, stable method identity, return identity and application exceptions',()=>{
  const rows: unknown[]=[];
  const scope=createObservationScope({onObservation:row=>rows.push(row)});
  const pending=Promise.resolve(3);
  const service={secret:7, run(){if(this!==service)throw Error('wrong receiver');return pending;}, fail(){throw Error('application failure');}};
  const bound=scope.bindPortImplementations(service);
  assert.equal(bound.run,bound.run);
  assert.equal(bound.run(),pending);
  assert.throws(()=>bound.fail(),/application failure/);
  assert.deepEqual(rows,[{kind:'port',phase:'returned',portRef:'run'}]);
});
test('a replaced port method is the one called and observed after replacement',()=>{
  const rows: unknown[]=[];
  const service={value:1,run(){return this.value;}};
  const bound=createObservationScope({onObservation:row=>rows.push(row)}).bindPortImplementations(service);
  assert.equal(bound.run(),1);
  const first=bound.run;
  service.run=function(){return this.value+1;};
  assert.notEqual(bound.run,first);
  assert.equal(bound.run(),2);
  assert.deepEqual(rows,[
    {kind:'port',phase:'returned',portRef:'run'},
    {kind:'port',phase:'returned',portRef:'run'},
  ]);
});
test('a frozen port owner remains callable and observable',()=>{
  const rows: unknown[]=[];
  const service=Object.freeze({value:7,run(){assert.equal(this,service);return this.value;}});
  const bound=createObservationScope({onObservation:row=>rows.push(row)}).bindPortImplementations(service);
  assert.deepEqual(Object.keys(bound),Object.keys(service));
  assert.equal(bound.run(),7);
  assert.deepEqual(rows,[{kind:'port',phase:'returned',portRef:'run'}]);
});
test('observer failure never changes the application result',()=>{
  const scope=createObservationScope({onObservation:()=>{throw Error('observation unavailable');}});
  assert.equal(scope.step(machine,'CLOSED','Open',new Set()).to,'OPEN');
});
