import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { storeTicketFile, consumeTicketFile } from '../lib/ticket-file.mjs';

test('the child process receives only a 0600 file path and consumes its one-time ticket',async()=>{
  const secret='A'.repeat(43);
  const file=await storeTicketFile(secret);
  try {
    assert.equal((await stat(file)).mode & 0o777,0o600);
    assert.equal(await readFile(file,'utf8'),secret);
    assert.equal(await consumeTicketFile(file),secret);
    await assert.rejects(access(file),error=>error.code==='ENOENT');
    await assert.rejects(consumeTicketFile(file),error=>error.code==='ENOENT');
  } finally { await rm(path.dirname(file),{recursive:true,force:true}); }
});
