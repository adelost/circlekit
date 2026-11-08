// Lints a commit in an export of it, never in the shared work tree: git's pre-push hook (stdin lines `local_ref sha remote_ref remote_sha`; a push to a branch the commit's
// arch.config.json names in guard.branches, a regex of branch names, master or main by default) and a deploy
// (`node node_modules/@v1d/arch-check/guard/export.mjs --commit <sha>`) both end in `npm run lint` there, whose gate is the repository's pinned wrapper. The ratchet holds the commit against its own parent and,
// from a push, the remote's tip. A push of only docs (arch.config.json guard.docsOnly, a regex; default ^docs/) is not linted. A deploy of a commit from before the guard is a rollback and is not checked.
import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { architectureGuard } from './policy.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const none = sha => !sha || /^0+$/.test(sha);

export function lintCommit(sha, before, { rollback = false } = {}) {
  const root = git('rev-parse', '--show-toplevel'), gitDir = git('rev-parse', '--absolute-git-dir');
  const began = Date.now(), temp = mkdtempSync(join(tmpdir(), 'arch-lint-')), tree = join(temp, 'source');
  try {
    mkdirSync(tree);
    const archive = join(temp, 'source.tar'), fd = openSync(archive, 'w');
    try { execFileSync('git', ['archive', '--format=tar', sha], { stdio: ['ignore', fd, 'inherit'] }); } finally { closeSync(fd); }
    execFileSync('tar', ['-xf', archive, '-C', tree]);
    rmSync(archive);
    if (existsSync(join(root, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(tree, 'node_modules'));
    const lintFrom = (() => { try { return JSON.parse(readFileSync(join(tree, 'arch.config.json'), 'utf8')).eslint?.from; } catch { return null; } })();
    if (lintFrom && existsSync(join(root, lintFrom, 'node_modules'))) symlinkSync(join(root, lintFrom, 'node_modules'), join(tree, lintFrom, 'node_modules'));   // the lint package's own install
    const env = { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: tree, GIT_INDEX_FILE: join(temp, 'index'), ARCH_REFS: `${sha}^`, ...(none(before) ? {} : { ARCH_BASE: before }),
      ...(rollback ? { ARCH_TOUCHED: 'off' } : {}) };   // a deploy's commit was held to the touched rule at its push
    execFileSync('git', ['read-tree', sha], { env });
    const configFile = join(tree, 'arch.config.json'), wrapper = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')).guard?.wrapper : null;
    if (rollback && !(wrapper && existsSync(join(tree, wrapper)))) { console.error(`arch: ${sha} predates the guard; a deploy of it is a rollback and is not checked`); return; }
    const missing = architectureGuard(tree);
    if (missing.length) throw Error(`${missing.join('; ')}; stopped`);
    // the lint's words go to stderr: a hook's stdout reaches whoever reads git push's stdout, and Huset's release-setup.py (release 1517) took them for its answer
    const result = spawnSync('timeout', ['--kill-after=5s', '120s', 'npm', 'run', '-s', 'lint'], { cwd: tree, env, stdio: ['ignore', 2, 'inherit'] });
    const seconds = ((Date.now() - began) / 1000).toFixed(1);
    if (result.status !== 0) throw Error(`lint failed for ${sha} in ${seconds} s (exit ${result.status ?? result.error?.message}); stopped`);
    console.error(`arch: lint passed for ${sha} in ${seconds} s`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
}

/** What a pre-push hook's lines ask of the guard: each pushed tip of a branch its own arch.config.json names (guard.branches, default master|main), once, with the remote's old
 *  tip; `docsOnly` where every changed file matches guard.docsOnly (default ^docs/). A deleted branch is not there. `configOf(sha)` and `changedOf(sha, before)` read git. */
export function pushedTips(input, { configOf, changedOf }) {
  const tips = [], checked = new Set();
  for (const [, sha, target, before] of input.trim().split('\n').filter(Boolean).map(line => line.split(/\s+/))) {
    if (none(sha) || checked.has(sha)) continue;
    const guard = configOf(sha).guard ?? {};
    if (!new RegExp(`^refs/heads/(?:${guard.branches ?? 'master|main'})$`).test(target)) continue;
    checked.add(sha);
    tips.push({ sha, before, docsOnly: changedOf(sha, before).every(path => new RegExp(guard.docsOnly ?? '^docs/').test(path)) });
  }
  return tips;
}

const configAt = sha => { try { return JSON.parse(git('show', `${sha}:arch.config.json`)); } catch { return {}; } };
const changedAt = (sha, before) => (none(before) ? git('ls-tree', '-r', '--name-only', sha) : git('diff', '--no-renames', '--name-only', before, sha)).split('\n').filter(Boolean);

async function main() {
  const args = process.argv.slice(2), at = flag => args.indexOf(flag) < 0 ? null : args[args.indexOf(flag) + 1];
  if (at('--commit')) return lintCommit(git('rev-parse', '--verify', `${at('--commit')}^{commit}`), at('--base'), { rollback: true });
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  for (const { sha, before, docsOnly } of pushedTips(input, { configOf: configAt, changedOf: changedAt })) {
    if (docsOnly) console.error(`pre-push: docs-only ${sha}; lint not needed`);
    else lintCommit(sha, before);
  }
}
if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`pre-push: ${error.message}`); process.exitCode = 1; });
}
