// WHAT: Finds a record's fields copied into another list, object or binding.
// WHY: Keeps consumers tied to the field declaration that judges the record.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
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
  return { ...record, file: rel.replaceAll('\\', '/'), fields: new Set(fields), kindOf: schema.kindOf, isRoot: schema.isRoot, pythonValidator: schema.PY_VALIDATOR, validators: new Set(Object.keys(schema).filter(key => /^validate/.test(key) && typeof schema[key] === 'function')), schemaKind: selector.split('.').at(-1) };
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
  const imports = new Map();
  for (const statement of source.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    const named = statement.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) for (const item of named.elements) imports.set(item.name.text, {name: item.propertyName?.text ?? item.name.text, module: statement.moduleSpecifier.text});
  }
  const functionScope = node => { let at = node; while (at.parent && !ts.isFunctionLike(at) && !ts.isSourceFile(at)) at = at.parent; return at; };
  const calls = [];
  const collectCalls = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && imports.has(node.expression.text))
      for (const arg of node.arguments) if (ts.isIdentifier(arg)) calls.push({root: arg.text, ...imports.get(node.expression.text), scope: functionScope(node), at: node.getStart(source)});
    ts.forEachChild(node, collectCalls);
  };
  collectCalls(source);
  // A validator which reads the schema table and is called for a literal kind can prove which record a local key list judges.
  const functions = [];
  const collectFunctions = node => {
    const namedDeclaration = ts.isFunctionDeclaration(node) && node.name && node.body;
    const namedExpression = ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer));
    if (namedDeclaration || namedExpression) {
      const refs = new Set(), invokes = [];
      const scan = part => {
        if (ts.isIdentifier(part)) refs.add(part.text);
        if (ts.isCallExpression(part) && ts.isIdentifier(part.expression)) invokes.push({helper: part.expression.text, kinds: part.arguments.filter(ts.isStringLiteral).map(arg => arg.text)});
        ts.forEachChild(part, scan);
      };
      scan(node); functions.push({node, name: node.name.text, refs, invokes});
    }
    ts.forEachChild(node, collectFunctions);
  };
  collectFunctions(source);
  const schemaHelpers = functions.flatMap(fn => [...imports].filter(([local]) => fn.refs.has(local)).map(([local, binding]) => ({helper: fn.name, ...binding})));
  const functionUses = (fn, name, seen = new Set()) => {
    if (fn.refs.has(name)) return true;
    if (seen.has(fn.name)) return false;
    return fn.invokes.some(call => functions.some(next => next.name === call.helper && functionUses(next, name, new Set([...seen, fn.name]))));
  };
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
      if (ts.isCallExpression(decl.initializer) && ts.isIdentifier(decl.initializer.expression) && imports.has(decl.initializer.expression.text)) return [];
      return pathOf(decl.initializer, decl, new Set([...seen, expression.text]));
    }
    if (ts.isPropertyAccessExpression(expression)) { const path = ts.isIdentifier(expression.expression) && !bindings.some(decl => decl.name.text === expression.expression.text && ancestorOf(scopeOf(decl), at)) ? [] : pathOf(expression.expression, at, seen); return path && [...path, expression.name.text]; }
    if (ts.isElementAccessExpression(expression)) { const path = ts.isIdentifier(expression.expression) && !bindings.some(decl => decl.name.text === expression.expression.text && ancestorOf(scopeOf(decl), at)) ? [] : pathOf(expression.expression, at, seen); return path && [...path, 0]; }
    return null;
  }
  function rootOf(expression, at, seen = new Set()) {
    if (!expression) return null;
    if (ts.isParenthesizedExpression(expression)) return rootOf(expression.expression, at, seen);
    if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) return rootOf(expression.left, at, seen);
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) return rootOf(expression.expression, at, seen);
    if (!ts.isIdentifier(expression) || seen.has(expression.text)) return null;
    const candidates = bindings.filter(decl => decl.name.text === expression.text && decl.getStart(source) < at.getStart(source) && ancestorOf(scopeOf(decl), at));
    const decl = candidates.sort((a, b) => b.getStart(source) - a.getStart(source))[0];
    return decl ? ts.isCallExpression(decl.initializer) && ts.isIdentifier(decl.initializer.expression) && imports.has(decl.initializer.expression.text) ? expression.text : rootOf(decl.initializer, decl, new Set([...seen, expression.text])) : expression.text;
  }
  const tableProofs = new Map(), mutations = [];
  const collectMutations = part => {
    if (ts.isCallExpression(part) && ts.isPropertyAccessExpression(part.expression) && ts.isIdentifier(part.expression.expression)
      && ['push', 'unshift'].includes(part.expression.name.text)) mutations.push({name: part.expression.expression.text, at: part, scope: functionScope(part), arguments: part.arguments});
    ts.forEachChild(part, collectMutations);
  };
  collectMutations(source);
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
    for (const mutation of mutations) if (mutation.name === name && mutation.scope === functionScope(decl) && mutation.at.getStart(source) < at.getStart(source)) mutation.arguments.forEach(collectNames);
    for (const next of [...found]) if (next !== name) for (const child of dependencies(next, decl, new Set([...seen, name]))) found.add(child);
    return found;
  }
  function addSink(value, path, markers, at) {
    if (ts.isArrayLiteralExpression(value)) return value.elements.forEach(item => addSink(item, [...path, 0], markers, at));
    if (ts.isObjectLiteralExpression(value)) return value.properties.forEach(property => {
      if (ts.isShorthandPropertyAssignment(property)) addSink(property.name, [...path, property.name.text], markers, at);
      else if (ts.isPropertyAssignment(property) && nameOf(property.name)) addSink(property.initializer, [...path, nameOf(property.name)], markers, at);
    });
    if (!ts.isIdentifier(value)) return;
    for (const dependency of dependencies(value.text, at)) {
      const proofs = tableProofs.get(dependency) ?? [];
      proofs.push({markers, path}); proofs.push({markers, path: [...path, 0]}); tableProofs.set(dependency, proofs);
    }
  }
  function collectSinks(node) {
    if (ts.isReturnStatement(node) && node.expression) {
      const scanRoot = part => {
        if (ts.isObjectLiteralExpression(part) && ts.isPropertyAssignment(part.parent)) {
          const parentName = nameOf(part.parent.name);
          const markers = part.properties.filter(property => ts.isPropertyAssignment(property) && nameOf(property.name) === parentName
            && (ts.isNumericLiteral(property.initializer) || ts.isStringLiteral(property.initializer))).map(property => nameOf(property.name));
          if (markers.length) addSink(part, [], markers, node);
        }
        ts.forEachChild(part, scanRoot);
      };
      scanRoot(node.expression);
    }
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
        addSink(node.right, target.path, markers, node);
      }
    }
    ts.forEachChild(node, collectSinks);
  }
  collectSinks(source);
  function visit(node) {
    let keys = [], direct = [], receiver = null, table = null, usedWith = [], collection = false, intent = null, literal = null, parentName = null;
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
      if (ts.isObjectLiteralExpression(node)) {
        literal = Object.fromEntries(node.properties.flatMap(property => ts.isPropertyAssignment(property) && nameOf(property.name)
          && (ts.isNumericLiteral(property.initializer) || ts.isStringLiteral(property.initializer))
          ? [[nameOf(property.name), ts.isNumericLiteral(property.initializer) ? Number(property.initializer.text) : property.initializer.text]] : []));
        parentName = ts.isPropertyAssignment(parent) ? nameOf(parent.name) : null;
      }
      if (ts.isPropertyAssignment(parent) && nameOf(parent.name) === 'value' && ts.isObjectLiteralExpression(parent.parent)) {
        const path = parent.parent.properties.find(part => ts.isPropertyAssignment(part) && nameOf(part.name) === 'path');
        if (path && ts.isStringLiteral(path.initializer)) intent = [0, path.initializer.text, 0];
      }
      const owners = [...new Set([...direct.map(part => part.owner), receiver, ...usedWith].filter(Boolean))];
      const paths = Object.fromEntries(owners.map(owner => [owner, {parts: pathOf(ts.factory.createIdentifier(owner), node), root: rootOf(ts.factory.createIdentifier(owner), node)}]));
      const guards = calls.filter(call => call.scope === functionScope(node) && call.at < node.getStart(source)).map(({root, name, module}) => ({root, name, module}));
      const origins = [...new Set(Object.values(paths).map(value => value.root).filter(Boolean))].flatMap(root => {
        const decl = bindingOf(root, node), call = decl?.initializer;
        return call && ts.isCallExpression(call) && ts.isIdentifier(call.expression) && imports.has(call.expression.text) ? [{root, ...imports.get(call.expression.text)}] : [];
      });
      const schemaUses = functions.filter(fn => ancestorOf(fn.node, node) || table && functionUses(fn, table)).flatMap(fn => fn.invokes.flatMap(call =>
        schemaHelpers.filter(helper => helper.helper === call.helper).flatMap(helper => call.kinds.map(kind => ({...helper, kind})))));
      const containing = functions.filter(fn => ancestorOf(fn.node, node)).map(fn => fn.name), engineUses = [];
      for (const fn of functions) {
        const scan = part => {
          if (ts.isCallExpression(part) && ts.isIdentifier(part.expression) && imports.has(part.expression.text)) {
            let carries = false;
            const visit = child => { if (ts.isCallExpression(child) && ts.isIdentifier(child.expression) && containing.includes(child.expression.text)) carries = true; ts.forEachChild(child, visit); };
            part.arguments.forEach(visit); if (carries) engineUses.push(imports.get(part.expression.text));
          }
          ts.forEachChild(part, scan);
        };
        scan(fn.node);
      }
      found.push({file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, keys: keys.filter(Boolean), direct, receiver, table, usedWith, paths, guards, origins, schemaUses, engineUses, language: 'js', collection, intent, literal, parentName, sinks: [...(tableProofs.get(table) ?? []), ...functions.filter(fn => ancestorOf(fn.node, node)).flatMap(fn => tableProofs.get(fn.name) ?? [])]});
    }
    ts.forEachChild(node, visit);
  }
  visit(source); return found;
}

