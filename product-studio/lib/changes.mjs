import { stat } from 'node:fs/promises';
import path from 'node:path';
import { digest, safeFile } from './util.mjs';

/** Active-client observation, not a daemon/build runner. Polling also works on WSL mounts. */
export class ChangeMonitor {
  constructor({ intervalMs = 2000 } = {}) { this.intervalMs = intervalMs; this.entries = new WeakMap(); }
  async inspect(project) {
    if (!project.config.root || project.config.fixture) return { status: 'unavailable', changed: [], ready: false };
    let entry = this.entries.get(project);
    if (!entry) { entry = { signatures: new Map(), observed: new Map(), time: 0, result: null, pending: null, stable: null }; this.entries.set(project, entry); }
    if (entry.pending) return entry.pending;
    if (entry.result && Date.now() - entry.time < this.intervalMs) return entry.result;
    entry.pending = this.scan(project, entry).finally(() => { entry.pending = null; });
    return entry.pending;
  }
  async scan(project, entry) {
    const root = project.config.root;
    const expected = new Map((project.readSet ?? []).map(s => [s.file, s.digest]));
    // Watch known absences too, so a new manifest/source invalidates the selection.
    for (const f of ['studio.workspace.json', project.config.bundle, project.config.artifact, ...(project.config.sources ?? [])].filter(Boolean))
      if (!expected.has(f)) expected.set(f, null);
    const changed = [], errors = [];
    for (const [file, before] of expected) {
      try {
        const info = await stat(path.resolve(root, file));
        const signature = [info.ino, info.size, info.mtimeMs, info.ctimeMs].join(':');
        let after = entry.observed.get(file);
        if (signature !== entry.signatures.get(file)) {
          // safeFile verifies root containment again after the stat hint.
          after = digest((await safeFile(root, file)).text);
          entry.signatures.set(file, signature); entry.observed.set(file, after);
        }
        if (after !== before) changed.push({ file, before, after });
      } catch (error) {
        if (error.code === 'ENOENT') {
          entry.signatures.delete(file); entry.observed.set(file, null);
          if (before !== null) changed.push({ file, before, after: null });
        } else errors.push({ file, code: error.code ?? 'watch.read', message: error.message });
      }
    }
    const signature = digest(changed), stable = entry.stable === signature;
    entry.stable = signature; entry.time = Date.now();
    const bundle = project.config.bundle;
    const manifestChanged = changed.some(c => c.file === 'studio.workspace.json');
    entry.result = { status: errors.length ? 'error' : changed.length ? 'changed' : 'current', changed, errors,
      stable, requiresRestart: manifestChanged,
      ready: stable && errors.length === 0 && !manifestChanged && !!bundle && changed.some(c => c.file === bundle && c.after),
      notice: 'Only declared input files are observed. No generator, source writer or runtime is started.' };
    return entry.result;
  }
}
