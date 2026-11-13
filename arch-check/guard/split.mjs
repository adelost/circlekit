// split.mjs — a split lands low and is a move with a name (Cut push-protocol-15 and -16, deep:0 for Mattias 13 Nov 09:36Z). A max-lines rule with
// `split: {from, lands}` holds a push that moves code out of a file over `from` (the file shrinks and another file of the push grows) to leave it at
// `lands` or under; a push that only deletes is free, and from `from` a touched file gets a note, not a fault, so its split is planned in a calm push.
// `touched.newNames: {pattern, flags?, fix}` is what the name of a file the push adds must match: no helpers, utils or a number.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { codeLineCount, matcher } from '../arch-check.mjs';

/** {red, told} for the push's changed files, each read at `base` (show) and in the tree at root; the rule's fix says the steps of a split. */
export function splitFaults(root, config, { files, show }) {
  const sized = config.rules.filter(rule => rule.kind === 'max-lines' && rule.split);
  if (!sized.length) return { red: [], told: [] };
  const count = (rule, text, file) => (rule.count === 'code' ? codeLineCount(text, file) : text.split('\n').length);
  const sizes = new Map(files.map(file => [file, { before: show(file), now: readFileSync(join(root, file), 'utf8') }]));
  const grew = files.filter(file => codeLineCount(sizes.get(file).now, file) > codeLineCount(sizes.get(file).before, file));
  const red = [], told = [];
  for (const rule of sized) for (const file of files.filter(one => matcher(rule.files)(one) && !matcher(rule.exclude)(one))) {
    const { before, now } = sizes.get(file), was = count(rule, before, file), is = count(rule, now, file), into = grew.filter(other => other !== file);
    const said = `${is} lines of code (${now.split('\n').length} lines)`;
    if (was > rule.split.from && is < was && into.length && is > rule.split.lands)
      red.push(`split: ${file} went from ${was} to ${said} while ${into.join(', ')} grew; code moved out of a file over ${rule.split.from} lands at `
        + `${rule.split.lands} or under. Fix: ${rule.fix}`);
    else if (is >= rule.split.from)
      told.push(`note: ${file} has ${said}, max ${rule.max}; from ${rule.split.from} plan its split in a calm push of its own. Fix: ${rule.fix}`);
  }
  return { red, told };
}

/** A file the push adds whose name does not match `newNames.pattern`. */
export function nameFaults(newNames, added) {
  if (!newNames) return [];
  const fit = new RegExp(newNames.pattern, newNames.flags);
  return added.filter(file => !fit.test(basename(file))).map(file => `names: ${file} is a new file named ${basename(file)}. Fix: ${newNames.fix}`);
}
