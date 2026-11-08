// The doors of a modules rule as ratchets (0.12.0, Cut row 1828, sandman:0 8 Nov), each rule naming its modules rule in `of`:
// `lazy-imports` counts each module's import() calls, by which a cycle hides from the cycle guard (`skip`, a regex, leaves files out, such as tests,
// which no module imports; 0.12.1); `door-names` counts the names a door exports
// (export * followed), named where they pass `max`; `other-doors` asks, for each door beyond a module's first (and for "*"), a decision in
// arch.decisions.json whose `doors` says when that door goes. The first two count today's into the baseline, which only shrinks.
import { readFileSync, existsSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { moduleDoors, moduleFiles, ts } from './graph.mjs';

const sourceOf = (file, body) => ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true);
const exported = node => node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
const isDefault = node => node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);

/** The import() calls of a file, by the parser (a comment or a string that says import( is none); a file that never says it is not parsed. */
function lazyCalls(file, body) {
  if (!/\bimport\s*\(/.test(body)) return 0;
  let calls = 0;
  const visit = node => { if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) calls += 1; ts.forEachChild(node, visit); };
  visit(sourceOf(file, body));
  return calls;
}

export function lazyCounts(root, rule, of) {
  const { files, owner } = moduleFiles(root, of), counts = {}, reasons = new Map(), skip = rule.skip ? new RegExp(rule.skip) : null;
  for (const file of files.filter(file => /\.[cm]?[jt]sx?$/.test(file) && (!of.onlyFrom || file.startsWith(of.onlyFrom)) && !skip?.test(file))) {
    const from = owner(file), calls = from ? lazyCalls(file, readFileSync(resolve(root, file), 'utf8')) : 0;
    if (!calls) continue;
    const key = `${rule.id}:lazy:${from.dir}`;
    counts[key] = (counts[key] ?? 0) + calls;
    reasons.set(key, `${from.dir}: import() calls, whose computed paths ${of.id}'s cycle guard cannot follow; import through the door at the top`);
  }
  return { counts, reasons };
}

/** The file a relative specifier of `file` names, as the guard's graph finds it, or null. */
const fileNamed = (root, file, spec) => {
  const base = posix.normalize(posix.join(posix.dirname(file), spec));
  return [base, `${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`, ...(/\.js$/.test(base) ? [base.replace(/\.js$/, '.ts')] : [])]
    .find(path => existsSync(resolve(root, path)) && !path.endsWith('/')) ?? null;
};
const bindingNames = name => ts.isIdentifier(name) ? [name.text] : name.elements.flatMap(element => ts.isOmittedExpression(element) ? [] : bindingNames(element.name));

/** The names a JavaScript or TypeScript file exports, types included; `export * from` adds the names of the file it names (but its default), once. */
export function exportedNames(root, file, seen = new Set()) {
  const names = new Set();
  if (seen.has(file)) return names;
  seen.add(file);
  for (const node of sourceOf(file, readFileSync(resolve(root, file), 'utf8')).statements) {
    if (ts.isExportAssignment(node)) names.add('default');
    else if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) for (const one of node.exportClause.elements) names.add(one.name.text);
      else if (node.exportClause) names.add(node.exportClause.name.text);   // export * as name
      else if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.startsWith('.')) {
        const named = fileNamed(root, file, node.moduleSpecifier.text);
        if (named) for (const name of exportedNames(root, named, seen)) if (name !== 'default') names.add(name);
      }
    } else if (exported(node)) {
      if (ts.isVariableStatement(node)) for (const one of node.declarationList.declarations) bindingNames(one.name).forEach(name => names.add(name));
      else names.add(isDefault(node) ? 'default' : node.name?.text ?? 'default');
    }
  }
  return names;
}

export function doorNameCounts(root, rule, of) {
  const counts = {}, reasons = new Map();
  for (const m of of.modules) for (const door of moduleDoors(of, m).filter(door => door !== '*' && /\.[cm]?[jt]sx?$/.test(door))) {
    const file = `${m.dir}/${door}`;
    if (!existsSync(resolve(root, file))) continue;
    const names = exportedNames(root, file).size;
    if (names <= rule.max) continue;
    counts[`${rule.id}:names:${file}`] = names;
    reasons.set(`${rule.id}:names:${file}`, `${file}: ${names} names in one door, more than ${rule.max}; split the module, each part with its own door`);
  }
  return { counts, reasons };
}

/** Each door beyond a module's first, and "*", with no decision in arch.decisions.json whose `doors` names it and says when it goes. */
export function otherDoorCounts(rule, of, decisions) {
  const counts = {}, reasons = new Map(), until = door => decisions.some(one => typeof one?.doors?.[door] === 'string' && one.doors[door].trim());
  for (const m of of.modules) {
    const doors = moduleDoors(of, m), others = doors.includes('*') ? ['*'] : doors.slice(1);
    for (const door of others.map(door => `${m.dir}/${door}`).filter(door => !until(door))) {
      counts[`${rule.id}:door:${door}`] = 1;
      reasons.set(`${rule.id}:door:${door}`, `${door}: a door beside ${m.dir}'s first; name it in arch.decisions.json with doors {"${door}": "<when it goes>"}, or go through one door`);
    }
  }
  return { counts, reasons };
}
