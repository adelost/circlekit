// Fills bdd-vitest/ for a release: the files the bdd-vitest repository commits at HEAD (its dist is committed, so no build runs here) and the manifest made from its package.json, with SOURCE.json naming the commit and each
// file's SHA-256. It refuses a commit that is not on the repository's origin/main and a worktree with changes, so that what a consumer pins is what that repository holds.
// usage: node scripts/sync-bdd-vitest.mjs --source DIR      then scripts/publish-bdd-vitest.sh X.Y.Z [--prepare-only]
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '../bdd-vitest');
const source = resolve(process.argv[process.argv.indexOf('--source') + 1] ?? '');
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('the bdd-vitest checkout has changes: sync a committed state');
const commit = git('rev-parse', 'HEAD');
if (spawnSync('git', ['-C', source, 'merge-base', '--is-ancestor', commit, 'origin/main']).status !== 0) throw new Error(`${commit.slice(0, 9)} is not on bdd-vitest's origin/main`);
const manifest = JSON.parse(git('show', 'HEAD:package.json'));
const tracked = git('ls-files').split('\n');
const wanted = file => manifest.files.some(entry => file === entry || file.startsWith(entry + '/'));
const files = tracked.filter(wanted).sort();
for (const entry of manifest.files) if (!files.some(file => file === entry || file.startsWith(entry + '/'))) throw new Error(`${entry} is named by files but the repository does not commit it`);
for (const name of ['dist', 'schema', 'README.md', 'SOURCE.json']) rmSync(join(here, name), { recursive: true, force: true });
const sums = [];
for (const file of files) {
  const bytes = execFileSync('git', ['-C', source, 'show', `HEAD:${file}`], { maxBuffer: 1 << 28 });
  mkdirSync(dirname(join(here, file)), { recursive: true }); writeFileSync(join(here, file), bytes);
  sums.push({ path: file, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const keep = ['name', 'version', 'type', 'description', 'license', 'repository', 'keywords', 'exports', 'main', 'module', 'types', 'peerDependencies', 'engines', 'sideEffects'];
const published = Object.fromEntries(keep.filter(key => key in manifest).map(key => [key, manifest[key]]));
published.files = [...manifest.files, 'SOURCE.json'];
published.scripts = { check: 'node scripts/check-dist.mjs' };
writeFileSync(join(here, 'package.json'), JSON.stringify(published, null, 2) + '\n');
writeFileSync(join(here, 'SOURCE.json'), JSON.stringify({ bddVitest: commit, version: manifest.version, files: sums }, null, 1) + '\n');
console.log(`bdd-vitest ${manifest.version} from ${commit.slice(0, 9)}: ${sums.length} files`);
