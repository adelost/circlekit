#!/usr/bin/env node
// @v1d/arch-check: a repo's architecture rules as data (arch.config.json). Each rule names a kind, the files it covers and the fix; a hit names rule, file, line and fix.
// Old debt sits in arch.baseline.json as counts per rule and file. It may only shrink: more than the baseline is red, and so is less (lower the baseline with --lower).
// No dependencies (a `contract` rule borrows AMUX's contract-lint, found by --amux-root, $AMUX_ROOT or the amux on PATH). Run by hand or by a repo's lint script, nowhere else.
import {readFileSync, readdirSync, existsSync, writeFileSync, realpathSync} from "node:fs";
import {resolve, posix, delimiter, dirname, join} from "node:path";
import {pathToFileURL} from "node:url";
import {judge, lines, matcher, textKinds} from "./rules.mjs";
import {nodeRepo, SKIPPED} from "./repo-node.mjs";
import {reportOf} from "./report.mjs";
import {storyKinds} from "./story.mjs";

export {codeLineCount, generated, KEY_NAMES, matcher, MODAL, noteless, PROVIDERS} from "./rules.mjs";

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

/** Each kind turns a rule and the repo into hits {file, line, message, weight?, at?}. weight counts toward the baseline (default 1). The kinds below read the
 *  repository's layout or run its code, so they stay with node; the text kinds (rules.mjs) and the story kinds also run in the browser (web.mjs). */
const kinds = {
  ...textKinds,    // max-lines, max-line-length, max-module-lines, pattern, providers, modal, duplicates
  ...storyKinds,   // eslint, first-line, story-order, stepdown, stepdown-order, exceptions (Cut row 1873)
  "max-files": (rule, repo) => {
    const perDir = new Map(); for (const file of repo.covered(rule)) perDir.set(posix.dirname(file), (perDir.get(posix.dirname(file)) ?? 0) + 1);
    return [...perDir].filter(([, n]) => n > rule.max).map(([dir, n]) => ({file: dir, line: 1, message: `${n} files in one folder, max ${rule.max}`, weight: n - rule.max}));
  },
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
  // A stylesheet names the classes of the parts it styles: a covered .css file belongs to the part folder it lies in, and a class (a name that starts with `prefix`) that another part's script draws is that part's, so the
  // stylesheet may name it only where its own part's script imports that part (a part names its own classes and those of the parts it imports, never another's). `scripts` are the parts' scripts, `exclude` leaves out
  // those that draw nothing (the examples); a class no script names is nobody's. One hit per class in a stylesheet, at its first line.
  "css-imports": (rule, repo) => {
    const skip = matcher(rule.exclude), isScript = matcher(rule.scripts), scripts = repo.files.filter(file => isScript(file) && !skip(file)), prefix = rule.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = new RegExp(`(?<![\\w-])${prefix}[\\w-]*\\w(?![\\w-])`, "g"), named = new RegExp(`\\.(${prefix}[\\w-]*\\w)(?![\\w-])`, "g");
    const drawn = new Map();   // class -> the folders whose scripts name it
    for (const file of scripts) for (const name of new Set(repo.read(file).match(token) ?? [])) drawn.set(name, (drawn.get(name) ?? new Set()).add(posix.dirname(file)));
    const imports = dir => new Set(scripts.filter(file => posix.dirname(file) === dir).flatMap(file => [...repo.read(file).matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']*)["']/g)].map(spec => posix.join(dir, spec[1]))));
    return repo.covered(rule).flatMap(file => {
      const dir = posix.dirname(file), reached = imports(dir), seen = new Set();
      return lines(repo.read(file).replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, " "))).flatMap((line, n) => [...line.matchAll(named)].flatMap(([, name]) => {
        const owners = [...(drawn.get(name) ?? [])];
        if (seen.has(name) || !owners.length || owners.includes(dir) || owners.some(owner => [...reached].some(path => path === owner || path.startsWith(owner + "/")))) return [];
        seen.add(name);
        return [{file, line: n + 1, message: `names .${name}, which ${owners.map(owner => posix.basename(owner)).join(" or ")} draws, and ${posix.basename(dir)}'s script does not import ${owners.length > 1 ? "any of them" : "it"}`}];
      }));
    });
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

/** The rules of `config` over the repository at root: {red, counts, reported, hits}, as judge() in rules.mjs gives them. */
export const check = (root, config, baseline = {}, options = {}) => judge(kinds, nodeRepo(root, config, options), baseline);

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2), VALUED = ["--amux-root", "--rev", "--since", "--repo", "--today"];
  const option = name => { const at = args.indexOf(name), value = at < 0 ? undefined : args[at + 1];
    if (at >= 0 && (!value || value.startsWith("--"))) { console.error(`arch-check: ${name} needs a value`); process.exit(2); } return value; };
  // the root is the one argument that is neither a flag nor a flag's value, wherever it stands
  const root = resolve(args.find((arg, at) => !arg.startsWith("--") && !VALUED.includes(args[at - 1])) ?? "."), amux = option("--amux-root");
  // --report prints code health's JSON of a commit (--rev, HEAD by default) read from git, never the disk (report.mjs, Cut row 1877)
  if (args.includes("--report")) {
    try { console.log(JSON.stringify(reportOf(root, {rev: option("--rev"), since: option("--since"), repo: option("--repo")}))); }
    catch (error) { console.error(`arch-check: cannot report: ${error.message}`); process.exitCode = 2; }
  } else {
    const config = JSON.parse(readFileSync(resolve(root, "arch.config.json"), "utf8")), baselinePath = resolve(root, config.baseline ?? "arch.baseline.json");
    const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
    // --init writes a first baseline only; an existing one only shrinks, as guard/run.mjs holds it (Cut row 1868: no writer of the baseline raises a count)
    if (args.includes("--init") && Object.keys(baseline).length) { console.error("arch-check: the existing baseline only shrinks; use --lower"); process.exit(1); }
    // a rule that cannot run (a contract rule without AMUX, an unknown kind) stops the run before any baseline is read or written: it never reads as a pass
    const {red, told, counts} = await check(root, config, args.includes("--init") ? {} : baseline, {amuxRoot: amux, today: option("--today")})
      .catch(error => { console.error(`arch-check: cannot run: ${error.message}`); process.exit(2); });
    if (args.includes("--init")) { writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + "\n"); console.log(`arch-check: baseline written (${Object.keys(counts).length} entries)`); }
    else if (args.includes("--lower")) {
      const lowered = Object.fromEntries(Object.entries(baseline).flatMap(([key, allowed]) => (counts[key] ?? 0) > 0 ? [[key, Math.min(allowed, counts[key])]] : []));
      const raised = Object.keys(counts).filter(key => counts[key] > (baseline[key] ?? 0));
      if (raised.length) { console.error(`arch-check: ${raised.length} entries grew, fix them first (--lower never raises)`); process.exit(1); }
      writeFileSync(baselinePath, JSON.stringify(lowered, null, 2) + "\n"); console.log(`arch-check: baseline lowered to ${Object.keys(lowered).length} entries`);
    } else if (red.length) { console.error([...told, ...red].join("\n")); process.exit(1); }
    else {   // a breach a rule tells before its failsFrom day is printed and does not fail the run
      if (told.length) console.error(told.join("\n"));
      const units = Object.values(baseline).reduce((sum, n) => sum + n, 0);
      console.log(`arch-check: ${config.rules.length} rules hold, baseline ${Object.keys(baseline).length} entries (${units} units)`);
    }
  }
}
