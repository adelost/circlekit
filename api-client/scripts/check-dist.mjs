// The gate of the @v1d/api-client release: dist/ is built by ai-gateway's scripts/publish-api-client.mjs from that repository's packages/api-client (this repo keeps no copy of it),
// so a release with no dist, or one that did not come from a gateway commit, stops here. The package must also stand alone: every import in it is a file of it or mediabunny.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const need = file => { if (!existsSync(file)) throw new Error(`${file} is missing: run scripts/publish-api-client.mjs in ai-gateway, which builds dist from its source`); return readFileSync(file, 'utf8'); };
const manifest = JSON.parse(need('package.json')), source = JSON.parse(need('dist/SOURCE.json'));
if (!/^[0-9a-f]{40}$/.test(source.gateway ?? '')) throw new Error('dist/SOURCE.json names no ai-gateway commit');
if (source.version !== manifest.version) throw new Error(`dist was built for ${source.version}, the package says ${manifest.version}`);
if (!Array.isArray(source.files) || !source.files.length) throw new Error('dist/SOURCE.json lists no files');
for (const { path, sha256 } of source.files) {
  if (createHash('sha256').update(readFileSync(join('dist', path))).digest('hex') !== sha256) throw new Error(`dist/${path} is not the bytes SOURCE.json names`);
}
const targets = value => typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(targets);
for (const value of Object.values(manifest.exports ?? {})) for (const target of targets(value)) if (target !== './package.json' && !existsSync(normalize(target))) throw new Error(`the manifest exports ${target}, which dist does not have`);
const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
for (const file of walk('dist').filter(name => name.endsWith('.js') || name.endsWith('.d.ts'))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"']+)["']/g)) {
    const spec = match[1];
    if (spec.startsWith('.')) { if (!existsSync(join(dirname(file), spec)) && !existsSync(join(dirname(file), spec.replace(/\.js$/, '.d.ts')))) throw new Error(`${file} imports ${spec}, which the package does not carry`); }
    else if (spec !== 'mediabunny') throw new Error(`${file} imports ${spec}: only mediabunny may come from outside the package`);
  }
}
console.log(`api-client: ${source.files.length} files are ai-gateway ${source.gateway.slice(0, 9)}, version ${manifest.version}`);
