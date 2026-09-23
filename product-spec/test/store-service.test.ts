import assert from 'node:assert/strict';
import test from 'node:test';
import {storeCatalog,storeService,type StoreServiceSpec} from '../src/store-service-model.js';

const replay={id:'flight.replay',backend:'file',codec:{id:'flight-session',version:3},
  identity:'flightId',durability:'fsync-atomic-replace',failure:'reject',migration:'versioned',
  effectIds:['storage.flight-transaction']} as const;

test('C3 a durable file store declares the commit and failure once',()=>{
  const store=storeService(replay);
  assert.equal(store.pattern,'store');
  assert.equal(store.durability,'fsync-atomic-replace');
  assert.equal(store.failure,'reject');
  assert.equal(Object.isFrozen(store),true);
});

test('C3 no store can omit durability or pair a file with preference commit',()=>{
  const define=(value:unknown)=>()=>storeService(value as StoreServiceSpec);
  assert.throws(define({...replay,durability:undefined}),/flight.replay.*durability.*store-service.test.ts:\d+/u);
  assert.throws(define({...replay,durability:'commit'}),/flight.replay.*durability/u);
  assert.throws(define({...replay,codec:{id:'flight-session',version:0}}),/flight.replay.*codec.version/u);
});

test('C3 one effect has one declared store owner',()=>{
  assert.throws(()=>storeCatalog([replay,{...replay,id:'duplicate'}]),/storage.flight-transaction.*flight.replay.*duplicate/u);
  const settings=storeService({id:'settings.flight',backend:'preferences',codec:{id:'flight-settings',version:1},
    identity:'singleton',durability:'commit',failure:'reject',migration:'versioned',
    effectIds:['storage.flight-settings-write']});
  assert.equal(storeCatalog([replay,settings]).length,2);
});
