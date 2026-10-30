// WHAT: Finds a record's fields copied into another list, object or binding.
// WHY: Keeps consumers tied to the field declaration that judges the record.
import { spawnSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const python = fileURLToPath(new URL('./record-fields.py', import.meta.url));
const nameOf = node => node && (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) ? node.text
  : node && ts.isPropertyAccessExpression(node) ? node.name.text : node && ts.isElementAccessExpression(node) ? nameOf(node.argumentExpression) : null;

/** The module is the authority: the config names it and its exported table, never the fields themselves. */
async function recordOf(root, record) {
  if (Object.keys(record).some(key => !['name', 'module'].includes(key)) || typeof record.name !== 'string' || !record.name || typeof record.module !== 'string')
    throw new Error('record-fields: a record names only its name and schema module#export.path, never a field list');
  const [file, selector, ...extra] = record.module.split('#');
  if (!file || !selector || extra.length || !/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(selector))
    throw new Error(`record-fields: ${record.name}: name the schema as module#export.path`);
  const path = resolve(root, file), rel = relative(root, path);
  if (rel.startsWith('..') || rel === '') throw new Error(`record-fields: ${record.name}: schema must be inside the repository`);
  const schema = await import(pathToFileURL(path).href);
  if (typeof schema.kindOf !== 'function') throw new Error(`record-fields: ${record.name}: ${file} must export its YAML path classifier kindOf`);
  let value = schema;
  for (const step of selector.split('.')) value = value?.[step];
  const fields = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.keys(value) : null;
  if (!fields || fields.length < 3 || fields.some(field => typeof field !== 'string' || !field) || new Set(fields).size !== fields.length)
    throw new Error(`record-fields: ${record.name}: schema ${record.module} must expose at least three distinct field names`);
  return { ...record, file: rel.replaceAll('\\', '/'), fields: new Set(fields), kindOf: schema.kindOf, schemaKind: selector.split('.').at(-1) };
}

function jsNodes(file, text) {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind), found = [];
  if (source.parseDiagnostics.length) throw new Error(`record-fields: cannot parse ${file}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, ' ')}`);
  const bindings = [];
  const collect = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const)) bindings.push(node);
    ts.forEachChild(node, collect);
  };
  collect(source);
  const ancestorOf = (ancestor, node) => { for (let at = node; at; at = at.parent) if (at === ancestor) return true; return false; };
  const scopeOf = node => { let at = node; while (at.parent && !ts.isBlock(at) && !ts.isSourceFile(at)) at = at.parent; return at; };
  function pathOf(expression, at, seen = new Set()) {
    if (!expression) return null;
    if (ts.isParenthesizedExpression(expression)) return pathOf(expression.expression, at, seen);
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) return pathOf(expression.left, at, seen);
    if (ts.isIdentifier(expression)) {
      if (seen.has(expression.text)) return null;
      const candidates = bindings.filter(decl => decl.name.text === expression.text && decl.getStart(source) < at.getStart(source) && ancestorOf(scopeOf(decl), at));
      const decl = candidates.sort((a, b) => b.getStart(source) - a.getStart(source))[0];
      if (!decl) return null;
      return pathOf(decl.initializer, decl, new Set([...seen, expression.text]));
    }
    if (ts.isPropertyAccessExpression(expression)) { const path = ts.isIdentifier(expression.expression) && !bindings.some(decl => decl.name.text === expression.expression.text && ancestorOf(scopeOf(decl), at)) ? [] : pathOf(expression.expression, at, seen); return path && [...path, expression.name.text]; }
    if (ts.isElementAccessExpression(expression)) { const path = ts.isIdentifier(expression.expression) && !bindings.some(decl => decl.name.text === expression.expression.text && ancestorOf(scopeOf(decl), at)) ? [] : pathOf(expression.expression, at, seen); return path && [...path, 0]; }
    return null;
  }
  const tableProofs = new Map();
  const bindingOf = (name, at) => bindings.filter(decl => decl.name.text === name && decl.getStart(source) < at.getStart(source) && ancestorOf(scopeOf(decl), at))
    .sort((a, b) => b.getStart(source) - a.getStart(source))[0];
  const syntaxPath = node => {
    if (ts.isIdentifier(node)) return {root: node.text, path: []};
    if (ts.isPropertyAccessExpression(node)) { const base = syntaxPath(node.expression); return base && {root: base.root, path: [...base.path, node.name.text]}; }
    if (ts.isElementAccessExpression(node)) { const base = syntaxPath(node.expression); return base && {root: base.root, path: [...base.path, 0]}; }
    return null;
  };
  function dependencies(name, at, seen = new Set()) {
    if (seen.has(name)) return new Set();
    const decl = bindingOf(name, at), found = new Set([name]);
    if (!decl) return found;
    const collectNames = node => {
      if (ts.isIdentifier(node) && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) found.add(node.text);
      ts.forEachChild(node, collectNames);
    };
    collectNames(decl.initializer);
    for (const next of [...found]) if (next !== name) for (const child of dependencies(next, decl, new Set([...seen, name]))) found.add(child);
    return found;
  }
  function collectSinks(node) {
    if (ts.isForOfStatement(node) && ts.isIdentifier(node.expression) && ts.isVariableDeclarationList(node.initializer)) {
      const key = node.initializer.declarations[0]?.name;
      if (key && ts.isIdentifier(key)) {
        const checkWrite = part => {
          if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isElementAccessExpression(part.left)
            && ts.isIdentifier(part.left.argumentExpression) && part.left.argumentExpression.text === key.text) {
            const target = syntaxPath(part.left.expression), root = target && bindingOf(target.root, part);
            if (root && ts.isObjectLiteralExpression(root.initializer)) {
              const markers = root.initializer.properties.map(property => nameOf(property.name)).filter(Boolean);
              const proofs = tableProofs.get(node.expression.text) ?? [];
              proofs.push({markers, path: target.path}); tableProofs.set(node.expression.text, proofs);
            }
          }
          ts.forEachChild(part, checkWrite);
        };
        checkWrite(node.statement);
      }
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = syntaxPath(node.left), root = target && bindingOf(target.root, node);
      if (root && ts.isObjectLiteralExpression(root.initializer)) {
        const markers = root.initializer.properties.map(property => nameOf(property.name)).filter(Boolean);
        const walkSink = (value, path) => {
          if (ts.isArrayLiteralExpression(value)) return value.elements.forEach(item => walkSink(item, [...path, 0]));
          if (ts.isObjectLiteralExpression(value)) return value.properties.forEach(property => {
            if (ts.isShorthandPropertyAssignment(property)) walkSink(property.name, [...path, property.name.text]);
            else if (ts.isPropertyAssignment(property) && nameOf(property.name)) walkSink(property.initializer, [...path, nameOf(property.name)]);
          });
          if (!ts.isIdentifier(value)) return;
          for (const dependency of dependencies(value.text, node)) {
            const proofs = tableProofs.get(dependency) ?? [];
            proofs.push({markers, path}); proofs.push({markers, path: [...path, 0]}); tableProofs.set(dependency, proofs);
          }
        };
        walkSink(node.right, target.path);
      }
    }
    ts.forEachChild(node, collectSinks);
  }
  collectSinks(source);
  function visit(node) {
    let keys = [], direct = [], receiver = null, table = null, usedWith = [], collection = false, intent = null;
    if (ts.isArrayLiteralExpression(node)) {
      keys = node.elements.map(nameOf);
      direct = node.elements.flatMap(element => ts.isPropertyAccessExpression(element) && ts.isIdentifier(element.expression) ? [{owner: element.expression.text, field: element.name.text}] : []);
    } else if (ts.isObjectLiteralExpression(node)) {
      keys = node.properties.map(property => nameOf(property.name));
      direct = node.properties.flatMap(property => ts.isPropertyAssignment(property) && ts.isPropertyAccessExpression(property.initializer)
        && ts.isIdentifier(property.initializer.expression) && nameOf(property.name) === property.initializer.name.text
        ? [{owner: property.initializer.expression.text, field: property.initializer.name.text}] : []);
    } else if (ts.isObjectBindingPattern(node)) {
      keys = node.elements.map(part => nameOf(part.propertyName ?? part.name));
    } else if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) keys = node.members.map(part => nameOf(part.name));
    if (keys.length >= 3) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent)) {
        if (ts.isIdentifier(parent.name)) {
          table = parent.name.text;
          if (ts.isArrayLiteralExpression(node)) {
            let scope = parent;
            while (scope.parent && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
            const scan = part => {
              if (ts.isCallExpression(part)) {
                let uses = false; const owners = [];
                const look = child => {
                  if (ts.isIdentifier(child) && child.text === table) uses = true;
                  if (ts.isElementAccessExpression(child) && ts.isIdentifier(child.expression)) owners.push(child.expression.text);
                  ts.forEachChild(child, look);
                };
                look(part); if (uses) usedWith.push(...owners);
              }
              ts.forEachChild(part, scan);
            };
            scan(scope);
          }
        }
        if (ts.isObjectBindingPattern(node) && parent.initializer && ts.isIdentifier(parent.initializer)) receiver = parent.initializer.text;
      }

      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && ts.isIdentifier(parent.expression.expression)
        && ['push', 'unshift'].includes(parent.expression.name.text)) { receiver = parent.expression.expression.text; collection = true; }
      if (ts.isPropertyAssignment(parent) && nameOf(parent.name) === 'value' && ts.isObjectLiteralExpression(parent.parent)) {
        const path = parent.parent.properties.find(part => ts.isPropertyAssignment(part) && nameOf(part.name) === 'path');
        if (path && ts.isStringLiteral(path.initializer)) intent = [0, path.initializer.text, 0];
      }
      const owners = [...new Set([...direct.map(part => part.owner), receiver, ...usedWith].filter(Boolean))];
      const paths = Object.fromEntries(owners.map(owner => [owner, pathOf(ts.factory.createIdentifier(owner), node)]));
      found.push({file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, keys: keys.filter(Boolean), direct, receiver, table, usedWith, paths, collection, intent, sinks: tableProofs.get(table) ?? []});
    }
    ts.forEachChild(node, visit);
  }
  visit(source); return found;
}