/** An intent engine is linked only when the actual writer validates that engine's resulting document with this schema. */
function writerEngines(record, repo, files) {
  const result = new Set(), base = record.file.split('/').at(-1);
  for (const file of files) {
    const text = repo.read(file); if (!text.includes(base)) continue;
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.[cm]?ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS), imports = new Map();
    for (const statement of tree.statements) if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const named = statement.importClause?.namedBindings;
      if (named && ts.isNamedImports(named)) for (const item of named.elements) imports.set(item.name.text, {name: item.propertyName?.text ?? item.name.text,
        module: relative(repo.root, resolve(repo.root, dirname(file), statement.moduleSpecifier.text)).replaceAll('\\', '/')});
    }
    const validators = new Set([...imports].filter(([, value]) => value.module === record.file && record.validators.has(value.name)).map(([local]) => local));
    if (!validators.size) continue;
    const scanFunction = fn => {
      const produced = new Map(), checked = [];
      const scan = part => {
        if (ts.isVariableDeclaration(part) && ts.isIdentifier(part.name) && part.initializer && ts.isCallExpression(part.initializer) && ts.isIdentifier(part.initializer.expression) && imports.has(part.initializer.expression.text)) produced.set(part.name.text, imports.get(part.initializer.expression.text));
        if (ts.isBinaryExpression(part) && part.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(part.left) && ts.isCallExpression(part.right) && ts.isIdentifier(part.right.expression) && imports.has(part.right.expression.text)) produced.set(part.left.text, imports.get(part.right.expression.text));
        if (ts.isCallExpression(part) && ts.isIdentifier(part.expression) && validators.has(part.expression.text)) {
          const refs = new Set(); const visit = node => { if (ts.isIdentifier(node)) refs.add(node.text); ts.forEachChild(node, visit); };
          part.arguments.forEach(visit); checked.push(refs);
        }
        ts.forEachChild(part, scan);
      };
      scan(fn);
      for (const [variable, binding] of produced) if (checked.some(refs => refs.has(variable)) && !binding.module.startsWith('..')) result.add(`${binding.module}#${binding.name}`);
    };
    const visit = node => { if (ts.isFunctionDeclaration(node) && node.body || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) scanFunction(node); ts.forEachChild(node, visit); };
    visit(tree);
  }
  return result;
}

