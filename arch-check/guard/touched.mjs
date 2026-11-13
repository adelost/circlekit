// A file a push touches is tidy (Cut row 1873, Mattias 8 Nov via sandman:0): arch.config.json `touched` names the move-only rules (story-order,
// stepdown, first-line) that hold in every touched file whatever its baseline says, a line the push writes stays within `changedLines` and no line
// of a touched file is over `wholeFile` (a crammed line). The tidy goes first, in its own commit; a P0 may push with `tidy-later: <row>` in a commit
// message, and the faults are then only told. A push's touches come from its export (ARCH_REFS, ARCH_BASE); by hand, the work tree against HEAD.
// A split lands low and a new file is named for what it does (split.mjs, Cut push-protocol-15 and -16).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { check, generated, matcher, noteless } from '../arch-check.mjs';
import { nameFaults, splitFaults } from './split.mjs';

/** Returns {red, told}: the faults of the touched files, red unless a commit of the push says tidy-later. A push rule: with ARCH_TOUCHED=off (a deploy,
 *  export.mjs --commit; Cut's release) nothing is touched, since a release spans many pushes, each held at its own, some from before the rule. */
export async function touchedFaults(root, config) {
  const touched = config.touched;
  if (!touched || process.env.ARCH_TOUCHED === 'off') return { red: [], told: [] };
  const { files, added, born, show, later } = touches(root), wanted = matcher(touched.files), left = matcher(touched.exclude);
  const mine = files.filter(file => wanted(file) && !left(file) && existsSync(join(root, file)));
  const split = splitFaults(root, config, { files: files.filter(file => existsSync(join(root, file))), show });
  const named = matcher(touched.newNames?.files ?? touched.files), faults = [...await ruleFaults(root, config, touched.rules ?? [], mine),
    ...lineFaults(root, touched, mine, added), ...split.red, ...nameFaults(touched.newNames, born.filter(file => named(file) && !left(file)))];
  if (!later) return { red: faults, told: split.told };
  const waiting = faults.length ? [`tidy-later ${later}: ${faults.length} faults in touched files stay until the row closes, within 24 h`, ...faults] : [];
  return { red: [], told: [...waiting, ...split.told] };
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
      if (!noteless(line, file) || length <= Math.min(touched.changedLines ?? Infinity, touched.wholeFile ?? Infinity)) return [];
      if (touched.wholeFile && length > touched.wholeFile) return [`touched: ${file}:${at + 1} is ${length} characters; a touched file keeps no line over ${touched.wholeFile} (a crammed line). Fix: split it into named steps`];
      return written && length > touched.changedLines ? [`touched: ${file}:${at + 1} is ${length} characters; a line you write stays within ${touched.changedLines}. Fix: wrap it, or name a part of it`] : [];
    });
  });
}

/** The push's changed files, the new line numbers it wrote per file, the files it adds, a file's text at the base (empty when it is new), and the row
 *  of a `tidy-later: <row>` in one of its commit messages. A line the push only moved within its file is not written: --fix's tidy moves whole
 *  functions, and each moved line's text is one it removed. */
function touches(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 256 << 20 });
  const tip = process.env.ARCH_REFS?.split(',')[0].replace(/\^$/, ''), base = process.env.ARCH_BASE ?? (tip ? `${tip}^` : 'HEAD');
  const diff = git('diff', ...(tip ? ['--cached'] : []), '-U0', '--no-renames', '--diff-filter=AM', base), changes = new Map();
  let file = null, oldLeft = 0, newLeft = 0, at = 0;
  for (const line of diff.split('\n')) {
    if (oldLeft || newLeft) {   // counted, so a hunk's own '--- ' or '+++ ' text is never read as a file header
      if (line.startsWith('-')) { oldLeft--; changes.get(file).removed.push(line.slice(1)); }
      else if (line.startsWith('+')) { newLeft--; changes.get(file).added.push([at++, line.slice(1)]); }
      continue;
    }
    if (line.startsWith('+++ ')) { file = line.slice(6); changes.set(file, { removed: [], added: [] }); continue; }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) [oldLeft, at, newLeft] = [Number(hunk[1] ?? 1), Number(hunk[2]), Number(hunk[3] ?? 1)];
  }
  const added = new Map([...changes].map(([name, { removed, added: lines }]) => [name, written(lines, removed)]));
  const messages = tip ? git('log', '--format=%B', `${base}..${tip}`) : '';
  const born = git('diff', ...(tip ? ['--cached'] : []), '--name-only', '--no-renames', '--diff-filter=A', base).split('\n').filter(Boolean);
  const show = file => (born.includes(file) ? '' : git('show', `${base}:${file}`));
  return { files: [...added.keys()], added, born, show, later: /^tidy-later:\s*(\S+)/m.exec(messages)?.[1] ?? null };
}

/** The numbers of the added lines whose text no removed line of the same file had; each removed line accounts for one move. */
function written(lines, removed) {
  const left = new Map();
  for (const text of removed) left.set(text, (left.get(text) ?? 0) + 1);
  return new Set(lines.filter(([, text]) => !(left.get(text) > 0 && left.set(text, left.get(text) - 1))).map(([number]) => number));
}
