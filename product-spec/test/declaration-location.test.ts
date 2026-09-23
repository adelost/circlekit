import assert from 'node:assert/strict';
import test from 'node:test';
import {bool,defineDecisionTable,on} from '../src/decision-table-model.js';
import {defineMachine} from '../src/machine-model.js';
import {declaredSite} from '../src/source-site.js';

test('R a refused table points to its authored declaration',()=>{
  assert.throws(()=>defineDecisionTable({id:'example.gap',axes:{phase:['A','B'] as const},
    columns:{hold:bool},cells:[on('only.a',{phase:'A'},{hold:true})]}),
  /no cell covers.*declaration-location\.test\.ts:\d+/u);
});

test('R the retained machine site remains available to its platform emitter',()=>{
  const machine=defineMachine({id:'example.machine',states:['S'],initial:'S',
    inputs:['ping'],ignored:['ping'],guards:[],rests:['S'],deadlines:[],ordering:'exclusive',otherwise:'stay',cells:[]});
  assert.match(declaredSite(machine)??'',/declaration-location\.test\.ts:\d+/u);
});

test('R a missing deadline points to its authored machine',()=>{
  assert.throws(()=>defineMachine({id:'example.machine',states:['S','R'],initial:'S',
    inputs:['go'],guards:[],rests:['S'],deadlines:[],ordering:'exclusive',otherwise:'stay',
    cells:[{id:'enter',from:'S',on:'go',to:'R'}]}),
  /no deadline input leaves it.*declaration-location\.test\.ts:\d+/u);
});
