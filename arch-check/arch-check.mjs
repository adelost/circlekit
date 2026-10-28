#!/usr/bin/env node
// @v1d/arch-check: a repo's architecture rules as data (arch.config.json). Each rule names a kind, the files it covers and the fix; a hit names rule, file, line and fix.
// Old debt sits in arch.baseline.json as counts per rule and file. It may only shrink: more than the baseline is red, and so is less (lower the baseline with --lower).
// No dependencies (a `contract` rule borrows AMUX's contract-lint, found by --amux-root, $AMUX_ROOT or the amux on PATH). Run by hand or by a repo's lint script, nowhere else.
import {readFileSync, readdirSync, existsSync, writeFileSync, realpathSync} from "node:fs";
import {resolve, posix, delimiter, dirname, join} from "node:path";
import {pathToFileURL} from "node:url";

const SKIPPED = new Set(["node_modules", "dist", "build", ".git", ".wrangler", "coverage"]);
const walk = (root, dir = "") => readdirSync(resolve(root, dir), {withFileTypes: true}).flatMap(entry =>
  SKIPPED.has(entry.name) ? [] : entry.isDirectory() ? walk(root, posix.join(dir, entry.name)) : [posix.join(dir, entry.name)]);
const toRegExp = glob => new RegExp("^" + glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\//g, "\u0000").replace(/\*\*/g, "\u0001").replace(/\*/g, "[^/]*").replace(/\u0000/g, "(?:.*/)?").replace(/\u0001/g, ".*") + "$");
const matcher = globs => { const all = [globs ?? []].flat().map(toRegExp); return path => all.some(re => re.test(path)); };
const lines = text => text.split("\n");
const noteless = line => !/^\s*(\/\/|\*|\/\*|#)/.test(line);

/** The one grammar authority for WHAT: and WHY: is AMUX's core/contract-lint.mjs. Its checkout is named by the caller (--amux-root, then $AMUX_ROOT, then the amux on PATH), never by arch.config.json,
 *  so a config cannot make this tool run a module of its choosing. Without AMUX a contract rule stops the run: it never passes. */
const amuxRoot = given => {
  if (given) return given;
  if (process.env.AMUX_ROOT) return process.env.AMUX_ROOT;
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const bin = join(dir, "amux");
    if (!dir || !existsSync(bin)) continue;
    for (let at = dirname(realpathSync(bin)), up = 0; up < 4; up++, at = dirname(at)) if (existsSync(join(at, "core/contract-lint.mjs"))) return at;
  }
  return null;
};
const evaluator = async given => {
  const root = amuxRoot(given), file = root && resolve(root, "core/contract-lint.mjs");
  if (!file || !existsSync(file)) throw new Error(`AMUX was not found${root ? ` at ${root}` : ""}: pass --amux-root DIR, set AMUX_ROOT, or have amux on PATH. A contract rule never passes without it`);
  const lint = await import(pathToFileURL(file).href);
  if (typeof lint.evaluateContract !== "function") throw new Error(`the AMUX at ${root} does not export evaluateContract`);
  return lint.evaluateContract;
};
/** A file's first comment as plain text: a block comment with its stars taken off, or the run of // lines. A file that opens with code has no comment, so no contract. */
const firstComment = text => {
  const body = text.replace(/^\uFEFF/, "").replace(/^#![^\n]*\n/, "").trimStart();
  if (body.startsWith("/*")) { const end = body.indexOf("*/"); return end < 0 ? "" : body.slice(2, end).split("\n").map(line => line.replace(/^\s*\*+ ?/, "")).join("\n").trim(); }
  const run = [];
  for (const line of body.split("\n")) { if (!/^\s*\/\//.test(line)) break; run.push(line.replace(/^\s*\/\/ ?/, "")); }
  return run.join("\n").trim();
};
const TAG = /\b(WHAT|WHY|DTO|REMOVE|REFACTOR|MERGE|DEPRECATED|DEBT):\s*/gi;
const tagsOf = doc => {
  const found = {}, marks = [...doc.matchAll(TAG)];
  marks.forEach((mark, i) => (found[mark[1].toUpperCase()] ??= []).push(doc.slice(mark.index + mark[0].length, marks[i + 1]?.index ?? doc.length).replace(/\s+/g, " ").trim()));
  return found;
};

/** Each kind turns a rule and the repo into hits {file, line, message, weight?, at?}. weight counts toward the baseline (default 1). */
const kinds = {
  "max-lines": (rule, repo) => repo.covered(rule).flatMap(file => { const n = lines(repo.read(file)).length; return n > rule.max ? [{file, line: 1, message: `${n} lines, max ${rule.max}`, weight: n - rule.max}] : []; }),
  "max-files": (rule, repo) => {
    const perDir = new Map(); for (const file of repo.covered(rule)) perDir.set(posix.dirname(file), (perDir.get(posix.dirname(file)) ?? 0) + 1);
    return [...perDir].filter(([, n]) => n > rule.max).map(([dir, n]) => ({file: dir, line: 1, message: `${n} files in one folder, max ${rule.max}`, weight: n - rule.max}));
  },
  pattern: (rule, repo) => { const re = new RegExp(rule.pattern, rule.flags);
    return repo.covered(rule).flatMap(file => lines(repo.read(file)).flatMap((line, n) => noteless(line) && re.test(line) ? [{file, line: n + 1, message: rule.message ?? `breaks ${rule.name}`}] : [])); },
  // The folders directly under one folder (the repo's root, or `in`) are the ones the layout lists: any other is red, and node_modules, dist, build, .git and every dot folder are left alone.
  folders: (rule, repo) => {
    const base = rule.in ?? "", at = resolve(repo.root, base);
    if (!existsSync(at)) return [];
    return readdirSync(at, {withFileTypes: true}).filter(entry => entry.isDirectory() && !SKIPPED.has(entry.name) && !entry.name.startsWith(".") && !rule.allow.includes(entry.name))
      .map(entry => ({file: posix.join(base, entry.name), line: 1, message: rule.message ?? `a folder the layout does not list (${rule.allow.join(", ")})`}));
  },
  // A file's own name (without its folders) must match `pattern`: one spelling for every file the rule covers.
  names: (rule, repo) => { const re = new RegExp(rule.pattern, rule.flags);
    return repo.covered(rule).filter(file => !re.test(posix.basename(file))).map(file => ({file, line: 1, message: rule.message ?? `the name ${posix.basename(file)} does not match ${rule.pattern}`})); },
  absent: (rule, repo) => rule.paths.filter(path => existsSync(resolve(repo.root, path))).map(path => ({file: path, line: 1, message: rule.message ?? "must not exist"})),
  // A folder is a module when it has an entry file; everything outside it reaches it through that entry and only if the rule allows the edge.
  modules: (rule, repo) => {
    const owner = file => rule.modules.find(m => file.startsWith(m.dir + "/"));
    return repo.covered(rule).flatMap(file => lines(repo.read(file)).flatMap((line, n) => {
      const spec = /(?:from|import)\s*\(?\s*["'](\.[^"']*)["']/.exec(line)?.[1]; if (!spec) return [];
      const target = posix.join(posix.dirname(file), spec).replace(/\.(js|ts|mjs)$/, ""), into = owner(target + "/") ?? owner(target), mine = owner(file);
      if (!into || into === mine) return [];
      const edge = !rule.modules.includes(mine) || mine.imports.includes(into.dir);
      const entry = target === into.dir || target === posix.join(into.dir, "index");
      return !entry ? [{file, line: n + 1, message: `imports past ${into.dir}'s entry (${spec})`}] : !edge ? [{file, line: n + 1, message: `${mine.dir} may not import ${into.dir}`}] : [];
    }));
  },
  // The same run of lines in two files is one helper written twice.
  duplicates: (rule, repo) => {
    const size = rule.lines ?? 6, seen = new Map(), hits = [];
    for (const file of repo.covered(rule)) {
      const body = lines(repo.read(file)).map((text, n) => ({text: text.trim(), n: n + 1})).filter(({text}) => text.length >= (rule.minChars ?? 12) && noteless(text));
      let lastHit = -2;
      for (let i = 0; i + size <= body.length; i++) {
        const key = body.slice(i, i + size).map(({text}) => text).join("\n"), first = seen.get(key);
        if (first && first.file !== file) { if (lastHit !== i - 1) hits.push({file, line: body[i].n, message: `${size}+ lines also in ${first.file}:${first.line}`}); lastHit = i; }
        else if (!first) seen.set(key, {file, line: body[i].n});
      }
    }
    return hits;
  },
  // A file's first comment says what it is for (WHAT:) and the boundary or failure it keeps (WHY:); the words are judged by AMUX's contract-lint, the same grammar Product Studio applies in Skyvw. Errors and warnings are both red, as in Product Studio, whose check is not ok with a warning (an unknown verb, a WHAT over 16 words, a WHY over 18).
  contract: async (rule, repo) => {
    const evaluate = await evaluator(repo.amuxRoot);
    return repo.covered(rule).flatMap(file => {
      const tags = tagsOf(firstComment(repo.read(file))), what = tags.WHAT?.[0] ?? "", why = tags.WHY?.[0] ?? "", hit = message => ({file, line: 1, message});
      if (!what || !why) return [hit(`the file's first comment has no ${!what && !why ? "WHAT: and WHY:" : !what ? "WHAT:" : "WHY:"}`)];
      if (Object.values(tags).some(list => list.length !== 1) || Object.keys(tags).some(name => !["WHAT", "WHY"].includes(name))) return [hit("use exactly one WHAT: and one WHY:, no other tag and no repeat")];
      return evaluate(`WHAT: ${what}\nWHY: ${why}`, {name: file, kind: "file"}).filter(finding => finding.sev === "error" || finding.sev === "warn").map(finding => hit(`${finding.code} ${finding.msg}`));
    });
  },
  // A count read from a module's export: every item that `path` (or the sum of `paths`) reaches holds at least `min` entries; a * visits each key and the item is named by the keys it went through.
  // A value counts when it is there (0 and "" included): a list counts its entries, anything else counts one.
  count: async (rule, repo) => {
    const data = (await import(pathToFileURL(resolve(repo.root, rule.module)).href))[rule.export];
    const visit = (value, steps, label) => !steps.length ? [{label, value}] : steps[0] === "*" ? Object.entries(value ?? {}).flatMap(([key, item]) => visit(item, steps.slice(1), label ? `${label}/${key}` : key)) : visit(value?.[steps[0]], steps.slice(1), label);
    const found = new Map();
    for (const path of rule.paths ?? [rule.path]) for (const {label, value} of visit(data, path.split("."), "")) found.set(label, (found.get(label) ?? 0) + (Array.isArray(value) ? value.length : value === undefined || value === null ? 0 : 1));
    return [...found].filter(([, n]) => n < rule.min).map(([label]) => ({file: rule.module, line: 1, at: label, message: `${label} has fewer than ${rule.min} (${(rule.paths ?? [rule.path]).join(" or ")})`}));
  },
};

export async function check(root, config, baseline = {}, options = {}) {
  const files = walk(root), cache = new Map();
  const repo = {root, amuxRoot: options.amuxRoot, read: file => cache.get(file) ?? (cache.set(file, readFileSync(resolve(root, file), "utf8")), cache.get(file)), covered: rule => files.filter(matcher(rule.files)).filter(file => !matcher(rule.exclude)(file))};
  const found = new Map();
  for (const rule of config.rules) {
    if (!kinds[rule.kind]) throw new Error(`rule ${rule.id}: unknown kind ${rule.kind}`);
    for (const hit of await kinds[rule.kind](rule, repo)) {
      const key = `${rule.id}:${hit.file}${hit.at ? ":" + hit.at : ""}`, entry = found.get(key) ?? {rule, hits: [], weight: 0};
      entry.hits.push(hit); entry.weight += hit.weight ?? 1; found.set(key, entry);
    }
  }
  const red = [], counts = {};
  for (const [key, {rule, hits, weight}] of found) {
    counts[key] = weight; const allowed = baseline[key] ?? 0;
    if (weight > allowed) red.push(...hits.map(hit => `rule ${rule.id} ${rule.name}: ${hit.file}:${hit.line} ${hit.message}${allowed ? ` (baseline allows ${allowed}, now ${weight})` : ""}. Fix: ${rule.fix}`));
  }
  for (const [key, allowed] of Object.entries(baseline)) if (!(key in counts) || counts[key] < allowed) red.push(`baseline ${key}: allows ${allowed}, now ${counts[key] ?? 0}. Fix: run with --lower so the baseline only shrinks`);
  return {red, counts};
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2), amuxAt = args.indexOf("--amux-root"), amux = amuxAt < 0 ? undefined : args[amuxAt + 1];
  if (amuxAt >= 0 && (!amux || amux.startsWith("--"))) { console.error("arch-check: --amux-root needs the AMUX checkout"); process.exit(2); }
  const root = resolve(args.find((arg, at) => !arg.startsWith("--") && at !== amuxAt + 1) ?? ".");
  const config = JSON.parse(readFileSync(resolve(root, "arch.config.json"), "utf8")), baselinePath = resolve(root, config.baseline ?? "arch.baseline.json");
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  // a rule that cannot run (a contract rule without AMUX, an unknown kind) stops the run before any baseline is read or written: it never reads as a pass
  const {red, counts} = await check(root, config, args.includes("--init") ? {} : baseline, {amuxRoot: amux}).catch(error => { console.error(`arch-check: cannot run: ${error.message}`); process.exit(2); });
  if (args.includes("--init")) { writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + "\n"); console.log(`arch-check: baseline written (${Object.keys(counts).length} entries)`); }
  else if (args.includes("--lower")) {
    const lowered = Object.fromEntries(Object.entries(baseline).flatMap(([key, allowed]) => (counts[key] ?? 0) > 0 ? [[key, Math.min(allowed, counts[key])]] : []));
    const raised = Object.keys(counts).filter(key => counts[key] > (baseline[key] ?? 0));
    if (raised.length) { console.error(`arch-check: ${raised.length} entries grew, fix them first (--lower never raises)`); process.exit(1); }
    writeFileSync(baselinePath, JSON.stringify(lowered, null, 2) + "\n"); console.log(`arch-check: baseline lowered to ${Object.keys(lowered).length} entries`);
  } else if (red.length) { console.error(red.join("\n")); process.exit(1); }
  else console.log(`arch-check: ${config.rules.length} rules hold, baseline ${Object.keys(baseline).length} entries (${Object.values(baseline).reduce((sum, n) => sum + n, 0)} units)`);
}
