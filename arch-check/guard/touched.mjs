// A file a push touches is tidy (Cut row 1873, Mattias 8 Nov via sandman:0): arch.config.json `touched` names the move-only rules (story-order,
// stepdown, first-line) that hold in every touched file whatever its baseline says, a line the push writes stays within `changedLines` and no line
// of a touched file is over `wholeFile` (a crammed line). The tidy goes first, in its own commit; a P0 may push with `tidy-later: <row>` in a commit
// message, and the faults are then only told. A push's touches come from its export (ARCH_REFS, ARCH_BASE); by hand, the work tree against HEAD.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, generated, matcher, noteless } from '../arch-check.mjs';

/** Returns {red, told}: the faults of the touched files, red unless a commit of the push says tidy-later. */
export async function touchedFaults(root, config) {
  const touched = config.touched;
  if (!touched) return { red: [], told: [] };
  const { files, added, later } = touches(root), wanted = matcher(touched.files), left = matcher(touched.exclude);
  const mine = files.filter(file => wanted(file) && !left(file) && existsSync(join(root, file)));
  const faults = [...await ruleFaults(root, config, touched.rules ?? [], mine), ...lineFaults(root, touched, mine, added)];
  return later ? { red: [], told: faults.length ? [`tidy-later ${later}: ${faults.length} faults in touched files stay until the row closes, within 24 h`, ...faults] : [] }
    : { red: faults, told: [] };
}

/** Each named rule's hits in the touched files it covers, its baseline not counted. */
async function ruleFaults(root, config, ids, mine) {
  const rules = config.rules.filter(rule => ids.map(String).includes(String(rule.id))), lost = ids.filter(id => !rules.some(rule => String(rule.id) === String(id)));
  if (lost.length) throw new Error(`touched names rules arch.config.json does not have: ${lost.join(', ')}`);
  const scoped = rules.map(rule => ({ ...rule, files: mine.filter(file => matcher(rule.files)(file) && !matcher(rule.exclude)(file)), exclude: [] }));
  const { red } = await check(root, { ...config, rules: scoped }, {});
  return red.map(line => `touched: ${line} (a file you touch is tidied first, in its own commit)`);
}

/** A written line over changedLines, and any line of a touched file over wholeFile; comment lines and generated files are not code. */
function lineFaults(root, touched, mine, added) {
  return mine.flatMap(file => {
    const text = readFileSync(join(root, file), 'utf8');
    if (generated(file, text)) return [];
    return text.split('\n').flatMap((line, at) => {
      const length = [...line.replace(/\r$/, '')].length, written = added.get(file)?.has(at + 1);
      if (!noteless(line) || length <= Math.min(touched.changedLines ?? Infinity, touched.wholeFile ?? Infinity)) return [];
      if (touched.wholeFile && length > touched.wholeFile) return [`touched: ${file}:${at + 1} is ${length} characters; a touched file keeps no line over ${touched.wholeFile} (a crammed line). Fix: split it into named steps`];
      return written && length > touched.changedLines ? [`touched: ${file}:${at + 1} is ${length} characters; a line you write stays within ${touched.changedLines}. Fix: wrap it, or name a part of it`] : [];
    });
  });
}

/** The push's changed files, the new line numbers it wrote per file, and the row of a `tidy-later: <row>` in one of its commit messages. */
function touches(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 << 20 });
  const tip = process.env.ARCH_REFS?.split(',')[0].replace(/\^$/, ''), base = process.env.ARCH_BASE ?? (tip ? `${tip}^` : 'HEAD');
  const diff = git('diff', ...(tip ? ['--cached'] : []), '-U0', '--no-renames', '--diff-filter=AM', base), added = new Map();
  let file = null;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) { file = line.slice(6); added.set(file, new Set()); continue; }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) for (let n = Number(hunk[1]); n < Number(hunk[1]) + Number(hunk[2] ?? 1); n++) added.get(file).add(n);
  }
  const messages = tip ? git('log', '--format=%B', `${base}..${tip}`) : '';
  return { files: [...added.keys()], added, later: /^tidy-later:\s*(\S+)/m.exec(messages)?.[1] ?? null };
}
