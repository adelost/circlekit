// arch_check.mjs, row 1785: runs @v1d/arch-check on this repository, the rules of arch.config.json against the baseline of arch.baseline.json, which only shrinks. Run by `npm run lint`:  node scripts/arch/arch_check.mjs
// The pinned dev dependency is installed by npm ci. Doors, edges and module cycles are read from a parsed import graph (graph.mjs, cycles.mjs; ratchet.mjs holds the ratchet) from Cut's guard; every other rule is the package's.
// A raise of a known exception or a rule's removal needs a named decision added to arch.decisions.json in the same commit (policy.mjs). `--init` writes the first baseline once, while arch.baseline.json is empty; `--adopt <rule id>` names a new rule's breaches once.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DECISIONS, ratchetFaults } from './ratchet.mjs';
import { architectureGuard } from './policy.mjs';

const VERSION = "0.8.0";
const SHA256 = "da82339da5f3cbe7c4fb03537d5eb7fe15dc65302512d607f7274e284d39494d";   // arch-check.mjs of that version, the file package-lock.json's integrity covers; change both with the pin
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const missing = architectureGuard(ROOT);
if (missing.length) { console.error(missing.join('\n')); process.exit(1); }
const PACKAGE = join(ROOT, "node_modules/@v1d/arch-check");
const FIX = 'npm ci';

const installed = existsSync(join(PACKAGE, "package.json")) ? JSON.parse(readFileSync(join(PACKAGE, "package.json"), "utf8")).version : null;
if (installed !== VERSION) {
  console.error(`arch-check: this repository needs @v1d/arch-check ${VERSION} in node_modules and has ${installed ?? "none"}. Fix: ${FIX}`);
  process.exit(2);
}
if (createHash("sha256").update(readFileSync(join(PACKAGE, "arch-check.mjs"))).digest("hex") !== SHA256) {
  console.error(`arch-check: ${PACKAGE} is not the locked @v1d/arch-check ${VERSION} (arch-check.mjs differs from its pinned hash). Fix: ${FIX}`);
  process.exit(2);
}
const args = process.argv.slice(2), config = JSON.parse(readFileSync(join(ROOT, 'arch.config.json'), 'utf8'));
const path = join(ROOT, config.baseline), baseline = JSON.parse(readFileSync(path, 'utf8'));
const decisions = existsSync(join(ROOT, DECISIONS)) ? JSON.parse(readFileSync(join(ROOT, DECISIONS), 'utf8')) : [];
if (args.includes('--init') && Object.keys(baseline).length) throw Error('arch-check: the existing baseline only shrinks; use --lower');
const parsedRules = config.rules.filter(r => r.kind === 'modules' && r.exactEdges);
const ids = new Set(parsedRules.map(r => String(r.id))), isParsed = key => ids.has(key.split(':')[0]);
const { moduleCounts } = parsedRules.length ? await import('./graph.mjs') : {};   // the parser (typescript) loads only for rules that read imports
const { check } = await import(join(PACKAGE, 'arch-check.mjs'));
const packageBaseline = args.includes('--init') ? {} : Object.fromEntries(Object.entries(baseline).filter(([key]) => !isParsed(key)));
const built = await check(ROOT, { ...config, rules: config.rules.map(r => ids.has(String(r.id)) ? { ...r, files: [] } : r) }, packageBaseline)
  .catch(error => { console.error(`arch-check: cannot run: ${error.message}`); process.exit(2); });   // a rule that cannot run never reads as a pass
const counts = { ...built.counts }, red = [...built.red];
for (const rule of parsedRules) {
  const parsed = moduleCounts(ROOT, rule);
  Object.assign(counts, parsed.counts);
  if (!args.includes('--init')) for (const [key, n] of Object.entries(parsed.counts)) if (n > (baseline[key] ?? 0)) red.push(`rule ${key}: ${parsed.reasons.get(key)} (${n}, allowed ${baseline[key] ?? 0}). Fix: ${rule.fix}`);
}
if (args.includes('--init')) {
  const hard = Object.keys(counts).filter(key => key.startsWith('K8a:'));
  if (hard.length) { console.error(`${hard.join('\n')}\nK8a is 500 lines with no exceptions; split these files first`); process.exit(1); }
  writeFileSync(path, JSON.stringify(counts, null, 2) + '\n'); console.log(`arch-check: first baseline written, ${Object.keys(counts).length} named entries`); process.exit(0);
}
if (args.includes('--adopt')) {   // a rule new to this repository starts with the breaches it has today, named once; the ratchet checks that the rule is new
  const id = args[args.indexOf('--adopt') + 1], rule = config.rules.find(r => String(r.id) === id), prefix = `${id}:`;
  if (!rule || rule.hard) { console.error('arch-check: --adopt takes the id of a rule of arch.config.json that is not hard'); process.exit(1); }
  if (Object.keys(baseline).some(key => key.startsWith(prefix))) { console.error(`arch-check: ${id} already has named exceptions; they only shrink (--lower)`); process.exit(1); }
  const taken = Object.entries(counts).filter(([key]) => key.startsWith(prefix));
  writeFileSync(path, JSON.stringify(Object.fromEntries([...Object.entries(baseline), ...taken].sort(([a], [b]) => a < b ? -1 : 1)), null, 2) + '\n');
  console.log(`arch-check: ${id} adopted with ${taken.length} named entries`); process.exit(0);
}
for (const [key, n] of Object.entries(baseline)) if (isParsed(key) && (counts[key] ?? 0) < n)
  red.push(`baseline ${key}: allows ${n}, now ${counts[key] ?? 0}; use --lower`);
if (args.includes('--lower')) {
  const raised = Object.keys(counts).filter(key => counts[key] > (baseline[key] ?? 0));
  if (raised.length) red.push(`baseline cannot grow: ${raised.join(', ')}`);
  else {
    const lowered = Object.fromEntries(Object.entries(baseline).filter(([key]) => counts[key] > 0).map(([key, n]) => [key, Math.min(n, counts[key])]));
    const faults = ratchetFaults(ROOT, config, lowered, { decisions, counts });
    if (!faults.length) { writeFileSync(path, JSON.stringify(lowered, null, 2) + '\n'); console.log(`arch-check: baseline lowered to ${Object.keys(lowered).length} named entries`); process.exit(0); }
    red.push(...faults);
  }
}
red.push(...ratchetFaults(ROOT, config, baseline, { decisions, counts }));
if (red.length) { console.error(red.join('\n')); process.exit(1); }
console.log(`arch-check: ${config.rules.length} rules hold; baseline ${Object.keys(baseline).length} exceptions (${Object.values(baseline).reduce((sum, n) => sum + n, 0)} units)`);
