// The `sandbox` kind (0.12.0, Cut row 1828, sandman:0 8 Nov): each module of the modules rule named in `of` that has its sandbox (that rule's
// `example`) is loaded in a bare node with no page stubbed (sandbox-load.mjs), as skyvw:2's guard of Cut's views/light.js loads a door. A
// sandbox whose load throws is named once, and the files it loads outside the module, the modules its declared imports reach and their
// declared root files are counted. A package (node_modules), a folder the modules rule leaves out (excludeFolders, assetFolders) and node's
// own modules are not outside. `seconds` bounds one load (20 by default); a load that does not end in time throws.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOADER = fileURLToPath(new URL('./sandbox-load.mjs', import.meta.url));

/** A module and every module its declared imports reach, in turn. */
const reachOf = (of, dir, seen = new Set()) => {
  if (seen.has(dir)) return seen;
  seen.add(dir);
  for (const dep of of.modules.find(m => m.dir === dir)?.imports ?? []) reachOf(of, dep, seen);
  return seen;
};

/** What the loader read of one sandbox: the files it loaded and what stopped it, if anything. */
function load(root, file, seconds) {
  const ran = spawnSync(process.execPath, [LOADER, resolve(root, file)], { cwd: root, encoding: 'utf8', timeout: seconds * 1000, env: { ...process.env, NODE_OPTIONS: '' } });
  try { return JSON.parse(ran.stdout); } catch { /* the loader wrote nothing whole */ }
  const end = ran.error?.code === 'ETIMEDOUT' ? `it did not load in ${seconds} s` : `the loader ended ${ran.status ?? ran.signal}: ${(ran.stderr ?? '').trim().split('\n').pop()}`;
  return { loaded: [], thrown: end };
}

export function sandboxCounts(root, rule, of) {
  const counts = {}, reasons = new Map(), seconds = rule.seconds ?? 20;
  const libraries = [...(of.excludeFolders ?? []), ...(of.assetFolders ?? [])].map(name => `${of.root}/${name}/`);
  for (const m of of.example ? of.modules : []) {
    const example = `${m.dir}/${of.example}`;
    if (!existsSync(resolve(root, example))) continue;
    const { loaded, thrown } = load(root, example, seconds);
    if (thrown) {
      counts[`${rule.id}:throws:${m.dir}`] = 1;
      reasons.set(`${rule.id}:throws:${m.dir}`, `${example}: in a bare node with no page its load throws: ${thrown}; a sandbox loads as any node file does`);
    }
    const reach = [...reachOf(of, m.dir)], declared = new Set(reach.flatMap(dir => of.modules.find(one => one.dir === dir)?.rootImports ?? []));
    const outside = loaded.map(url => fileURLToPath(url)).filter(path => !path.includes('/node_modules/')).map(path => relative(root, path))
      .filter(file => !file.startsWith('..') && !reach.some(dir => file.startsWith(`${dir}/`)) && !declared.has(file) && !libraries.some(prefix => file.startsWith(prefix)));
    if (!outside.length) continue;
    counts[`${rule.id}:outside:${m.dir}`] = outside.length;
    reasons.set(`${rule.id}:outside:${m.dir}`, `${example}: loads ${outside.length} file${outside.length === 1 ? '' : 's'} outside ${m.dir} and its declared dependencies, `
      + `${outside.slice(0, 3).join(', ')}${outside.length > 3 ? ' and more' : ''}; reach them through a declared module's door`);
  }
  return { counts, reasons };
}