/** Follow the actual local reader imports to a YAML parser; comments or a validator call alone do not establish origin. */
function yamlReader(root, path, cache, seen = new Set()) {
  if (cache.has(path)) return cache.get(path);
  if (seen.has(path) || !existsSync(path)) return false;
  const source = readFileSync(path, 'utf8'), tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, /\.[cm]?ts$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  let found = false;
  for (const statement of tree.statements) if ((ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
    const spec = statement.moduleSpecifier.text;
    if (['yaml', 'js-yaml'].includes(spec)) { found = true; break; }
    if (spec.startsWith('.') && yamlReader(root, resolve(dirname(path), spec), cache, new Set([...seen, path]))) { found = true; break; }
  }
  cache.set(path, found); return found;
}

/** The validator may live outside the table module. Follow its own calls to an import of that table. */
function usesSchemaValidator(record, module, name, root, cache) {
  const key = `${record.file}#${module}#${name}`;
  if (cache.has(key)) return cache.get(key);
  if (!/^validate/.test(name)) return false;
  if (module === record.file) return record.validators.has(name);
  const path = resolve(root, module);
  if (relative(root, path).startsWith('..') || !existsSync(path)) return false;
  const tree = ts.createSourceFile(module, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, /\.[cm]?ts$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const own = new Set(), functions = new Map();
  for (const part of tree.statements) {
    if (ts.isImportDeclaration(part) && ts.isStringLiteral(part.moduleSpecifier)) {
      const target = relative(root, resolve(dirname(path), part.moduleSpecifier.text)).replaceAll('\\', '/');
      if (target === record.file && part.importClause?.namedBindings && ts.isNamedImports(part.importClause.namedBindings))
        for (const entry of part.importClause.namedBindings.elements) if ((entry.propertyName?.text ?? entry.name.text) === record.module.split('#')[1].split('.')[0]) own.add(entry.name.text);
    }
    if (ts.isFunctionDeclaration(part) && part.name && part.body) functions.set(part.name.text, part);
    if (ts.isVariableStatement(part)) for (const decl of part.declarationList.declarations)
      if (ts.isIdentifier(decl.name) && decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) functions.set(decl.name.text, decl.initializer);
  }
  const visitFunction = (fn, seen = new Set()) => {
    if (!fn || seen.has(fn)) return false;
    const next = new Set([...seen, fn]); let matched = false;
    const scan = node => {
      if (ts.isIdentifier(node) && own.has(node.text)) matched = true;
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && functions.has(node.expression.text))
        matched ||= visitFunction(functions.get(node.expression.text), next);
      if (!matched) ts.forEachChild(node, scan);
    };
    scan(fn); return matched;
  };
  const linked = visitFunction(functions.get(name)); cache.set(key, linked); return linked;
}

/** A missing parser or malformed source stops the rule instead of passing it. */
export async function recordFields(rule, repo) {
  if (!Array.isArray(rule.records) || !rule.records.length) throw new Error('record-fields: name at least one record and its schema');
  const records = await Promise.all(rule.records.map(record => recordOf(repo.root, record)));
  const files = repo.covered(rule), js = files.filter(file => /\.[cm]?[jt]sx?$/.test(file)), py = files.filter(file => file.endsWith('.py'));
  if (py.length && records.some(record => typeof record.pythonValidator !== 'string' || !record.pythonValidator.includes('#'))) throw new Error('record-fields: a Python scope needs each schema module to name its actual Python validator');
  for (const record of records) record.engines = writerEngines(record, repo, js);
  const unsupported = files.filter(file => !js.includes(file) && !py.includes(file));
  if (unsupported.length) throw new Error(`record-fields: unsupported source ${unsupported[0]}`);
  const nodes = js.flatMap(file => jsNodes(file, repo.read(file)));
  if (py.length) {
    const result = spawnSync('python3', [python], { input: JSON.stringify(py.map(file => ({file, text: repo.read(file)}))), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error(`record-fields: Python parser failed: ${result.error?.message ?? result.stderr.trim()}`);
    nodes.push(...JSON.parse(result.stdout));
  }
  const yamlCache = new Map(), validatorCache = new Map();
  return nodes.flatMap(node => records.flatMap(record => {
    if (node.file === record.file) return [];
    const fields = [...new Set(node.keys.filter(key => record.fields.has(key)))];
    const validRoot = root => (node.guards ?? []).some(guard => {
      if (guard.root !== root) return false;
      const read = (node.origins ?? []).some(origin => origin.root === root && (node.language === 'js'
        ? yamlReader(repo.root, resolve(repo.root, dirname(node.file), origin.module), yamlCache)
        : origin.module === 'yaml'));
      if (!read) return false;
      if (node.language === 'js') return usesSchemaValidator(record, relative(repo.root, resolve(repo.root, dirname(node.file), guard.module)).replaceAll('\\', '/'), guard.name, repo.root, validatorCache);
      const [module, name] = record.pythonValidator.split('#'), imported = `${guard.module.replaceAll('.', '/')}.py`;
      return guard.name === name && (imported === module || relative(repo.root, resolve(repo.root, dirname(node.file), imported)).replaceAll('\\', '/') === module);
    });
    const pathFor = owner => { const item = node.paths?.[owner]; return item && validRoot(item.root) ? item.parts : null; };
    const isRecord = owner => { const path = pathFor(owner); return Array.isArray(path) && record.kindOf(path) === record.schemaKind; };
    const direct = new Set((node.direct ?? []).filter(part => isRecord(part.owner) && record.fields.has(part.field)).map(part => part.field));
    const sink = (node.sinks ?? []).some(proof => proof.markers.includes(record.kindOf([])) && record.kindOf(proof.path) === record.schemaKind);
    const collectionPath = pathFor(node.receiver);
    const collection = node.collection && Array.isArray(collectionPath) && record.kindOf([...collectionPath, 0]) === record.schemaKind;
    // A bare {path, value} shape does not prove that any writer consumes it.
    const intent = Array.isArray(node.intent) && record.kindOf(node.intent) === record.schemaKind && (node.engineUses ?? []).some(use => {
      const module = relative(repo.root, resolve(repo.root, dirname(node.file), use.module)).replaceAll('\\', '/');
      return record.engines.has(`${module}#${use.name}`);
    });
    const validator = (node.schemaUses ?? []).some(use => use.kind === record.schemaKind && use.name === record.module.split('#')[1].split('.')[0]
      && relative(repo.root, resolve(repo.root, dirname(node.file), use.module)).replaceAll('\\', '/') === record.file);
    // A root-shaped object can also be a UI cache; shape alone is not writer provenance.
    const belongs = (!node.collection && isRecord(node.receiver)) || collection || intent || direct.size >= 3 || (node.usedWith ?? []).some(isRecord) || sink || validator;
    return fields.length < 3 || !belongs ? [] : [{file: node.file, line: node.line, at: record.name,
      message: `${record.name}: ${fields.join(', ')}; importera schemat från ${record.module}`}];
  }));
}
