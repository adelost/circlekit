// What a repository's pinned wrapper runs: the rules of arch.config.json against the baseline of arch.baseline.json (which only shrinks), the package's kinds by arch-check.mjs and the rules that read
// imports (modules with exactEdges) by the parsed graph in graph.mjs. A raise of a known exception, a removed rule or a widened dependency needs a named decision in arch.decisions.json in the same commit.
//   --init            write the first baseline, once, while arch.baseline.json is empty
//   --adopt <rule id> name a rule that is new to the repository, with its breaches today, once
//   --lower           lower the baseline to today's counts; never raises
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { check } from '../arch-check.mjs';
import { architectureGuard } from './policy.mjs';
import { DECISIONS, ratchetFaults } from './ratchet.mjs';

/** The kinds the guard itself reads, each over the modules of the modules rule its `of` names (0.12.0): sandbox.mjs and doors.mjs. */
const GUARD_KINDS = ['sandbox', 'lazy-imports', 'door-names', 'other-doors'];

/** Returns the exit code: 0 holds, 1 a breach, 2 a rule that cannot run. */
export async function runGuard({ root, args = [] }) {
  const missing = architectureGuard(root);
  if (missing.length) { console.error(missing.join('\n')); return 1; }
  const config = JSON.parse(readFileSync(join(root, 'arch.config.json'), 'utf8')), path = join(root, config.baseline), baseline = JSON.parse(readFileSync(path, 'utf8'));
  const decisions = existsSync(join(root, DECISIONS)) ? JSON.parse(readFileSync(join(root, DECISIONS), 'utf8')) : [], first = args.includes('--init');
  if (first && Object.keys(baseline).length) { console.error('arch-check: the existing baseline only shrinks; use --lower'); return 1; }
  const parsedRules = config.rules.filter(r => r.kind === 'modules' && r.exactEdges), guardRules = config.rules.filter(r => GUARD_KINDS.includes(r.kind));
  const ids = new Set([...parsedRules, ...guardRules].map(r => String(r.id))), isParsed = key => ids.has(key.split(':')[0]);
  const ofRule = rule => config.rules.find(r => r.kind === 'modules' && String(r.id) === String(rule.of));
  const lost = guardRules.filter(rule => !ofRule(rule));
  if (lost.length) { console.error(lost.map(rule => `arch-check: cannot run: rule ${rule.id} (${rule.kind}) names no modules rule in of`).join('\n')); return 2; }
  const graph = parsedRules.length || guardRules.length ? await import('./graph.mjs') : {};   // the parser (TypeScript 5) loads only for rules that read imports
  const doors = guardRules.length ? await import('./doors.mjs') : {}, { sandboxCounts } = guardRules.length ? await import('./sandbox.mjs') : {};
  let built;
  try {
    built = await check(root, { ...config, rules: config.rules.filter(r => !GUARD_KINDS.includes(r.kind)).map(r => ids.has(String(r.id)) ? { ...r, files: [] } : r) },
      first ? {} : Object.fromEntries(Object.entries(baseline).filter(([key]) => !isParsed(key))));
  } catch (error) { console.error(`arch-check: cannot run: ${error.message}`); return 2; }   // a rule that cannot run never reads as a pass
  const counts = { ...built.counts }, red = [...built.red];
  const countsOf = rule => rule.kind === 'modules' ? graph.moduleCounts(root, rule) : rule.kind === 'sandbox' ? sandboxCounts(root, rule, ofRule(rule))
    : rule.kind === 'lazy-imports' ? doors.lazyCounts(root, rule, ofRule(rule)) : rule.kind === 'door-names' ? doors.doorNameCounts(root, rule, ofRule(rule))
    : doors.otherDoorCounts(rule, ofRule(rule), decisions);
  for (const rule of [...parsedRules, ...guardRules]) {
    const parsed = countsOf(rule), allowed = key => rule.kind === 'other-doors' ? 0 : baseline[key] ?? 0;   // another door stands only by a decision, never in the baseline
    Object.assign(counts, parsed.counts);
    if (!first) for (const [key, n] of Object.entries(parsed.counts)) if (n > allowed(key)) red.push(`rule ${key}: ${parsed.reasons.get(key)} (${n}, allowed ${allowed(key)}). Fix: ${rule.fix}`);
  }
  graph.saveImportCache?.();   // ARCH_CACHE_DIR keeps each file's imports by its content, row 1795
  const write = value => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
  if (first) {
    const hard = config.rules.filter(r => r.hard).map(r => `${r.id}:`), kept = Object.keys(counts).filter(key => hard.some(prefix => key.startsWith(prefix)));
    if (kept.length) { console.error(`${kept.join('\n')}\nA hard rule takes no exception; split these files first`); return 1; }
    write(counts); console.log(`arch-check: first baseline written, ${Object.keys(counts).length} named entries`); return 0;
  }
  if (args.includes('--adopt')) {   // a rule new to this repository starts with the breaches it has today, named once; the ratchet checks that the rule is new
    const id = args[args.indexOf('--adopt') + 1], rule = config.rules.find(r => String(r.id) === id), prefix = `${id}:`;
    if (!rule || rule.hard) { console.error('arch-check: --adopt takes the id of a rule of arch.config.json that is not hard'); return 1; }
    if (Object.keys(baseline).some(key => key.startsWith(prefix))) { console.error(`arch-check: ${id} already has named exceptions; they only shrink (--lower)`); return 1; }
    const taken = Object.entries(counts).filter(([key]) => key.startsWith(prefix));
    write(Object.fromEntries([...Object.entries(baseline), ...taken].sort(([a], [b]) => a < b ? -1 : 1)));
    console.log(`arch-check: ${id} adopted with ${taken.length} named entries`); return 0;
  }
  for (const [key, n] of Object.entries(baseline)) if (isParsed(key) && (counts[key] ?? 0) < n) red.push(`baseline ${key}: allows ${n}, now ${counts[key] ?? 0}; use --lower`);
  if (args.includes('--lower')) {
    const raised = Object.keys(counts).filter(key => counts[key] > (baseline[key] ?? 0));
    if (raised.length) red.push(`baseline cannot grow: ${raised.join(', ')}`);
    else {
      const lowered = Object.fromEntries(Object.entries(baseline).filter(([key]) => counts[key] > 0).map(([key, n]) => [key, Math.min(n, counts[key])]));
      const faults = ratchetFaults(root, config, lowered, { decisions, counts });
      if (!faults.length) { write(lowered); console.log(`arch-check: baseline lowered to ${Object.keys(lowered).length} named entries`); return 0; }
      red.push(...faults);
    }
  }
  red.push(...ratchetFaults(root, config, baseline, { decisions, counts }));
  if (red.length) { console.error(red.join('\n')); return 1; }
  console.log(`arch-check: ${config.rules.length} rules hold; baseline ${Object.keys(baseline).length} exceptions (${Object.values(baseline).reduce((sum, n) => sum + n, 0)} units)`);
  return 0;
}
