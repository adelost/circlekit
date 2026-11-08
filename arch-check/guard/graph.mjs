// The parsed module doors and directed graph of the architecture guard, from Cut (tools/dev/cloud_module_rules.mjs at a34aaa239, rows 1773, 1777) with a mandatory source root, a door per module
// (entry, a name or a list, or "*" for every file directly in the module) and modules owned by the longest folder. A rule reads TypeScript, JavaScript and the script of a Svelte file, or with lang "py" Python or with lang "kt" Kotlin. Legacy debt is named by source and target, never pooled per file. The ratchet is ratchet.mjs. row 1785.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, posix, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { cyclesOf } from './cycles.mjs';
import { pythonTargets } from './python.mjs';
import { kotlinIndex, kotlinTargets } from './kotlin.mjs';

// The compiler API of TypeScript 5 (typescript-5, an npm alias, or typescript itself); a 7.x package has none.
const load = createRequire(import.meta.url);
const ts = ['typescript-5', 'typescript'].map(name => { try { return load(name); } catch { return null; } }).find(api => typeof api?.createSourceFile === 'function');
if (!ts) throw Error('arch-check: the parser needs the TypeScript 5 compiler API: npm i -D typescript@5.9.3 (or typescript-5@npm:typescript@5.9.3 beside a newer typescript)');

const WORKERS = new Set(['Worker', 'SharedWorker']);
/** `new URL('<path>', import.meta.url)`: the node of its path literal (a file named from this one's own place), else null. */
const urlPathOf = (tree, node) => ts.isNewExpression(node) && node.expression.getText(tree) === 'URL' && node.arguments?.length >= 2 && node.arguments[1].getText(tree) === 'import.meta.url' ? node.arguments[0] : null;
/** The path literals a loader is given: its string, a template's fixed start (import(`./x/${n}.js`) names ./x/), or the `new URL('<path>', import.meta.url)` inside it, also in a condition. A URL read by itself loads nothing. */
function pathsGiven(tree, arg) {
  if (!arg) return [];
  if (ts.isStringLiteralLike(arg)) return [arg];
  if (ts.isTemplateExpression(arg)) return [arg.head];
  const found = [], look = node => { const path = urlPathOf(tree, node); if (path && ts.isStringLiteralLike(path)) found.push(path); ts.forEachChild(node, look); };
  look(arg);
  return found;
}

