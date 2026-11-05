// The gate of the mnemonic-id release: the files are the npm registry's tarball of that version (scripts/sync-mnemonic-id.mjs unpacks it), so a release
// with no SOURCE.json, a changed file or an export that points nowhere stops here.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { normalize } from 'node:path';

const need = file => { if (!existsSync(file)) throw new Error(`${file} is missing: run scripts/sync-mnemonic-id.mjs --version X.Y.Z in CircleKit`); return readFileSync(file, 'utf8'); };
const manifest = JSON.parse(need('package.json')), source = JSON.parse(need('SOURCE.json'));
if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(source.integrity ?? '')) throw new Error('SOURCE.json names no registry integrity');
if (source.version !== manifest.version) throw new Error(`the files were synced for ${source.version}, the package says ${manifest.version}`);
if (Object.keys(manifest.dependencies ?? {}).length) throw new Error('the package names dependencies, which this address does not serve');
if (!source.files?.length) throw new Error('SOURCE.json lists no files');
for (const { path, sha256 } of source.files) if (createHash('sha256').update(readFileSync(path)).digest('hex') !== sha256) throw new Error(`${path} is not the bytes SOURCE.json names`);
const targets = value => typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(targets);
for (const value of Object.values(manifest.exports ?? {})) for (const target of targets(value)) if (!existsSync(normalize(target))) throw new Error(`the manifest exports ${target}, which the package does not carry`);
console.log(`mnemonic-id: ${source.files.length} files are the registry's ${source.version} (${source.integrity.slice(0, 19)}...)`);
