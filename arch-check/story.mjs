// story.mjs: the kinds that keep code reading as a story (Cut row 1873, Mattias 8 Nov via sandman:0): short functions with the main steps on top,
// the helpers below. `eslint` counts one ESLint rule per file; `first-line` asks each file's first line to say what the file is for; `story-order`
// asks a file that exports inline to put its exports above its private helpers; `stepdown` asks each function to stand below every function that
// calls it, and `stepdown-order` names the functions out of the order their first calls are read in. ESLint, its TypeScript parser and the plugins
// come from the repository, as TypeScript does for the guard's reader, and Python files are read by the repository's python3: no dependency here.
import {execFileSync} from "node:child_process";
import {existsSync, readFileSync} from "node:fs";
import {createRequire, Module} from "node:module";
import {join, relative, sep} from "node:path";

const CODE = /\.(js|mjs|cjs|ts|tsx|mts|cts)$/;
const PY = /\.py$/;
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "do", "else", "try", "with", "function", "new", "await", "typeof"]);
const PLUGINS = {"@typescript-eslint": load => load("typescript-eslint").plugin, sonarjs: load => load("eslint-plugin-sonarjs")};
const STORY = "Story first: the file's exports on top, helpers below (Clean Code stepdown rule).";

export const storyKinds = {
  /** {rule, options?, exported?, skip?}: the ESLint rule's breaches per file, each with the function it names; every eslint rule of the config runs in
   *  one ESLint pass. `exported: true` keeps only breaches on the head of a top-level exported function (a file's API, as max-params is meant);
   *  `skip` names functions that hold no logic of their own, by name or /regex/ (a suite's feature or describe wrapper, a create* factory whose
   *  inner functions are counted each); `loops: N` lets max-depth reach N where a loop is part of the nesting (the trial's verdict: 4 in loops). */
  eslint: async (rule, repo) => {
    const byFile = await linted(repo), mine = new Set(repo.covered(rule)), ts = rule.exported || rule.loops ? typescriptOf(repo.root) : null, heads = new Map();
    const headsOf = file => heads.get(file) ?? heads.set(file, exportedHeads(ts, file, repo.read(file))).get(file);
    const kept = (file, m) => (!rule.exported || headsOf(file).some(([from, to]) => m.line >= from && m.line <= to)) && !loopDepth(ts, rule, file, repo.read(file), m);
    const skipped = (rule.skip ?? []).map(name => /^\/.*\/$/.test(name) ? new RegExp(name.slice(1, -1)) : new RegExp(`^${name}$`));   // a suite's wrapper is no function of logic
    return [...byFile].filter(([file]) => mine.has(file)).flatMap(([file, messages]) => messages.filter(m => m.ruleId === rule.rule && kept(file, m))
      .map(m => ({file, line: m.line, at: functionAt(repo.read(file), m.line, m.message), m})).filter(h => !skipped.some(re => re.test(h.at.slice(5, -1))))
      .map(({file, line, at, m}) => ({file, line, message: `${m.message.replace(/\.$/, "")}${at}`})));
  },
  /** The first line (after a shebang, and in Python a coding line) says what the file is for: a `//` comment or a block comment that opens with
   *  words on that line; in Python a `#` comment or a docstring that opens with its summary (Cut's trial: a header's first line counts). */
  "first-line": (rule, repo) => repo.covered(rule).flatMap(file => oneLineComment(repo.read(file), PY.test(file)) ? []
    : [{file, line: 1, message: "the first line does not say what the file is for"}]),
  /** A file that exports inline (export function, export const) keeps its exports above its private helpers; a file that exports by a list is
   *  left alone, the list being its table of contents. In Python a _private def or class stays below the file's last public def. Each helper above
   *  the last export is one hit, named. */
  "story-order": (rule, repo) => {
    const files = repo.covered(rule), js = files.filter(file => CODE.test(file)), ts = js.length ? typescriptOf(repo.root) : null;
    const hits = [...js.map(file => ({file, above: helpersAbove(ts, file, repo.read(file))})),
      ...pythonUnits(repo, files.filter(file => PY.test(file))).map(({file, units, items}) => ({file, above: privateAbove(units, items)}))];
    return hits.flatMap(({file, above}) => above.map(({name, line, last}) => ({file, line, message: `${STORY} Move ${name} below ${last}`})));
  },
  /** No silent exceptions (Mattias 8 Nov via sandman:0): each inline exception (eslint-disable, @ts-ignore, @ts-expect-error, @ts-nocheck, and the
   *  rule's own `markers`, regexes) names what it turns off and carries `lint-allow <that>: why; until YYYY-MM-DD` on its line or the line above, its
   *  until not passed; each file of `configs` that turns a rule off ("rule": "off" or 0) has a decision allowing file:rule. Counted per file and
   *  rule; `all: true` counts every exception, allowed or not (a report rule). */
  exceptions: (rule, repo) => {
    const today = new Date().toISOString().slice(0, 10), allowed = allowedOff(repo.root, today);
    const inline = repo.covered(rule).flatMap(file => exceptionsIn(repo.read(file), rule.markers ?? [], today).filter(e => rule.all || e.fault)
      .map(e => ({file, line: e.line, at: e.what, message: e.fault ?? `${e.what} is allowed until ${e.until}`})));
    const off = (rule.configs ?? []).filter(file => repo.files.includes(file)).flatMap(file => turnedOff(repo.read(file))
      .filter(e => rule.all || !allowed.has(`${file}:${e.what}`)).map(e => ({file, line: e.line, at: e.what,
        message: allowed.has(`${file}:${e.what}`) ? `${e.what} is off by a decision` : `${file} turns ${e.what} off without a decision; name it in arch.decisions.json allows ("${file}:${e.what}": why) with until`})));
    return [...inline, ...off];
  },
  /** Stepdown (Clean Code ch. 3): a function never stands above a function of its file that calls it, so the file reads from the top down. A
   *  function that calls itself or functions that call each other are exempt, and so is a helper's call of an export where story-order puts the
   *  exports first. One hit per function, naming its lowest caller. */
  stepdown: (rule, repo) => graphs(rule, repo).flatMap(({file, units, tiered}) => aboveCallers(units, tiered).map(({unit, caller}) =>
    ({file, line: unit.line, message: `Story first (stepdown): ${unit.name} is called by ${caller.name}; place it below ${caller.name}`}))),
  /** Report only: the functions in the order their first calls are read, depth first (each export's helpers follow it, a helper's own helpers
   *  follow it). Each function out of that order, by the fewest moves that restore it, is one hit. */
  "stepdown-order": (rule, repo) => graphs(rule, repo).flatMap(({file, units, tiered}) => outOfOrder(units, tiered).map(({unit, after}) =>
    ({file, line: unit.line, message: `Story first (order): ${unit.name} is not where its first call is read; place it ${after ? `right after ${after.name}` : "first"}`}))),
};