// The specifiers a JavaScript, TypeScript or Svelte file names (import, export-from, import(), require(), Worker), in the order the parser reaches them. They depend only on the file's text, its name's extensions and the
// parser's version, so with ARCH_CACHE_DIR set they are kept by that content: a run after a rebase parses again only the files that changed, and the rules of a repository share one parse of each file. A cache that
// cannot be read or written is no cache, nothing else changes; without the variable nothing is kept. row 1795.
const kept = { file: null, map: null, touched: new Set(), grew: false };
const cacheFile = () => process.env.ARCH_CACHE_DIR ? join(process.env.ARCH_CACHE_DIR, `imports-ts${ts.version}.json`) : null;
const keptSpecs = file => {
  if (kept.file !== file) {
    kept.file = file; kept.touched = new Set(); kept.grew = false;
    try { const map = JSON.parse(readFileSync(file, 'utf8')); kept.map = map && typeof map === 'object' && !Array.isArray(map) ? map : {}; } catch { kept.map = {}; }
  }
  return kept.map;
};
/** Writes what this run used, once every rule has read its files (a rule that reads a part of the tree must not prune what another reads); entries no file of this run has are dropped. Nothing is written when nothing is new. */
export function saveImportCache() {
  const file = cacheFile();
  if (!file || kept.file !== file || !kept.grew && Object.keys(kept.map).length === kept.touched.size) return;
  try {
    mkdirSync(join(file, '..'), { recursive: true });
    const used = Object.fromEntries(Object.entries(kept.map).filter(([key]) => kept.touched.has(key))), part = `${file}.${process.pid}.tmp`;
    writeFileSync(part, JSON.stringify(used)); renameSync(part, file);
    kept.map = used; kept.grew = false;
  } catch { /* a cache that cannot be written is no cache */ }
}
function specsOf(file, body) {
  const path = cacheFile(), map = path ? keptSpecs(path) : null;
  const key = map ? createHash('sha256').update(`${file.slice(file.lastIndexOf('/') + 1).replace(/^[^.]*/, '')}\0${body}`).digest('hex').slice(0, 32) : null;
  if (key) { kept.touched.add(key); if (Array.isArray(map[key])) return map[key]; }
  const svelte = file.endsWith('.svelte'), text = svelte ? [...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(one => one[1]).join('\n') : body;
  const tree = ts.createSourceFile(svelte ? `${file}.ts` : file, text, ts.ScriptTarget.Latest, true), found = [];
  const visit = node => {
    let named = [];
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) named = [node.moduleSpecifier];
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) named = [node.argument.literal];
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require')) named = pathsGiven(tree, node.arguments[0]);
    else if (ts.isNewExpression(node) && WORKERS.has(node.expression.getText(tree))) named = pathsGiven(tree, node.arguments?.[0]);
    for (const literal of named) if (literal && (ts.isStringLiteralLike(literal) || ts.isTemplateHead(literal))) found.push(literal.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (key) { map[key] = found; kept.grew = true; }
  return found;
}

/** With `workspaces` (row 1022, Huset): the repository's own packages, each by its package.json name, with the files its "exports" (or "main") name, keyed by the subpath
 *  an import asks for ("." or "./presentation"), as Node resolves an import of the package by name. What a package exports is its door. */
function workspacePackages(root) {
  const manifests = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z', '--', '*package.json'], { encoding: 'utf8' }).split('\0')
    .filter(file => /(?:^|\/)package\.json$/.test(file) && file.includes('/') && !/(?:^|\/)(?:vendor|node_modules|dist)\//.test(file));
  const fileOf = to => typeof to === 'string' ? to : to && typeof to === 'object' ? fileOf(to.import ?? to.default ?? Object.values(to)[0]) : null;   // a condition's file: import, else default, else the first
  return manifests.flatMap(manifest => {
    const json = JSON.parse(readFileSync(resolve(root, manifest), 'utf8')), dir = posix.dirname(manifest), top = json.exports;
    if (typeof json.name !== 'string') return [];
    const subpaths = top === undefined ? (json.main ? { '.': json.main } : {}) : typeof top === 'string' || !Object.keys(top).some(key => key.startsWith('.')) ? { '.': top } : top;
    const doors = new Map(Object.entries(subpaths).map(([subpath, to]) => [subpath, fileOf(to)]).filter(([, to]) => to).map(([subpath, to]) => [subpath, posix.normalize(posix.join(dir, to))]));
    return [{ name: json.name, dir, doors }];
  }).sort((a, b) => b.name.length - a.name.length);
}

export { ts };
/** A modules rule's door files of a module, relative to it: its entry, the rule's, or the language's (`*`: every file directly in it). */
export const moduleDoors = (rule, m) => [m.entry ?? rule.entry ?? (rule.lang === 'py' ? '__init__.py' : rule.lang === 'kt' ? '*' : 'index.js')].flat();
/** The files a modules rule reads (tracked and untracked, its language's, no vendor, node_modules, dist or dot folder) and the module owning each, the longest folder. */
export function moduleFiles(root, rule) {
  const python = rule.lang === 'py', kotlin = rule.lang === 'kt';
  const files = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\0').filter(file => (python ? /\.py$/ : kotlin ? /\.kt$/ : /\.(?:[cm]?[jt]sx?|svelte)$/).test(file) && !/(?:^|\/)(?:vendor|node_modules|dist)\//.test(file) && !/(?:^|\/)\./.test(file) && existsSync(resolve(root, file)));
  const modules = [...rule.modules].sort((a, b) => b.dir.length - a.dir.length);
  return { files, modules, owner: file => modules.find(m => file.startsWith(`${m.dir}/`)) };
}

export function moduleCounts(root, rule) {
  const python = rule.lang === 'py', kotlin = rule.lang === 'kt', counts = {}, reasons = new Map(), SRC = rule.root, edgesOnly = rule.edgesOnly === true;   // edgesOnly (K10): who may import whom, no doors
  const hit = (name, reason) => { const key = `${rule.id}:${name}`; counts[key] = (counts[key] ?? 0) + 1; reasons.set(key, reason); };
  const { files, modules, owner } = moduleFiles(root, rule), known = new Set(files), graph = new Map(modules.map(m => [m.dir, new Set()]));
  const packages = rule.workspaces === true ? workspacePackages(root) : [], exported = new Set(packages.flatMap(p => [...p.doors.values()]));   // off unless a rule asks
  const packageOf = spec => packages.find(p => spec === p.name || spec.startsWith(`${p.name}/`));
  const doorsOf = m => moduleDoors(rule, m);   // a module's public files, relative to it
  const isDoor = (into, base) => exported.has(base) || [into.dir, `${into.dir}/index`, `${into.dir}/index.js`].includes(base) || doorsOf(into).some(door => door === '*' ? posix.dirname(base) === into.dir : base === `${into.dir}/${door}`);
  if (!edgesOnly) for (const dir of readdirSync(resolve(root, SRC), { withFileTypes: true }).filter(e => e.isDirectory())) {
    const name = `${SRC}/${dir.name}`;
    if ((rule.excludeFolders ?? []).includes(dir.name)) continue;
    if ((rule.assetFolders ?? []).includes(dir.name) && !files.some(file => file.startsWith(`${name}/`))) continue;
    if (!modules.some(m => m.dir === name)) hit(`undeclared:${name}`, `${name}: declare the module and its allowed imports in ${rule.id}`);
  }
  for (const m of modules) {
    if (!edgesOnly && !doorsOf(m).includes('*') && !doorsOf(m).some(door => existsSync(resolve(root, m.dir, door)))) hit(`missing-index:${m.dir}`, `${m.dir}: add its public ${doorsOf(m).join(' or ')}`);
    if (!edgesOnly && rule.example && !existsSync(resolve(root, m.dir, rule.example))) hit(`missing-example:${m.dir}`, `${m.dir}: add its ${rule.example} sandbox`);
    for (const dep of m.imports) if (!graph.has(dep)) hit(`unknown-dependency:${m.dir}>${dep}`, `${m.dir}: unknown allowed module ${dep}`);
  }
  const targetOf = (file, spec) => {
    const named = packageOf(spec), subpath = named && `.${spec.slice(named.name.length)}`;
    const base = named ? named.doors.get(subpath) ?? posix.join(named.dir, subpath) : rule.publicPrefix && spec.startsWith(rule.publicPrefix)
      ? posix.join(SRC, spec.slice(rule.publicPrefix.length)) : posix.normalize(posix.join(posix.dirname(file), spec));
    const target = [base, `${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`,
      ...(/\.js$/.test(base) ? [base.replace(/\.js$/, '.ts')] : [])].find(p => known.has(p));
    return { base, target: target ?? base };
  };
  const index = kotlin ? kotlinIndex(files, file => readFileSync(resolve(root, file), 'utf8')) : null;
  const consider = (file, from, base, target) => {
    const into = owner(target);
    if (rule.closed && from && !into) hit(`outside:${file}>${target}`, `${file}: ${from.dir} imports ${target}, outside ${modules.map(m => m.dir).join(' and ')}; ${rule.id} lets it reach nothing else`);
    if (rule.rootEdges && from && posix.dirname(target) === SRC && !(from.rootImports ?? []).includes(target))
      hit(`root-edge:${file}>${target}`, `${file}: ${from.dir} may not reach root file ${target}; use its declared public door`);
    if (into && into !== from) {
      if (!edgesOnly && !isDoor(into, base)) hit(`deep:${file}>${target}`, `${file}: reach ${target} through ${into.dir}/${doorsOf(into).join(' or ')}`);
      if (from) {
        graph.get(from.dir).add(into.dir);
        if (!from.imports.includes(into.dir)) hit(`edge:${file}>${into.dir}`, `${file}: ${from.dir} may not import ${into.dir}; ${rule.id} declares its dependencies`);
      }
    }
  };
  for (const file of files.filter(file => !rule.onlyFrom || file.startsWith(rule.onlyFrom))) {
    const body = readFileSync(resolve(root, file), 'utf8'), from = owner(file);
    if (python) { for (const target of pythonTargets(body, file, rule.sourceRoots ?? [SRC], known)) consider(file, from, target, target); continue; }
    if (kotlin) { for (const target of kotlinTargets(body, file, index)) consider(file, from, target, target); continue; }
    for (const spec of specsOf(file, body)) if (spec.startsWith('.') || (rule.publicPrefix && spec.startsWith(rule.publicPrefix)) || packageOf(spec)) {
      const { base, target } = targetOf(file, spec);
      consider(file, from, base, target);
    }
  }
  if (rule.acyclic) for (const component of cyclesOf(graph)) {
    for (const from of component) for (const to of graph.get(from)) if (component.includes(to))
      hit(`cycle:${from}>${to}`, `${from} -> ${to}: module cycle ${component.join(' -> ')}; break this dependency`);
  }
  return { counts, reasons };
}
