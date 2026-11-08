// The required architecture guard of this repository, shared by lint, the pre-push hook and the deploy; from Cut's tools/dev/arch-policy.mjs (row 1783) for this repository's rule ids. row 1785.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ARCH_WRAPPER = 'node scripts/arch/arch_check.mjs';
export const DECISIONS_FILE = 'arch.decisions.json';
const WHEN = /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/;

/** A raise of a known exception, or a rule's removal, is a named decision in a file: who made it, when, on which message, and what it covers. The guard's own code and config hold none. */
export function decisionFaults(decisions) {
  if (!Array.isArray(decisions)) return [`${DECISIONS_FILE}: a list of decisions`];
  return decisions.flatMap((one, at) => {
    const name = `${DECISIONS_FILE} #${at + 1}`, red = [];
    for (const field of ['who', 'message']) if (typeof one?.[field] !== 'string' || !one[field].trim()) red.push(`${name}: name ${field}`);
    if (!WHEN.test(one?.when ?? '')) red.push(`${name}: name when, as 2026-11-07T20:13Z`);
    const { ceilings, removes } = one ?? {};
    if (ceilings === undefined && removes === undefined) red.push(`${name}: name what it covers, ceilings (key: highest count) or removes (rule ids)`);
    if (ceilings !== undefined && (typeof ceilings !== 'object' || ceilings === null || !Object.values(ceilings).every(n => Number.isInteger(n) && n > 0))) red.push(`${name}: ceilings are keys with a count above 0`);
    if (removes !== undefined && (!Array.isArray(removes) || !removes.every(id => typeof id === 'string' && id))) red.push(`${name}: removes lists rule ids`);
    return red;
  });
}

export function architecturePolicy({ lint, config, baseline, decisions = [] }) {
  const red = [], rule = id => config.rules.find(one => one.id === id);
  if (!lint?.split(/\s+&&\s+/).includes(ARCH_WRAPPER)) red.push(`package.json: restore ${ARCH_WRAPPER} in npm run lint`);
  if (rule('K8c')?.kind !== 'max-lines' || rule('K8c')?.max !== 500)
    red.push('arch.config.json: keep K8c at 500 lines; its named exceptions only shrink, a file over 500 splits before it grows');
  if (rule('K16')?.kind !== 'modules' || !rule('K16').exactEdges || !rule('K16').acyclic || !rule('K16').closed)
    red.push("arch.config.json: restore K16's parsed package graph, closed to anything outside its packages, with the cycle check");
  for (const one of config.rules) if (!one.fix?.trim()) red.push(`arch.config.json: ${one.id} needs an actionable fix telling the author where the responsibility belongs`);
  for (const key of Object.keys(config)) if (/BaselineAdoption$/.test(key)) red.push(`arch.config.json: ${key} is a decision kept in the guard; name it in ${DECISIONS_FILE} (who, when, message) instead`);
  red.push(...decisionFaults(decisions));
  return red;
}

export function architectureGuard(root) {
  try {
    const read = path => JSON.parse(readFileSync(join(root, path), 'utf8')), config = read('arch.config.json');
    const decisions = existsSync(join(root, DECISIONS_FILE)) ? read(DECISIONS_FILE) : [], wrapper = readFileSync(join(root, 'scripts/arch/arch_check.mjs'), 'utf8');
    const red = architecturePolicy({ lint: read('package.json').scripts.lint, config, baseline: read(config.baseline), decisions });
    if (!/\bSHA256\b/.test(wrapper) || !/createHash/.test(wrapper)) red.push('scripts/arch/arch_check.mjs: restore the pinned hash of the package it runs; a package of the right version but other code must stop it');
    return red;
  } catch (error) { return [`architecture guard: restore its readable package, rules and baseline: ${error.message}`]; }
}
