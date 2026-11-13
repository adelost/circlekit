// The gate of the @v1d/push release: dist/ is built by Cutkit's tools/dev/publish-push.mjs from that repository's tools/push (this repo keeps no copy of it),
// so a release with no dist, or one that did not come from a Cutkit commit, stops here. The package stands alone: every import in it is node's or a file of it.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, normalize } from 'node:path';

const need = file => { if (!existsSync(file)) throw new Error(`${file} is missing: run tools/dev/publish-push.mjs in Cutkit, which builds dist from its source`); return readFileSync(file, 'utf8'); };
const manifest = JSON.parse(need('package.json')), source = JSON.parse(need('dist/SOURCE.json'));
if (!/^[0-9a-f]{40}$/.test(source.cutkit ?? '')) throw new Error('dist/SOURCE.json names no Cutkit commit');
if (source.version !== manifest.version) throw new Error(`dist was built for ${source.version}, the package says ${manifest.version}`);
if (!Array.isArray(source.files) || !source.files.length) throw new Error('dist/SOURCE.json lists no files');
for (const { path, sha256 } of source.files) {
  if (createHash('sha256').update(readFileSync(join('dist', path))).digest('hex') !== sha256) throw new Error(`dist/${path} is not the bytes SOURCE.json names`);
}
const targets = [...Object.values(manifest.exports ?? {}), ...Object.values(manifest.bin ?? {})];
for (const target of targets) if (!existsSync(normalize(target))) throw new Error(`the manifest names ${target}, which dist lacks`);
for (const file of readdirSync('dist').filter(name => name.endsWith('.mjs'))) {
  for (const [, from, loaded] of readFileSync(join('dist', file), 'utf8').matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']/g)) {
    const spec = from ?? loaded;
    if (spec.startsWith('./')) { if (!existsSync(join('dist', spec))) throw new Error(`dist/${file} imports ${spec}, which the package lacks`); }
    else if (!spec.startsWith('node:')) throw new Error(`dist/${file} imports ${spec}: only node's own modules may come from outside the package`);
  }
}
console.log(`push: ${source.files.length} files are Cutkit ${source.cutkit.slice(0, 9)}, version ${manifest.version}`);
