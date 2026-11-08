// The parsed module doors and directed graph of the architecture guard, from Cut (tools/dev/cloud_module_rules.mjs at a34aaa239, rows 1773, 1777) with a mandatory source root, a door per module
// (entry, a name or a list, or "*" for every file directly in the module) and modules owned by the longest folder. A rule reads TypeScript, JavaScript and the script of a Svelte file, or with lang "py" Python. Legacy debt is named by source and target, never pooled per file. The ratchet is ratchet.mjs. row 1785.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import ts from 'typescript';
import { cyclesOf } from './cycles.mjs';
import { pythonTargets } from './python.mjs';

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

export function moduleCounts(root, rule) {
  const python = rule.lang === 'py', counts = {}, reasons = new Map(), SRC = rule.root, entry = rule.entry ?? (python ? '__init__.py' : 'index.js'), edgesOnly = rule.edgesOnly === true;   // edgesOnly (K10): who may import whom, no doors
  const hit = (name, reason) => { const key = `${rule.id}:${name}`; counts[key] = (counts[key] ?? 0) + 1; reasons.set(key, reason); };
  const files = execFileSync('git', ['-C', root, 'ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    .split('\0').filter(file => (python ? /\.py$/ : /\.(?:[cm]?[jt]sx?|svelte)$/).test(file) && !/(?:^|\/)(?:vendor|node_modules|dist)\//.test(file) && !/(?:^|\/)\./.test(file) && existsSync(resolve(root, file)));
  const known = new Set(files), modules = [...rule.modules].sort((a, b) => b.dir.length - a.dir.length), graph = new Map(modules.map(m => [m.dir, new Set()]));
  const doorsOf = m => [m.entry ?? entry].flat();   // a module's public files, relative to it
  const isDoor = (into, base) => [into.dir, `${into.dir}/index`, `${into.dir}/index.js`].includes(base) || doorsOf(into).some(door => door === '*' ? posix.dirname(base) === into.dir : base === `${into.dir}/${door}`);
  const owner = file => modules.find(m => file.startsWith(`${m.dir}/`));
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
    const base = rule.publicPrefix && spec.startsWith(rule.publicPrefix)
      ? posix.join(SRC, spec.slice(rule.publicPrefix.length)) : posix.normalize(posix.join(posix.dirname(file), spec));
    const target = [base, `${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`,
      ...(/\.js$/.test(base) ? [base.replace(/\.js$/, '.ts')] : [])].find(p => known.has(p));
    return { base, target: target ?? base };
  };
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
    const text = file.endsWith('.svelte') ? [...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(one => one[1]).join('\n') : body;
    const tree = ts.createSourceFile(file.endsWith('.svelte') ? `${file}.ts` : file, text, ts.ScriptTarget.Latest, true);
    const visit = node => {
      let named = [];
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) named = [node.moduleSpecifier];
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) named = [node.argument.literal];
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require')) named = pathsGiven(tree, node.arguments[0]);
      else if (ts.isNewExpression(node) && WORKERS.has(node.expression.getText(tree))) named = pathsGiven(tree, node.arguments?.[0]);
      for (const literal of named) if (literal && (ts.isStringLiteralLike(literal) || ts.isTemplateHead(literal)) && (literal.text.startsWith('.') || (rule.publicPrefix && literal.text.startsWith(rule.publicPrefix)))) {
        const { base, target } = targetOf(file, literal.text);
        consider(file, from, base, target);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }
  if (rule.acyclic) for (const component of cyclesOf(graph)) {
    for (const from of component) for (const to of graph.get(from)) if (component.includes(to))
      hit(`cycle:${from}>${to}`, `${from} -> ${to}: module cycle ${component.join(' -> ')}; break this dependency`);
  }
  return { counts, reasons };
}