/** A missing parser or malformed source stops the rule instead of passing it. */
export async function recordFields(rule, repo) {
  if (!Array.isArray(rule.records) || !rule.records.length) throw new Error('record-fields: name at least one record and its schema');
  const records = await Promise.all(rule.records.map(record => recordOf(repo.root, record)));
  const files = repo.covered(rule), js = files.filter(file => /\.[cm]?[jt]sx?$/.test(file)), py = files.filter(file => file.endsWith('.py'));
  const unsupported = files.filter(file => !js.includes(file) && !py.includes(file));
  if (unsupported.length) throw new Error(`record-fields: unsupported source ${unsupported[0]}`);
  const nodes = js.flatMap(file => jsNodes(file, repo.read(file)));
  if (py.length) {
    const result = spawnSync('python3', [python], { input: JSON.stringify(py.map(file => ({file, text: repo.read(file)}))), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error(`record-fields: Python parser failed: ${result.error?.message ?? result.stderr.trim()}`);
    nodes.push(...JSON.parse(result.stdout));
  }
  return nodes.flatMap(node => records.flatMap(record => {
    if (node.file === record.file) return [];
    const fields = [...new Set(node.keys.filter(key => record.fields.has(key)))];
    const isRecord = owner => { const path = node.paths?.[owner]; return Array.isArray(path) && record.kindOf(path) === record.schemaKind; };
    const direct = new Set((node.direct ?? []).filter(part => isRecord(part.owner) && record.fields.has(part.field)).map(part => part.field));
    const sink = (node.sinks ?? []).some(proof => proof.markers.includes(record.kindOf([])) && record.kindOf(proof.path) === record.schemaKind);
    const collection = node.collection && Array.isArray(node.paths?.[node.receiver]) && record.kindOf([...node.paths[node.receiver], 0]) === record.schemaKind;
    const intent = Array.isArray(node.intent) && record.kindOf(node.intent) === record.schemaKind;
    const belongs = (!node.collection && isRecord(node.receiver)) || collection || intent || direct.size >= 3 || (node.usedWith ?? []).some(isRecord) || sink;
    return fields.length < 3 || !belongs ? [] : [{file: node.file, line: node.line, at: record.name,
      message: `${record.name}: ${fields.join(', ')}; importera schemat från ${record.module}`}];
  }));
}