/** What story-fix.mjs reads of a file's story. */
export {aboveCallers, exportList, functionsOf, helpersAbove, holding, inlineExport, lineOf, parsed, privateAbove, pythonUnits, referencesIn, tsUnits, typescriptOf};

const DIRECTIVE = /(?:\/\/|\/\*|^\s*\*)\s*(eslint-disable(?:-next-line|-line)?|@ts-ignore|@ts-expect-error|@ts-nocheck)\b([^\n]*)/;
const ALLOW = /lint-allow\s+([@\w/.-]+)\s*:\s*([^;\n]*\S)\s*;\s*until\s+(\d{4}-\d\d-\d\d)/g;

/** Each exception of a file, with what it turns off, its until, and its fault if it has one: no rule named, no lint-allow for it, or a passed until. */
function exceptionsIn(text, markers, today) {
  const lines = text.split("\n"), extra = markers.map(m => new RegExp(m));
  return lines.flatMap((line, at) => {
    const found = DIRECTIVE.exec(line), mark = extra.find(re => re.test(line)), allows = [...`${lines[at - 1] ?? ""}\n${line}`.matchAll(ALLOW)];
    if (!found && !mark) return [];
    const named = found?.[1].startsWith("eslint") ? found[2].replace(/\*\/.*/, "").split("--")[0].split(",").map(r => r.trim()).filter(Boolean)
      : [found ? found[1].slice(1) : mark.source];
    if (!named.length) return [{line: at + 1, what: found[1], fault: `${found[1]} names no rule; name the rule it turns off (no unlimited disable)`}];
    return named.map(what => {
      const allow = allows.find(a => a[1] === what);
      const fault = !allow ? `${found?.[1] ?? "an exception"} of ${what} has no lint-allow; write // lint-allow ${what}: why; until YYYY-MM-DD on its line or the line above, or fix the code`
        : allow[3] < today ? `the lint-allow of ${what} was until ${allow[3]}; fix the code, or decide a later until` : null;
      return {line: at + 1, what, until: allow?.[3], fault};
    });
  });
}

