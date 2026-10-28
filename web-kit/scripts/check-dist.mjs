// The gate of the @v1d/web-kit release: dist/ is built by Cutkit's tools/dev/publish-web-kit.mjs from Cutkit's one source (this repo keeps no copy of it),
// so a release with no dist, or one that did not come from a Cutkit commit, stops here. The package must also stand alone: every import in it is a file of it.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const need = file => { if (!existsSync(file)) throw new Error(`${file} is missing: run tools/dev/publish-web-kit.mjs in Cutkit, which builds dist from Cutkit's source`); return readFileSync(file, 'utf8'); };
const tokens = need('dist/tokens.css'), source = JSON.parse(need('dist/SOURCE.json'));
if (!/:root\s*\{/.test(tokens) || !/--bg\s*:/.test(tokens)) throw new Error('dist/tokens.css carries no :root tokens');
if (!/^[0-9a-f]{40}$/.test(source.cutkit ?? '')) throw new Error('dist/SOURCE.json names no Cutkit commit');
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (source.version !== manifest.version) throw new Error(`dist was built for ${source.version}, the package says ${manifest.version}`);
for (const file of source.files ?? []) need(`dist/${file}`);

// 0.9.0 and later: every UI part has its example file, the source of kit.v1d.io (not an export: the site reads the files by path).
if (Number(manifest.version.split('.')[1]) >= 9) for (const part of ['search-field', 'filter-chips', 'panel', 'code-block', 'box-meter', 'timeview', 'songrow', ...(Number(manifest.version.split('.')[1]) >= 11 ? ['mark'] : []), ...(Number(manifest.version.split('.')[1]) >= 13 ? ['card'] : [])]) need(`dist/${part}.example.js`);

// Every file the manifest exports is in dist, and so is every file its types name.
const targets = value => typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(targets);
for (const [name, value] of Object.entries(manifest.exports ?? {})) for (const target of targets(value)) if (target !== './package.json') target.includes('*') ? (() => { if (!existsSync(normalize(target.split('*')[0]))) throw new Error(`${target.split('*')[0]} is not a folder of the package`); })() : need(normalize(target));

// 0.2.0 and later: the parts. Their sheet and their entry exist, the entry exports the parts the README names, and no module imports anything but a file the package carries.
if (Number(manifest.version.split('.')[1]) >= 2) {
  const sheet = need('dist/web-kit.css'), entry = need('dist/index.js');
  for (const rule of ['.part-panel', '.part-search', '.part-filter-chip', '.part-code-body', ...(Number(manifest.version.split('.')[1]) >= 7 ? ['.part-box-meter'] : []), ...(Number(manifest.version.split('.')[1]) >= 13 ? ['.part-card'] : [])]) if (!sheet.includes(rule)) throw new Error(`dist/web-kit.css has no rule for ${rule}`);
  for (const name of ['searchField', 'filterChips', 'panel', 'codeBlock', ...(Number(manifest.version.split('.')[1]) >= 7 ? ['boxMeter'] : []), ...(Number(manifest.version.split('.')[1]) >= 13 ? ['card'] : []), ...(Number(manifest.version.split('.')[1]) >= 14 ? ['icon'] : [])]) if (!new RegExp(`export \\{[^}]*\\b${name}\\b`).test(entry)) throw new Error(`dist/index.js does not export ${name}`);
  const walk = dir => readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  const dist = resolve('dist');
  for (const file of walk('dist').filter(name => name.endsWith('.js') || name.endsWith('.d.ts'))) {
    const code = need(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');   // what a comment says of an import is no import
    for (const [, target] of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g)) {
      if (!/^\.{1,2}\//.test(target)) throw new Error(`${file} imports ${target}: a part of the package imports only files the package carries`);
      const at = resolve(dirname(file), target);
      if (relative(dist, at).startsWith('..') || !existsSync(at)) throw new Error(`${file} imports ${target}, which is not a file of the package`);
    }
  }
}
console.log(`web-kit ${manifest.version}: ${(source.files ?? []).length} files from Cutkit ${source.cutkit.slice(0, 9)}`);
