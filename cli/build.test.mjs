// The cumulative publisher must never pack an unbound or modified CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('the publisher accepts bound bytes and refuses a changed file or missing source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'v1d-cli-publish-'));
  try {
    copyFileSync(new URL('./package.json', import.meta.url), join(dir, 'package.json'));
    copyFileSync(new URL('./build.mjs', import.meta.url), join(dir, 'build.mjs'));
    mkdirSync(join(dir, 'dist'));
    const hash = text => createHash('sha256').update(text).digest('hex');
    for (const name of ['v1d.mjs', 'server.mjs']) writeFileSync(join(dir, 'dist', name), name);
    const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const proof = { package: '@v1d/cli', version, source: 'a'.repeat(40), sha256: { 'v1d.mjs': hash('v1d.mjs'), 'server.mjs': hash('server.mjs') } };
    const save = () => writeFileSync(join(dir, 'dist', 'SOURCE.json'), JSON.stringify(proof));
    const check = () => spawnSync(process.execPath, [join(dir, 'build.mjs'), '--check'], { encoding: 'utf8' });
    save(); assert.equal(check().status, 0);
    writeFileSync(join(dir, 'dist', 'server.mjs'), 'changed'); assert.notEqual(check().status, 0);
    writeFileSync(join(dir, 'dist', 'server.mjs'), 'server.mjs'); proof.source = null; save(); assert.notEqual(check().status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
