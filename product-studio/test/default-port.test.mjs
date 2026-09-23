import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.mjs';

test('Studio and its optional live receiver default to the local non-OTLP port', async () => {
  const { server, origin } = await createServer({ roots: [] });
  try { assert.equal(origin, 'http://127.0.0.1:17317'); }
  finally { await new Promise(resolve => server.close(resolve)); }
});
