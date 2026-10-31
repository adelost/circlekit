// Cutkit builds dist. CircleKit checks its source identity and bytes before packing or publishing.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), dist = join(here, 'dist');
const manifest = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const proof = JSON.parse(readFileSync(join(dist, 'SOURCE.json'), 'utf8'));
if (proof.package !== manifest.name || proof.version !== manifest.version || !/^[a-f0-9]{40}$/.test(proof.source ?? ''))
  throw new Error('CLI package needs its committed Cutkit source');
for (const name of ['v1d.mjs', 'server.mjs'])
  if (createHash('sha256').update(readFileSync(join(dist, name))).digest('hex') !== proof.sha256[name]) throw new Error(`CLI package changed: ${name}`);
