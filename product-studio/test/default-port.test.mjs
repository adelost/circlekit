import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from '../server.mjs';
import { DEFAULT_STUDIO_PORT, HELP } from '../lib/cli.mjs';
import { parseLiveRunArgs } from '../lib/live-run.mjs';

test('Studio and its optional live receiver default to the local non-OTLP port', async () => {
  const { server, origin } = await createServer({ roots: [], liveEnabled: true });
  try {
    assert.equal(origin, `http://127.0.0.1:${DEFAULT_STUDIO_PORT}`);
    const bootstrap = await (await fetch(`${origin}/api/bootstrap`)).json();
    assert.equal(bootstrap.liveEnabled, true);
  }
  finally { await new Promise(resolve => server.close(resolve)); }
});

test('live run and its help use the receiver default', () => {
  const parsed = parseLiveRunArgs(['--product','amux','--','node','app.mjs']);
  assert.equal(parsed.port, DEFAULT_STUDIO_PORT);
  assert.match(HELP, new RegExp(`live run.*--port ${DEFAULT_STUDIO_PORT}`));
});

test('the separate ProductSpec Vite package declares the same default', async () => {
  const source = await readFile(new URL('../../product-spec/src/vite-plugin.ts', import.meta.url), 'utf8');
  const value = /export const DEFAULT_OBSERVATION_PORT\s*=\s*(\d+)/u.exec(source);
  assert.ok(value, 'ProductSpec must expose its standalone default for cross-package checking');
  assert.equal(Number(value[1]), DEFAULT_STUDIO_PORT);
});