/** The rules a config file turns off: `"rule": "off"` or `"rule": 0`, also as the first of an array. */
function turnedOff(text) {
  return text.split("\n").flatMap((line, at) => [...line.matchAll(/["']([@\w/.-]+)["']\s*:\s*\[?\s*(?:["']off["']|0\b)/g)].map(m => ({line: at + 1, what: m[1]})));
}

/** The config file:rule keys that a decision in arch.decisions.json allows and whose until has not passed. */
function allowedOff(root, today) {
  const path = join(root, "arch.decisions.json"), decisions = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
  return new Set(decisions.filter(d => d?.allows && (d.until ?? "") >= today).flatMap(d => Object.keys(d.allows)));
}

/** The rule's message names its function when ESLint's does not (a cognitive complexity, a depth): the declaration on the reported line. */
function functionAt(text, line, message) {
  if (/'[^']+'/.test(message)) return "";
  const code = text.split("\n")[line - 1] ?? "";
  const name = /function\*?\s+([\w$]+)/.exec(code)?.[1] ?? /([\w$]+)\s*[:=]\s*(?:async\s*)?(?:function\b|\(|[\w$]+\s*=>)/.exec(code)?.[1]
    ?? /^\s*(?:async\s+|static\s+|get\s+|set\s+)*([\w$]+)\s*\(/.exec(code)?.[1];
  return name && !KEYWORDS.has(name) ? ` (in ${name})` : "";
}

/** Whether a max-depth hit stands within the rule's `loops` depth inside a loop: its message's depth, and a loop among the reported block's
 *  enclosing statements up to its function. */
function loopDepth(ts, rule, file, text, m) {
  const depth = Number(/nested too deeply \((\d+)\)/.exec(m.message)?.[1]);
  if (!rule.loops || !depth || depth > rule.loops) return false;
  const src = parsed(ts, file, text, true), starts = [0, ...[...text.matchAll(/\n/g)].map(n => n.index + 1)], offset = starts[m.line - 1] + m.column - 1;
  let found = null;
  const visit = node => { if (node.getStart(src) <= offset && offset < node.getEnd()) { found = node; ts.forEachChild(node, visit); } };
  ts.forEachChild(src, visit);
  for (let node = found; node && !ts.isFunctionLike(node); node = node.parent) if (ts.isIterationStatement(node, false)) return true;
  return false;
}

/** The lines of each top-level exported function's head, from its statement to the start of its body. */
function exportedHeads(ts, file, text) {
  const src = parsed(ts, file, text, false), lineAt = pos => lineOf(src, null, pos);
  return src.statements.filter(s => inlineExport(ts, s)).flatMap(s => functionsOf(ts, s).map(({body}) => [lineOf(src, s), lineAt((body.body ?? body).getStart(src))]));
}

function oneLineComment(text, python) {
  const first = text.replace(/^#!.*\n/, "").replace(python ? /^#.*coding[:=].*\n/ : /^$/, "").split("\n")[0].trim();
  if (python) return /^#\s*\S/.test(first) || /^("""|''')\s*\w/.test(first);   // a docstring's first line is its summary (PEP 257)
  return /^\/\/.*\S/.test(first) && first !== "//" || /^\/\*\*?\s*\w/.test(first);   // a block comment that says what on its first line
}

/** Each private helper above the last inline export, less a const helper that top-level code uses at load (it must stay above that code; Huset's
 *  trial: FLOORS = slabs() would throw). A function declaration is hoisted and moves freely. */
function helpersAbove(ts, file, text) {
  const src = parsed(ts, file, text, true);
  if (exportList(ts, src)) return [];
  const inline = s => inlineExport(ts, s);
  const statements = [...src.statements], at = statements.findLastIndex(inline);
  if (at < 0) return [];
  const last = statements[at].name?.text ?? statements[at].declarationList?.declarations[0].name.getText(src) ?? "the last export";
  const names = new Set(statements.flatMap(s => functionsOf(ts, s).map(f => f.name)));
  const top = new Set(statements.filter(s => !functionsOf(ts, s).length && !ts.isImportDeclaration(s) && !ts.isExportDeclaration(s)).flatMap(s => referencesIn(ts, s, names)));
  return statements.slice(0, at).filter(s => !inline(s) && (ts.isFunctionDeclaration(s) || !functionsOf(ts, s).some(f => top.has(f.name))))
    .flatMap(s => functionsOf(ts, s).slice(0, 1).map(({name}) => ({name, line: lineOf(src, s), last})));
}

/** Python's story-order: each _private def or class above the file's last public def, less one that module code uses at load (a module-level
 *  call, a decorator, a default, a class body), which must stay above that code. */
function privateAbove(units, items = []) {
  const at = units.findLastIndex(u => u.kind === "def" && u.exported), top = new Set(items.flatMap(i => i.load));
  return at < 0 ? [] : units.slice(0, at).filter(u => !u.exported && !top.has(u.name)).map(({name, line}) => ({name, line, last: units[at].name}));
}

/** Each file's top-level functions in file order, with the file's other top-level functions each one calls, in the order of their first call. A
 *  tiered file is one where story-order holds the exports first (an inline export in JS/TS; every Python file, its public defs being its exports). */
function graphs(rule, repo) {
  const files = repo.covered(rule), js = files.filter(file => CODE.test(file)), ts = js.length ? typescriptOf(repo.root) : null;
  repo.storyUnits ??= new Map();
  const ofJs = file => repo.storyUnits.get(file) ?? repo.storyUnits.set(file, tsUnits(ts, file, repo.read(file))).get(file);
  return [...js.map(file => ({file, ...ofJs(file)})),
    ...pythonUnits(repo, files.filter(file => PY.test(file))).map(({file, units, items}) => {
      const top = new Set(items.filter(i => i.kind !== "def").flatMap(i => i.load));
      return {file, units: units.filter(u => u.kind === "def").map(u => ({...u, top: top.has(u.name)})), tiered: true};
    })];
}

function tsUnits(ts, file, text) {
  const src = parsed(ts, file, text, true), listed = exportList(ts, src);
  const found = src.statements.flatMap(s => functionsOf(ts, s).map(({name, body}) => ({name, line: lineOf(src, s), exported: !listed && inlineExport(ts, s),
    hoisted: ts.isFunctionDeclaration(s), body})));
  const names = new Set(found.map(u => u.name)), loose = src.statements.filter(s => !functionsOf(ts, s).length && !ts.isImportDeclaration(s) && !ts.isExportDeclaration(s));
  const top = new Set(loose.flatMap(s => referencesIn(ts, s, names)));   // what top-level code uses: a test's it() callbacks, a script's main line
  const units = found.map(({body, ...unit}) => ({...unit, top: top.has(unit.name), calls: referencesIn(ts, body, names)}));
  return {units, tiered: !listed && src.statements.some(s => inlineExport(ts, s))};
}

/** A function declaration with a body, or a const holding an arrow or a function expression (each declarator its own function). */
function functionsOf(ts, s) {
  if (ts.isFunctionDeclaration(s)) return s.name && s.body ? [{name: s.name.text, body: s}] : [];
  if (!ts.isVariableStatement(s)) return [];
  return s.declarationList.declarations.filter(d => ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)))
    .map(d => ({name: d.name.text, body: d.initializer}));
}

/** The file's own function names a body refers to, in the order of first reference; a name the body declares again (a parameter, a local) is not the
 *  file's function there, so it is left out. A reference counts whether it is called or passed on (`list.map(helper)`). */
function referencesIn(ts, body, names) {
  const shadowed = new Set(), seen = [];
  const visit = node => {
    if (ts.isIdentifier(node) && names.has(node.text)) {
      if (declares(ts, node)) shadowed.add(node.text);
      else if (refers(ts, node)) seen.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(body, visit);
  return [...new Set(seen)].filter(name => !shadowed.has(name));
}

function declares(ts, id) {
  const p = id.parent;
  return (ts.isVariableDeclaration(p) || ts.isParameter(p) || ts.isBindingElement(p) || ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)
    || ts.isClassDeclaration(p) || ts.isClassExpression(p)) && p.name === id;
}

function refers(ts, id) {
  const p = id.parent, named = p.name === id;
  if (ts.isPropertyAccessExpression(p) || ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p)
    || ts.isGetAccessor(p) || ts.isSetAccessor(p) || ts.isEnumMember(p) || ts.isJsxAttribute(p)) return !named;
  return !(ts.isBindingElement(p) || ts.isQualifiedName(p) || ts.isTypeReferenceNode(p) || ts.isTypeQueryNode(p) || ts.isImportSpecifier(p)
    || ts.isExportSpecifier(p) || ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p));
}

/** Each function above a caller that holds it: one per function, with its lowest caller. */
function aboveCallers(units, tiered) {
  const holds = holding(units, tiered);
  return units.flatMap((unit, i) => {
    const callers = units.filter((caller, k) => k > i && caller.calls.includes(unit.name) && holds(caller, unit));
    return callers.length ? [{unit, caller: callers.at(-1)}] : [];
  });
}

/** Whether a caller holds its callee below it: not when the two reach each other (recursion, functions that call each other: one strongly
 *  connected group), nor in a tiered file a helper's call of an export, which story-order puts first, nor when top-level code uses the callee too
 *  (a test fixture its it() callbacks share; moving it below a caller could also leave it undefined where that code runs). */
function holding(units, tiered) {
  const at = new Map(units.map((u, i) => [u.name, i])), group = groups(units);
  return (caller, callee) => !callee.top && group[at.get(caller.name)] !== group[at.get(callee.name)] && !(tiered && callee.exported && !caller.exported);
}

/** Tarjan's strongly connected groups over the calls: functions that reach each other share a group. */
function groups(units) {
  const at = new Map(units.map((u, i) => [u.name, i])), group = [], order = [], low = [], stack = [], on = new Set();
  let seen = 0;
  const visit = i => {
    order[i] = low[i] = seen++; stack.push(i); on.add(i);
    for (const k of units[i].calls.map(name => at.get(name)).filter(k => k !== undefined)) {
      if (order[k] === undefined) visit(k);
      if (on.has(k)) low[i] = Math.min(low[i], low[k]);
    }
    if (low[i] === order[i]) for (let k = -1; k !== i;) { k = stack.pop(); on.delete(k); group[k] = i; }
  };
  units.forEach((_, i) => order[i] === undefined && visit(i));
  return group;
}

/** The functions no rising run of the story order keeps, each with the function it should follow. */
function outOfOrder(units, tiered) {
  const expected = storyOrder(units, tiered), rank = new Map(expected.map((unit, r) => [unit, r])), kept = longestRising(units.map(unit => rank.get(unit)));
  return units.flatMap((unit, i) => kept.has(i) ? [] : [{unit, after: expected[rank.get(unit) - 1]}]);
}

/** The order the file is read in: in a tiered file the consts that top-level code runs at load, then the exports, then the helpers; else one tier. Within a tier, in file order, each
 *  function is followed depth first by its callees in the order of first call, a callee once every caller that holds it stands above it, so a
 *  file in this order also holds stepdown. A lower tier opens with the first calls of the tiers above it. */
function storyOrder(units, tiered) {
  const at = new Map(units.map((u, i) => [u.name, i])), holds = holding(units, tiered), placed = new Set(), order = [];
  const callees = unit => unit.calls.map(name => units[at.get(name)]).filter(Boolean);
  const callers = new Map(units.map(unit => [unit, units.filter(caller => caller.calls.includes(unit.name) && holds(caller, unit))]));
  const place = (unit, tier) => {
    if (placed.has(unit) || !tier.has(unit) || !callers.get(unit).every(caller => placed.has(caller))) return;
    placed.add(unit); order.push(unit); callees(unit).forEach(callee => place(callee, tier));
  };
  const pinned = u => u.top && !u.hoisted;   // a const that top-level code runs at load stays above that code
  for (const list of tiered ? [units.filter(pinned), units.filter(u => u.exported && !pinned(u)), units.filter(u => !u.exported && !pinned(u))] : [units]) {
    const tier = new Set(list);
    [...order].forEach(above => callees(above).forEach(callee => place(callee, tier)));
    list.forEach(unit => place(unit, tier));
  }
  return [...order, ...units.filter(unit => !placed.has(unit))];   // none is left but a name declared twice
}

/** The indexes of one longest strictly rising run in a sequence. */
function longestRising(seq) {
  const tails = [], prev = [];
  seq.forEach((value, i) => {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (seq[tails[mid]] < value) lo = mid + 1; else hi = mid; }
    prev[i] = lo ? tails[lo - 1] : -1; tails[lo] = i;
  });
  const kept = new Set();
  for (let i = tails.at(-1) ?? -1; i >= 0; i = prev[i]) kept.add(i);
  return kept;
}

function parsed(ts, file, text, parents) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, parents, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

/** A file whose exports are a list (`export {a, b}`, `export default name`): the list is its table of contents. */
function exportList(ts, src) {
  return src.statements.some(s => (ts.isExportDeclaration(s) && !s.moduleSpecifier) || (ts.isExportAssignment(s) && ts.isIdentifier(s.expression)));
}

function inlineExport(ts, s) {
  return ts.canHaveModifiers(s) && (ts.getModifiers(s) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** The editor's line of a position: TypeScript also breaks lines at U+2028 and U+2029, an editor and split("\n") do not. */
function lineOf(src, s, pos = s.getStart(src)) {
  src.newlines ??= [...src.text.matchAll(/\n/g)].map(m => m.index);
  let lo = 0, hi = src.newlines.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (src.newlines[mid] < pos) lo = mid + 1; else hi = mid; }
  return lo + 1;
}

/** Python's top-level defs and classes, read by the repository's python3 in one run and kept on the run. A file Python cannot parse stops the run, as
 *  ESLint's does. */
function pythonUnits(repo, files) {
  repo.pythonRun ??= new Map();
  const missing = files.filter(file => !repo.pythonRun.has(file));
  if (missing.length) {
    const read = JSON.parse(execFileSync("python3", ["-I", "-c", PY_UNITS, repo.root], {input: JSON.stringify(missing), encoding: "utf8", maxBuffer: 256 << 20}));
    const broken = Object.entries(read).filter(([, r]) => r.error).map(([file, r]) => `${file} ${r.error}`);
    if (broken.length) throw new Error(`Python cannot read ${broken.length} file(s): ${broken.slice(0, 5).join("; ")}`);
    for (const [file, r] of Object.entries(read)) repo.pythonRun.set(file, r);
  }
  return files.map(file => ({file, ...repo.pythonRun.get(file)}));
}

/** One ESLint pass over every file an eslint rule covers, kept on the run: a map of each file to its messages. A file ESLint cannot parse stops the
 *  run (the rules cannot judge it); name it in the rule's exclude if it is meant to be so. ARCH_CACHE_DIR keeps ESLint's cache by content. */
function linted(repo) {
  repo.eslintRun ??= (async () => {
    const rules = repo.config.rules.filter(r => r.kind === "eslint");
    const files = [...new Set(rules.flatMap(r => repo.covered(r)))].filter(file => CODE.test(file));
    if (!files.length) return new Map();
    const load = createRequire(join(repo.root, "package.json")), {ESLint} = load("eslint");
    typescriptOf(repo.root);   // the parser asks for typescript; on 7.x it is given typescript-5
    const prefixes = [...new Set(rules.map(r => r.rule.includes("/") ? r.rule.slice(0, r.rule.lastIndexOf("/")) : null).filter(Boolean))];
    const plugins = Object.fromEntries(prefixes.map(p => [p, PLUGINS[p] ? PLUGINS[p](load) : load(`eslint-plugin-${p}`)]));
    const cache = process.env.ARCH_CACHE_DIR;
    const eslint = new ESLint({cwd: repo.root, overrideConfigFile: true, ignore: false, ...(cache ? {cache: true, cacheStrategy: "content", cacheLocation: join(cache, "eslint/")} : {}),
      overrideConfig: [{files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"], linterOptions: {noInlineConfig: true, reportUnusedDisableDirectives: "off"},
        languageOptions: {parser: load("typescript-eslint").parser, ecmaVersion: "latest", sourceType: "module"}, plugins,
        rules: Object.fromEntries(rules.map(r => [r.rule, r.options === undefined ? "error" : ["error", r.options]]))}]});
    const results = await eslint.lintFiles(files);
    const broken = results.flatMap(r => r.messages.filter(m => m.fatal || (!m.ruleId && /ignored/i.test(m.message))).map(m => `${relative(repo.root, r.filePath)}:${m.line} ${m.message}`));   // a file skipped is no pass
    if (broken.length) throw new Error(`ESLint cannot read ${broken.length} file(s): ${broken.slice(0, 5).join("; ")}`);
    return new Map(results.map(r => [relative(repo.root, r.filePath).split(sep).join("/"), r.messages]));
  })();
  return repo.eslintRun;
}

/** TypeScript 5's compiler API from the repository: `typescript-5` (an alias beside a newer typescript) or `typescript`. On TypeScript 7, which has
 *  none, the typescript every later require asks for (the ESLint parser's) is resolved to typescript-5 for this process. */
function typescriptOf(root) {
  const load = createRequire(join(root, "package.json")), api = name => { try { const ts = load(name); return typeof ts.createSourceFile === "function" ? ts : null; } catch { return null; } };
  const ts = api("typescript");
  if (ts) return ts;
  const five = api("typescript-5");
  if (!five) throw new Error("the story kinds need the TypeScript 5 compiler API: npm i -D typescript@5.9.3 (or typescript-5@npm:typescript@5.9.3 beside a newer typescript)");
  const path = load.resolve("typescript-5"), resolveFilename = Module._resolveFilename;
  if (!Module._resolveFilename.storyFive) Module._resolveFilename = Object.assign(function (request, ...rest) {
    return request === "typescript" ? path : resolveFilename.call(this, request, ...rest); }, {storyFive: true});
  return five;
}

/** Reads the files named on stdin (JSON) under the root in argv[1] and prints, per file, its top-level defs and classes in file order: name, line (a
 *  decorator's when it has one), kind, public, and for a def the file's names its body refers to, in the order of first reference, less the names
 *  the body binds itself (parameters, assignments, imports, inner defs); and every top-level statement as an item for --fix: its lines, kind, name,
 *  and the file's defs and classes it uses at load (a def's decorators and defaults, any other statement whole). */
const PY_UNITS = String.raw`
import ast, json, os, sys

def refs(fn, names):
    local, seen = {a.arg for a in ast.walk(fn.args) if isinstance(a, ast.arg)}, []
    for node in (n for stmt in fn.body for n in ast.walk(stmt)):
        if isinstance(node, ast.Name):
            (seen.append((node.lineno, node.col_offset, node.id)) if isinstance(node.ctx, ast.Load) else local.add(node.id))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            local.add(node.name)
        elif isinstance(node, ast.alias):
            local.add((node.asname or node.name).split('.')[0])
        elif isinstance(node, ast.arg):
            local.add(node.arg)
        elif isinstance(node, ast.ExceptHandler) and node.name:
            local.add(node.name)
    return list(dict.fromkeys(name for _, _, name in sorted(seen) if name in names and name not in local))

def units(tree):
    found = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    last = {n.name: i for i, n in enumerate(found)}
    return [{'name': n.name, 'line': min([n.lineno] + [d.lineno for d in n.decorator_list]), 'kind': 'class' if isinstance(n, ast.ClassDef) else 'def',
             'exported': not n.name.startswith('_'), 'calls': [] if isinstance(n, ast.ClassDef) else refs(n, last)} for i, n in enumerate(found) if last[n.name] == i]

def loads(node, names):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        node = [*node.decorator_list, *node.args.defaults, *[d for d in node.args.kw_defaults if d]]
    found = {n.id for one in (node if isinstance(node, list) else [node]) for n in ast.walk(one) if isinstance(n, ast.Name)}
    return sorted(found & names)

def items(tree):
    names = {n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))}
    kind = lambda n: 'def' if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) else 'class' if isinstance(n, ast.ClassDef) else 'other'
    return [{'start': min([n.lineno] + [d.lineno for d in getattr(n, 'decorator_list', [])]), 'end': n.end_lineno, 'kind': kind(n),
             'name': getattr(n, 'name', None), 'load': loads(n, names)} for n in tree.body]

out = {}
for name in json.load(sys.stdin):
    try:
        with open(os.path.join(sys.argv[1], name), encoding='utf-8') as handle:
            tree = ast.parse(handle.read(), name)
            out[name] = {'units': units(tree), 'items': items(tree)}
    except (SyntaxError, ValueError, UnicodeDecodeError) as error:
        out[name] = {'error': type(error).__name__ + ': ' + str(error)}
print(json.dumps(out))
`;
