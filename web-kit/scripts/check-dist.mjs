// The gate of the @v1d/web-kit release: dist/ is built by Cutkit's tools/dev/publish-web-kit.mjs from Cutkit's one source (this repo keeps no copy of it),
// so a release with no dist, or one that did not come from a Cutkit commit, stops here.
import { existsSync, readFileSync } from 'node:fs';

const need = file => { if (!existsSync(file)) throw new Error(`${file} is missing: run tools/dev/publish-web-kit.mjs in Cutkit, which builds dist from Cutkit's source`); return readFileSync(file, 'utf8'); };
const tokens = need('dist/tokens.css'), source = JSON.parse(need('dist/SOURCE.json'));
if (!/:root\s*\{/.test(tokens) || !/--bg\s*:/.test(tokens)) throw new Error('dist/tokens.css carries no :root tokens');
if (!/^[0-9a-f]{40}$/.test(source.cutkit ?? '')) throw new Error('dist/SOURCE.json names no Cutkit commit');
const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (source.version !== manifest.version) throw new Error(`dist was built for ${source.version}, the package says ${manifest.version}`);
for (const file of source.files ?? []) need(`dist/${file}`);
console.log(`web-kit ${manifest.version}: ${(source.files ?? []).length} files from Cutkit ${source.cutkit.slice(0, 9)}`);
