import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { digest, requireThat, safeFile } from './util.mjs';

function git(root, args, { input, index } = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    for (const key of ['GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[key];
    if (index) env.GIT_INDEX_FILE = index;
    const child = spawn('git', ['-C', root, '-c', 'commit.gpgsign=false', ...args], { env, stdio: ['pipe','pipe','pipe'] });
    let output = '', error = '', done = false;
    const finish = (failure, result) => { if (done) return; done = true; clearTimeout(timer); failure ? reject(failure) : resolve(result); };
    const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error('Git draft operation timed out.')); }, 10000);
    child.on('error', e => finish(e));
    child.stdout.on('data', b => { output += b; if (output.length > 2_000_000) { child.kill('SIGKILL'); finish(new Error('Git output exceeded its limit.')); } });
    child.stderr.on('data', b => { error = (error + b).slice(-8000); });
    child.on('close', code => finish(code === 0 ? null : new Error(`Git draft failed: ${error.trim() || code}`), output));
    child.stdin.on('error', () => {}); child.stdin.end(input ?? '');
  });
}

/** Writes only a new Git ref and objects. Never checkout, merge, push or touch the live index. */
export async function saveGitDraft({ root, dataDir, draft, expectedHead, readSet }) {
  requireThat(draft.valid && /^[a-f0-9]{64}$/.test(draft.id), 'git.validation', 'A valid, logic-checked draft is required.');
  requireThat(/^[a-f0-9]{40,64}$/.test(expectedHead ?? ''), 'git.head', 'This workspace needs a known Git HEAD.');
  const branch = 'product-studio/' + draft.id.slice(0, 24), ref = 'refs/heads/' + branch;
  const receipt = async () => {
    let sha; try { sha = (await git(root, ['rev-parse', '--verify', ref])).trim(); } catch { return null; }
    const message = await git(root, ['show', '-s', '--format=%B', sha]);
    requireThat(message.includes(`Studio-Operation: ${draft.id}`), 'git.conflict', 'The draft branch already exists with a different operation.');
    const text = await git(root, ['show', `${sha}:${draft.file}`]);
    requireThat(text === draft.text, 'git.conflict', 'The draft branch contains different source. It was not overwritten.');
    return { branch, commit: sha, persistence: 'git-draft-branch', validationScope: 'Supported source logic only; full product/native build not run.', message: 'Git draft branch saved. Working files, current branch and index are unchanged. Nothing was pushed or deployed.' };
  };
  const prior = await receipt(); if (prior) return prior;
  requireThat((await git(root, ['rev-parse','HEAD'])).trim() === expectedHead, 'git.conflict', 'Repository HEAD changed. Reload before saving a draft branch.', 409);
  for (const item of readSet) {
    const current = await safeFile(root, item.file);
    requireThat(digest(current.text) === item.digest, 'git.conflict', 'A source or configuration file changed after inspection. Reload and review.', 409);
  }
  const baseText = await git(root, ['show', `${expectedHead}:${draft.file}`]);
  requireThat(baseText === draft.before, 'git.dirty', 'The source has uncommitted changes. Export a patch through its owner instead of creating a branch from HEAD.', 409);
  const entry = (await git(root, ['ls-tree', expectedHead, '--', draft.file])).trim();
  const mode = entry.split(' ')[0];
  requireThat(['100644','100755'].includes(mode), 'git.file', 'Only a tracked ordinary source file can be saved to a Git draft.');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const temporary = await mkdtemp(path.join(dataDir, 'git-index-')), index = path.join(temporary,'index');
  try {
    await git(root, ['read-tree', expectedHead], { index });
    const blob = (await git(root, ['hash-object', '-w', '--stdin'], { input: draft.text })).trim();
    await git(root, ['update-index', '--add', '--cacheinfo', mode, blob, draft.file], { index });
    const tree = (await git(root, ['write-tree'], { index })).trim();
    const commit = (await git(root, ['commit-tree', tree, '-p', expectedHead], { input: `Product Studio: draft ${draft.facetId}\n\nStudio-Operation: ${draft.id}\nValidation: supported source declarations only\n` })).trim();
    requireThat((await git(root, ['rev-parse','HEAD'])).trim() === expectedHead, 'git.conflict', 'Repository HEAD changed during draft creation. No branch was updated.', 409);
    try { await git(root, ['update-ref', ref, commit, '0'.repeat(expectedHead.length)]); }
    catch (error) { const winner = await receipt(); if (winner) return winner; throw error; }
    return await receipt();
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
