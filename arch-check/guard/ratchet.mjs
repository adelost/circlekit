// The ratchet of the architecture guard, from Cut (tools/dev/cloud_module_rules.mjs at a34aaa239, rows 1773, 1777, 1783): a cap, a known exception or a rule cannot be raised, removed or renamed by the change
// that it would otherwise reject, unless a named decision is added to arch.decisions.json in that commit. row 1785.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { UNTIL } from './policy.mjs';

export const DECISIONS = 'arch.decisions.json';
const BOUNDED = ['max-lines', 'max-line-length', 'max-module-lines', 'door-names'];   // the kinds whose max and exclude only tighten without a decision
const decisionsIn = text => { try { const list = JSON.parse(text ?? '[]'); return Array.isArray(list) ? list : []; } catch { return []; } };

/** A cap and named exceptions cannot be raised by the change they would otherwise reject, and a rule cannot leave or be renamed under the ratchet. Renames preserve identity.
 *  Only a decision added to arch.decisions.json in the same change as the raise (or the removal) licenses it; a decision of an earlier commit never does, and none can be altered or dropped.
 *  `counts` (today's breaches per key) makes a new rule start with exactly the breaches it names. */
export function ratchetFaults(root, config, baseline, { decisions = [], counts } = {}) {
  const git = (...args) => { try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }); } catch { return null; } };
  const hard = config.rules.filter(r => r.hard).map(r => `${r.id}:`), red = Object.keys(baseline).filter(key => hard.some(prefix => key.startsWith(prefix))).map(key => `${key}: a hard limit takes no exception; split the responsibility through a module door`), caps = config.rules.filter(r => r.kind === 'max-files');
  for (const ref of new Set([...(process.env.ARCH_REFS ? process.env.ARCH_REFS.split(',') : ['HEAD', 'HEAD^']), process.env.ARCH_BASE].filter(Boolean))) {   // an export names the commit's own parent in ARCH_REFS
    const oldConfigText = git('show', `${ref}:arch.config.json`), oldBaselineText = git('show', `${ref}:${config.baseline}`);
    if (!oldConfigText || !oldBaselineText) continue;
    const oldConfig = JSON.parse(oldConfigText), oldBaseline = JSON.parse(oldBaselineText);
    if (!Array.isArray(oldConfig.rules)) continue;   // a parent before this guard has nothing to hold the change against: the first baseline is written once, then it only shrinks
    const before = decisionsIn(git('show', `${ref}:${DECISIONS}`)), text = one => JSON.stringify(one);
    for (const one of before) if (!decisions.some(now => text(now) === text(one))) red.push(`${DECISIONS}: a decision of ${ref} was changed or removed; decisions are only added`);
    const fresh = decisions.filter(one => !before.some(old => text(old) === text(one)));
    const licensed = (key, value = 1) => fresh.some(one => (one.ceilings?.[key] ?? -1) >= value);
    if (oldConfig.guard && JSON.stringify(oldConfig.guard) !== JSON.stringify(config.guard) && !licensed('guard'))
      red.push(`arch.config.json: the guard (wrapper, lint command, docs-only paths) changed since ${ref}; name it in ${DECISIONS} (ceilings guard: 1)`);
    for (const oldRule of oldConfig.rules) {   // a rule that stays cannot get a lower bar
      const rule = config.rules.find(r => String(r.id) === String(oldRule.id));
      if (!rule) continue;
      if (oldRule.hard && !rule.hard) red.push(`${rule.id}: it was hard (no exception) in ${ref}; keep it hard`);
      if (oldRule.kind !== rule.kind && !licensed(`${rule.id}:kind`)) red.push(`${rule.id}: kind ${oldRule.kind} became ${rule.kind}; name it in ${DECISIONS} (ceilings ${rule.id}:kind: 1)`);
      if (JSON.stringify(rule.skip ?? null) !== JSON.stringify(oldRule.skip ?? null) && !licensed(`${rule.id}:skip`)) red.push(`${rule.id}: the files it leaves out (skip) changed; name it in ${DECISIONS} (ceilings ${rule.id}:skip: 1)`);
      if (BOUNDED.includes(rule.kind) && rule.kind === oldRule.kind) {
        if ((rule.count ?? null) !== (oldRule.count ?? null) && !licensed(`${rule.id}:count`))   // what a line is (all, or code) changes the bar either way
          red.push(`${rule.id}: count ${oldRule.count ?? 'lines'} became ${rule.count ?? 'lines'}; name it in ${DECISIONS} (ceilings ${rule.id}:count: 1)`);
        if (rule.max > oldRule.max && !licensed(`${rule.id}:max`, rule.max)) red.push(`${rule.id}: max ${rule.max} raises ${ref}'s ${oldRule.max}; name it in ${DECISIONS} (ceilings ${rule.id}:max: ${rule.max})`);
        for (const entry of rule.exclude ?? []) if (!(oldRule.exclude ?? []).includes(entry) && !licensed(`${rule.id}:exclude:${entry}`))
          red.push(`${rule.id}: ${entry} is now left out of the rule; name it in ${DECISIONS} (ceilings ${rule.id}:exclude:${entry}: 1)`);
        for (const [module, cap] of Object.entries(rule.caps ?? {})) {   // a module's own cap only drops; a new one may not stand above the rule's max
          const before = oldRule.caps?.[module] ?? oldRule.max;
          if (cap > before && !licensed(`${rule.id}:cap:${module}`, cap))
            red.push(`${rule.id}: ${module}'s cap ${cap} raises ${ref}'s ${before}; name it in ${DECISIONS} (ceilings ${rule.id}:cap:${module}: ${cap})`);
        }
        for (const dir of [oldRule.in ?? []].flat()) if (![rule.in ?? []].flat().includes(dir) && !licensed(`${rule.id}:in:${dir}`))
          red.push(`${rule.id}: the modules under ${dir} left the rule; name it in ${DECISIONS} (ceilings ${rule.id}:in:${dir}: 1)`);
      }
    }
    for (const oldRule of oldConfig.rules.filter(r => r.exactEdges)) {
      const rule = config.rules.find(r => r.id === oldRule.id);
      if (!rule?.exactEdges || (oldRule.acyclic && !rule.acyclic) || (oldRule.example && rule.example !== oldRule.example))
        red.push(`${oldRule.id}: keep its parsed doors, cycle check and required example`);
      if (oldRule.rootEdges && !rule?.rootEdges) red.push(`${oldRule.id}: keep its declared root-file dependencies`);
      if (oldRule.closed && !rule?.closed) red.push(`${oldRule.id}: keep it closed, an import that leaves its modules is a breach`);
      if (rule && ['root', 'entry', 'publicPrefix', 'lang', 'sourceRoots', 'edgesOnly'].some(field => JSON.stringify(oldRule[field]) !== JSON.stringify(rule[field])))
        red.push(`${oldRule.id}: keep its source root, language and public entry paths`);
      for (const before of oldRule.modules) {   // a module cannot leave while its folder stands
        if (rule && !rule.modules.some(m => m.dir === before.dir) && existsSync(resolve(root, before.dir)) && !licensed(`${rule.id}:module:${before.dir}`))
          red.push(`${rule.id}: module ${before.dir} left the rule while its folder stands; name it in ${DECISIONS} (ceilings ${rule.id}:module:${before.dir}: 1)`);
      }
      for (const module of rule?.modules ?? []) {   // what a module may import, and which files are its door, only widens by a decision
        const before = oldRule.modules.find(m => m.dir === module.dir);
        if (!before) continue;
        if (JSON.stringify(before.entry) !== JSON.stringify(module.entry) && !licensed(`${rule.id}:entry:${module.dir}`))
          red.push(`${rule.id}: ${module.dir} changed its door; name it in ${DECISIONS} (ceilings ${rule.id}:entry:${module.dir}: 1)`);
        for (const dep of module.imports ?? []) if (!before.imports.includes(dep) && !licensed(`${rule.id}:import:${module.dir}>${dep}`))
          red.push(`${rule.id}: ${module.dir} may now import ${dep}; name it in ${DECISIONS} (ceilings ${rule.id}:import:${module.dir}>${dep}: 1)`);
      }
      for (const folder of rule?.excludeFolders ?? []) if (!(oldRule.excludeFolders ?? []).includes(folder))
        red.push(`${oldRule.id}: new excluded folder ${folder}; declare its module instead`);
    }
    for (const oldRule of oldConfig.rules) if (!config.rules.some(r => r.id === oldRule.id) && !fresh.some(one => one.removes?.map(String).includes(String(oldRule.id))))
      red.push(`${oldRule.id}: rule removed or renamed since ${ref}; a rule leaves only through a decision in ${DECISIONS} that names it in removes`);
    const renamed = (git('diff', '--name-status', '-M', ref) ?? '').split('\n').filter(line => line.startsWith('R')).map(line => line.split('\t').slice(1));
    const movedModules = oldConfig.rules.filter(rule => rule.exactEdges).flatMap(oldRule => oldRule.modules.flatMap(module => {
      const moved = renamed.find(([from]) => from === `${module.dir}/${oldRule.entry ?? 'index.js'}`);
      const current = config.rules.find(rule => rule.id === oldRule.id);
      return moved && current?.modules.some(next => `${next.dir}/${current.entry ?? 'index.js'}` === moved[1])
        ? [[module.dir, posix.dirname(moved[1])]] : [];
    }));
    const renamedKey = key => [...renamed, ...movedModules].reduce((value, [from, to]) => value.replaceAll(from, to), key);
    const prior = Object.fromEntries(Object.entries(oldBaseline).map(([key, value]) => [renamedKey(key), value]));
    for (const cap of caps) {
      const oldCap = oldConfig.rules.find(r => r.id === cap.id);
      if (!oldCap) continue;
      if (cap.max > oldCap.max) red.push(`${cap.id}: max ${cap.max} raises ${ref}'s ${oldCap.max}; it only drops`);
      if (oldCap.noNewFiles && !cap.noNewFiles) red.push(`${cap.id}: keep the no-new-root-file rule`);
      if (cap.noNewFiles) {
        const prefix = cap.files[0].replace(/\*$/, ''), oldFiles = new Set((git('ls-tree', '-r', '--name-only', ref, '--', prefix) ?? '').split('\n'));
        for (const name of readdirSync(resolve(root, prefix), { withFileTypes: true }).filter(e => e.isFile())) {
          const file = `${prefix}${name.name}`;
          if (!oldFiles.has(file)) red.push(`${cap.id}: new root file ${file}; put the feature in its module`);
        }
      }
      const oldExcluded = new Set((oldCap.exclude ?? []).map(renamedKey));
      for (const file of cap.exclude ?? []) if (!oldExcluded.has(file)) red.push(`${cap.id}: new root exception ${file}; put the file in its module`);
    }
    // Cut row 1868 (skyvw:0's review of 3e50d7a9d): a key that left in this change lends its count to one new key of the same rule, a move (a file split or renamed past
    // git's reach); any other growth of a rule that stands is a decision of this change that names the key, why, and until, the day the exception goes (policy.mjs reddens it then)
    const left = new Map(), grown = [];   // rule id -> the counts its keys that left had, smallest first
    for (const [key, value] of Object.entries(prior)) if (!(key in baseline)) { const id = key.split(':')[0]; left.set(id, [...(left.get(id) ?? []), value].sort((a, b) => a - b)); }
    for (const [key, value] of Object.entries(baseline)) {
      const id = key.split(':')[0], oldRule = oldConfig.rules.find(r => String(r.id) === id);
      if (!oldRule) {   // a new rule starts with today's breaches, named here in the same commit, and the next commit's ratchet only lets them shrink
        if (counts && (counts[key] ?? 0) !== value) red.push(`${key}: a new rule ${id} names ${value}, today's breaches are ${counts[key] ?? 0}; name exactly today's`);
        continue;
      }
      if (value > (prior[key] ?? 0)) grown.push([key, value, id]);
    }
    for (const [key, value, id] of grown.sort(([, a], [, b]) => b - a)) {
      const room = left.get(id) ?? [], at = key in prior ? -1 : room.findIndex(n => n >= value);
      if (at >= 0) { room.splice(at, 1); continue; }
      const named = fresh.filter(one => (one.ceilings?.[key] ?? -1) >= value);
      if (named.some(one => one.why?.trim() && UNTIL.test(one.until ?? ''))) continue;
      red.push(named.length ? `${key}: the decision that names it needs why and until (the day the exception goes, as 2026-12-01)`
        : `${key}: exception ${value} raises ${ref}'s ${prior[key] ?? 0}; remove the new violation instead, or name the raise in ${DECISIONS} (who, when, why, until, message) in this commit`);
    }
  }
  return [...new Set(red)];
}
