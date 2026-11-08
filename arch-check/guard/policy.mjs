// The architecture guard's own requirements of a repository, read from the repository: lint runs the pinned wrapper that arch.config.json names under "guard", that wrapper still checks the package's hash,
// no raise sits in the config, every rule says where the responsibility belongs, and arch.decisions.json holds only well-formed decisions. What a rule may not lose (removal, a lower bar, a widened dependency,
// a dropped module) is the ratchet's, against the parent commit.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DECISIONS_FILE = 'arch.decisions.json';
const WHEN = /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/;

/** A raise of a known exception, a removed rule or a widened dependency is a named decision in a file: who made it, when, on which message, and what it covers. The guard's own code and config hold none. */
export function decisionFaults(decisions) {
  if (!Array.isArray(decisions)) return [`${DECISIONS_FILE}: a list of decisions`];
  return decisions.flatMap((one, at) => {
    const name = `${DECISIONS_FILE} #${at + 1}`, red = [];
    for (const field of ['who', 'message']) if (typeof one?.[field] !== 'string' || !one[field].trim()) red.push(`${name}: name ${field}`);
    if (!WHEN.test(one?.when ?? '')) red.push(`${name}: name when, as 2026-11-07T20:13Z`);
    const { ceilings, removes, doors } = one ?? {};
    if (ceilings === undefined && removes === undefined && doors === undefined) red.push(`${name}: name what it covers, ceilings (key: highest count), removes (rule ids) or doors (door: when it goes)`);
    if (doors !== undefined && (typeof doors !== 'object' || doors === null || !Object.values(doors).every(until => typeof until === 'string' && until.trim()))) red.push(`${name}: doors are door files with when each goes`);
    if (ceilings !== undefined && (typeof ceilings !== 'object' || ceilings === null || !Object.values(ceilings).every(n => Number.isInteger(n) && n > 0))) red.push(`${name}: ceilings are keys with a count above 0`);
    if (removes !== undefined && (!Array.isArray(removes) || !removes.every(id => typeof id === 'string' && id))) red.push(`${name}: removes lists rule ids`);
    return red;
  });
}

export function architecturePolicy({ lint, config, decisions = [], wrapper }) {
  const red = [], guard = config.guard ?? {};
  if (!guard.wrapper || !guard.lint) red.push('arch.config.json: name guard.wrapper (the pinned wrapper file) and guard.lint (its command in npm run lint)');
  else if (!lint?.split(/\s+&&\s+/).includes(guard.lint)) red.push(`package.json: restore ${guard.lint} in npm run lint`);
  if (guard.wrapper && (wrapper === undefined || !/\bSHA256\b/.test(wrapper) || !/createHash/.test(wrapper)))
    red.push(`${guard.wrapper}: restore the pinned hash of the package it runs; a package of the right version but other code must stop it`);
  for (const one of config.rules) if (!one.fix?.trim()) red.push(`arch.config.json: ${one.id} needs an actionable fix telling the author where the responsibility belongs`);
  for (const key of Object.keys(config)) if (/BaselineAdoption$/.test(key)) red.push(`arch.config.json: ${key} is a decision kept in the guard; name it in ${DECISIONS_FILE} (who, when, message) instead`);
  red.push(...decisionFaults(decisions));
  return red;
}

export function architectureGuard(root) {
  try {
    const read = path => JSON.parse(readFileSync(join(root, path), 'utf8')), config = read('arch.config.json'), wrapperPath = config.guard?.wrapper;
    return architecturePolicy({ lint: read('package.json').scripts?.lint, config, decisions: existsSync(join(root, DECISIONS_FILE)) ? read(DECISIONS_FILE) : [],
      wrapper: wrapperPath && existsSync(join(root, wrapperPath)) ? readFileSync(join(root, wrapperPath), 'utf8') : undefined });
  } catch (error) { return [`architecture guard: restore its readable package, rules and baseline: ${error.message}`]; }
}
