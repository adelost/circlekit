import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLiveRunArgs } from '../lib/live-run.mjs';
import { main } from '../bin/studio.mjs';

test('live run selects one product and a direct Node command, never a shell',()=>{
  assert.deepEqual(parseLiveRunArgs(['--product','amux','--port','4317','--','node','--input-type=module','-e','42']),
    {product:'amux',port:4317,command:['node','--input-type=module','-e','42']});
  assert.throws(()=>parseLiveRunArgs(['--product','amux','--','npm','test']),error=>error.code==='live.command');
  assert.throws(()=>parseLiveRunArgs(['--product','amux']),error=>error.code==='live.command');
  assert.throws(()=>parseLiveRunArgs(['--','node','app.mjs']),error=>error.code==='live.product');
});
test('live run help does not start a receiver or product process',async()=>{
  let output='';
  assert.equal(await main(['live','run','--help'],{stdout:{write:text=>{output+=text;}}}),0);
  assert.match(output,/--product ID/);
});
