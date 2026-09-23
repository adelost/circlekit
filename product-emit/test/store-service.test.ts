import assert from 'node:assert/strict';
import test from 'node:test';
import {storeCatalog} from '@v1d/product-spec';
import {emitStoreServicesKotlin} from '../src/core/index.js';

const stores=storeCatalog([
  {id:'flight.replay',backend:'file',codec:{id:'flight-session',version:3},identity:'flightId',
    durability:'fsync-atomic-replace',failure:'reject',migration:'versioned',
    effectIds:['storage.flight-transaction']},
  {id:'cloud.cache',backend:'file',codec:{id:'cloud-response',version:1},identity:'singleton',
    durability:'fsync-atomic-replace',failure:'best-effort',migration:'none',
    effectIds:['storage.weather-cache-write']},
]);

test('C3 one portable store catalog emits typed policy references for Android',()=>{
  const kotlin=emitStoreServicesKotlin(stores,{packageName:'com.acme.generated',symbolPrefix:'Acme',
    sourceFile:'product/stores.ts',sourceSha:'fixture'});
  assert.match(kotlin,/enum class GeneratedAcmeStoreRef \{ FLIGHT_REPLAY, CLOUD_CACHE \}/u);
  assert.match(kotlin,/FLIGHT_REPLAY to GeneratedAcmeStorePolicy\("flight.replay".*FSYNC_ATOMIC_REPLACE.*REJECT/u);
  assert.match(kotlin,/CLOUD_CACHE to GeneratedAcmeStorePolicy\("cloud.cache".*BEST_EFFORT/u);
  assert.doesNotMatch(kotlin,/renameTo|writeText|FileOutputStream/u);
});
