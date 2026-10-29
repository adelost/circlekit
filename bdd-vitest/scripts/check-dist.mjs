// The gate of the bdd-vitest release: the files are the bdd-vitest repository's committed ones (scripts/sync-bdd-vitest.mjs copies them), so a release with no SOURCE.json, a changed file or an export
// that points nowhere stops here.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { normalize } from 'node:path';

const need = file => { if (!existsSync(file)) throw new Error(`${file} is missing: run scripts/sync-bdd-vitest.mjs in CircleKit with a bdd-vitest checkout`); return readFileSync(file, 'utf8'); };
const manifest = JSON.parse(need('package.json')), source = JSON.parse(need('SOURCE.json'));
if (!/^[0-9a-f]{40}$/.test(source.bddVitest ?? '')) throw new Error('SOURCE.json names no bdd-vitest commit');
if (source.version !== manifest.version) throw new Error(`the files were synced for ${source.version}, the package says ${manifest.version}`);
if (!source.files?.length) throw new Error('SOURCE.json lists no files');
for (const { path, sha256 } of source.files) if (createHash('sha256').update(readFileSync(path)).digest('hex') !== sha256) throw new Error(`${path} is not the bytes SOURCE.json names`);
const targets = value => typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(targets);
for (const value of Object.values(manifest.exports ?? {})) for (const target of targets(value)) if (!existsSync(normalize(target))) throw new Error(`the manifest exports ${target}, which the package does not carry`);
console.log(`bdd-vitest: ${source.files.length} files are bdd-vitest ${source.bddVitest.slice(0, 9)}, version ${manifest.version}`);
