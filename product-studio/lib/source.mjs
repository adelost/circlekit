import ts from 'typescript';
import { compileDeclaration, kernel } from './kernel.mjs';
import { StudioError, requireThat, digest, forbiddenKey, plain } from './util.mjs';

const DSL_CALLS = new Set(['defineMachine', 'defineDecisionTable', 'on', 'choice', 'record', 'perChoice', 'family', 'finiteValues', 'finiteProduct', 'mapFiniteCases', 'field', 'valueRef', 'finiteValueRef', 'statePresentationField', 'defineStatePresentation']);
const DSL_VALUES = new Set(['bool', 'integer']);
const MAX_SOURCE = 500_000;
const namespaceMarker = Symbol('ProductSpec namespace');
const unwrap = node => {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
};

/**
 * Read a deliberately bounded construction subset of TS/MJS. Repository modules
 * are NEVER imported, transpiled-and-executed, evaluated, or given IO globals.
 * All table/machine laws and decisions stay in the installed ProductSpec kernel.
 */
export function analyzeSource(text, file = 'declaration.ts') {
  requireThat(typeof text === 'string' && Buffer.byteLength(text) <= MAX_SOURCE, 'source.size', 'Source exceeds the 500 KB interactive limit.');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.m?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const bindings = new Map(), cache = new Map(), pending = new Set(), approved = new WeakSet();
  const origins = new Map(), facets = new Map(), diagnostics = [], dataExports = {};
  let steps = 0, depth = 0;
  const location = node => {
    const span = { start: node.getStart(source), end: node.end };
    const at = source.getLineAndCharacterOfPosition(span.start);
    return { file, line: at.line + 1, column: at.character + 1, span };
  };
  const refuse = (node, message, code = 'source.unsupported') => { throw new StudioError(code, message, 400, location(node)); };
  const approve = fn => { approved.add(fn); return fn; };
  const nameOf = node => {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    return refuse(node, 'Computed property names require source editing.');
  };
  const safeKey = (node, key) => { if (forbiddenKey(key)) refuse(node, `Reserved member '${key}' is not accepted.`, 'source.member'); return key; };
  function bind(name, value, node) {
    if (bindings.has(name)) refuse(node, `Duplicate local binding '${name}'.`, 'source.duplicate');
    bindings.set(name, value);
  }
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const module = statement.moduleSpecifier.text;
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) continue;
      const named = clause.namedBindings;
      if (named && ts.isNamedImports(named)) for (const specifier of named.elements) {
        if (specifier.isTypeOnly) continue;
        bind(specifier.name.text, { tag: module === '@v1d/product-spec' ? 'dsl' : 'external', name: (specifier.propertyName ?? specifier.name).text, node: specifier }, specifier);
      }
      if (named && ts.isNamespaceImport(named)) bind(named.name.text, { tag: module === '@v1d/product-spec' ? 'namespace' : 'external', node: named }, named);
      if (clause.name) bind(clause.name.text, { tag: 'external', node: clause }, clause);
    }
    if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.initializer) bind(d.name.text, {
        tag: (statement.declarationList.flags & ts.NodeFlags.Const) ? 'const' : 'mutable', node: d.initializer,
      }, d);
    }
    if (ts.isFunctionDeclaration(statement) && statement.name) bind(statement.name.text, { tag: 'function', node: statement }, statement);
  }

  function readIdentifier(node, scope) {
    const name = node.text;
    if (scope.has(name)) return scope.get(name);
    if (name === 'undefined') return undefined;
    const b = bindings.get(name);
    if (!b) return refuse(node, `Cannot statically resolve '${name}'. No repository code was executed.`);
    if (b.tag === 'external') return refuse(node, `Imported '${name}' needs its product-owned inspection adapter. Imports are not executed.`);
    if (b.tag === 'mutable') return refuse(node, `Mutable '${name}' is not a supported declaration dependency.`);
    if (b.tag === 'namespace') return namespaceMarker;
    if (b.tag === 'dsl') return dslValue(b.name, node, scope);
    if (b.tag === 'function') return localFunction(b.node, scope);
    if (cache.has(name)) return cache.get(name);
    if (pending.has(name)) return refuse(node, `Cyclic declaration dependency at '${name}'.`, 'source.cycle');
    pending.add(name);
    try { const value = evaluate(b.node, new Map()); cache.set(name, value); return value; }
    finally { pending.delete(name); }
  }
  function dslValue(name, node, scope) {
    if (DSL_VALUES.has(name)) return kernel[name];
    if (!DSL_CALLS.has(name) || typeof kernel[name] !== 'function') return refuse(node, `DSL export '${name}' is not supported by this source lens.`);
    return approve((...args) => {
      if (name === 'defineMachine' || name === 'defineDecisionTable') {
        const kind = name === 'defineMachine' ? 'machine' : 'decision-table';
        const compiled = compileDeclaration(kind, args[0]);
        const call = ts.isCallExpression(node.parent) ? node.parent : node;
        const original = origins.get(compiled.id);
        if (original) refuse(node, `Duplicate declaration ID '${compiled.id}'.`, 'source.duplicate-id');
        origins.set(compiled.id, { declaration: call.arguments?.[0], scope: new Map(scope), raw: args[0], location: location(call) });
        facets.set(compiled.id, { id: compiled.id, kind, compiled, source: { ...location(call), digest: digest(text) }, validation: 'shared-kernel', editable: true });
        return compiled;
      }
      const result = kernel[name](...args);
      if (typeof result === 'function') approve(result);
      return result;
    });
  }
  function localFunction(node, outer) {
    return approve((...args) => {
      const scope = new Map(outer);
      node.parameters.forEach((p, i) => {
        if (!ts.isIdentifier(p.name) || p.dotDotDotToken) refuse(p, 'Only named, non-rest parameters are supported in construction helpers.');
        const value = args[i] === undefined && p.initializer ? evaluate(p.initializer, scope) : args[i];
        scope.set(p.name.text, value);
      });
      if (!node.body) return refuse(node, 'Function body is unavailable.');
      if (!ts.isBlock(node.body)) return evaluate(node.body, scope);
      for (const s of node.body.statements) {
        if (ts.isReturnStatement(s)) return s.expression ? evaluate(s.expression, scope) : undefined;
        if (ts.isVariableStatement(s) && (s.declarationList.flags & ts.NodeFlags.Const)) {
          for (const d of s.declarationList.declarations) {
            if (!ts.isIdentifier(d.name) || !d.initializer) refuse(d, 'This helper binding is unsupported.');
            scope.set(d.name.text, evaluate(d.initializer, scope));
          }
        } else refuse(s, 'Construction helpers may contain constants and a return, not effects, loops or mutation.');
      }
      return undefined;
    });
  }
  function member(node, scope) {
    const object = evaluate(node.expression, scope);
    const key = safeKey(node, ts.isPropertyAccessExpression(node) ? node.name.text : evaluate(node.argumentExpression, scope));
    if (object === namespaceMarker) return dslValue(key, node, scope);
    if (Array.isArray(object)) {
      if (key === 'length') return object.length;
      if (/^\d+$/.test(String(key))) return object[Number(key)];
      if (['includes', 'join'].includes(key)) return approve((...args) => {
        if (key === 'join') requireThat(object.length <= 4096 && object.reduce((n,v)=>n+String(v).length,0) + String(args[0] ?? ',').length * object.length <= 1000000, 'source.budget', 'Joined text exceeds its budget.');
        return object[key](...args);
      });
      if (['map', 'filter', 'some', 'every'].includes(key)) return approve(fn => {
        requireThat(approved.has(fn) && object.length <= 2048, 'source.callback', 'Unsupported callback or oversized collection.');
        return object[key]((v, i) => fn(v, i));
      });
    }
    if (plain(object) && Object.hasOwn(object, key)) return object[key];
    return refuse(node, `Member '${key}' is unavailable in this source lens.`);
  }
  function expression(node, scope) {
    node = unwrap(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) return readIdentifier(node, scope);
    if (ts.isArrayLiteralExpression(node)) {
      const value = [];
      for (const item of node.elements) {
        if (ts.isSpreadElement(item)) {
          const list = evaluate(item.expression, scope);
          requireThat(Array.isArray(list), 'source.spread', 'Only array data can be spread into an array.'); value.push(...list);
        } else value.push(evaluate(item, scope));
        requireThat(value.length <= 4096, 'source.budget', 'Collection exceeds the interactive source budget.');
      }
      return value;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const value = {};
      for (const item of node.properties) {
        if (ts.isSpreadAssignment(item)) {
          const other = evaluate(item.expression, scope);
          requireThat(plain(other), 'source.spread', 'Only plain data can be spread into an object.');
          for (const [key, val] of Object.entries(other)) {
            safeKey(item, key);
            requireThat(!Object.hasOwn(value, key), 'source.overwrite', `Spread overwrites '${key}'; inspect the owning source instead.`); value[key] = val;
          }
        } else if (ts.isPropertyAssignment(item) || ts.isShorthandPropertyAssignment(item)) {
          const key = safeKey(item, nameOf(item.name));
          requireThat(!Object.hasOwn(value, key), 'source.duplicate-key', `Duplicate property '${key}'.`);
          value[key] = evaluate(ts.isPropertyAssignment(item) ? item.initializer : item.name, scope);
        } else refuse(item, 'Methods, accessors and computed behavior are not declaration data.');
      }
      return value;
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return localFunction(node, scope);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return member(node, scope);
    if (ts.isConditionalExpression(node)) return evaluate(evaluate(node.condition, scope) ? node.whenTrue : node.whenFalse, scope);
    if (ts.isPrefixUnaryExpression(node)) {
      const v = evaluate(node.operand, scope);
      if (node.operator === ts.SyntaxKind.ExclamationToken) return !v;
      if (node.operator === ts.SyntaxKind.MinusToken && typeof v === 'number') return -v;
      if (node.operator === ts.SyntaxKind.PlusToken && typeof v === 'number') return v;
      return refuse(node, 'This unary operation is unsupported.');
    }
    if (ts.isBinaryExpression(node)) {
      const a = evaluate(node.left, scope), op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return a && evaluate(node.right, scope);
      if (op === ts.SyntaxKind.BarBarToken) return a || evaluate(node.right, scope);
      if (op === ts.SyntaxKind.QuestionQuestionToken) return a ?? evaluate(node.right, scope);
      const b = evaluate(node.right, scope);
      switch (op) {
        case ts.SyntaxKind.EqualsEqualsEqualsToken: return a === b;
        case ts.SyntaxKind.ExclamationEqualsEqualsToken: return a !== b;
        case ts.SyntaxKind.GreaterThanToken: return a > b;
        case ts.SyntaxKind.GreaterThanEqualsToken: return a >= b;
        case ts.SyntaxKind.LessThanToken: return a < b;
        case ts.SyntaxKind.LessThanEqualsToken: return a <= b;
        case ts.SyntaxKind.PlusToken: if (typeof a === 'string' || typeof b === 'string') requireThat(String(a).length + String(b).length <= 1000000, 'source.budget', 'Constructed text exceeds its budget.'); return a + b;
        case ts.SyntaxKind.MinusToken: return a - b;
        case ts.SyntaxKind.AsteriskToken: return a * b;
        case ts.SyntaxKind.SlashToken: return a / b;
        default: return refuse(node, 'Assignment and this operator are not supported in declaration construction.');
      }
    }
    if (ts.isCallExpression(node)) {
      // Only these pure global helpers are available, and only when not shadowed.
      if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)) {
        const owner = node.expression.expression.text, method = node.expression.name.text;
        if (!bindings.has(owner) && !scope.has(owner)) {
          if (owner === 'Object' && ['freeze', 'entries', 'keys', 'values', 'fromEntries'].includes(method)) {
            const [v] = node.arguments.map(a => evaluate(a, scope));
            if (method === 'freeze') return v;
            return Object[method](v);
          }
          if (owner === 'Number' && ['isFinite', 'isInteger', 'isSafeInteger'].includes(method)) return Number[method](evaluate(node.arguments[0], scope));
        }
      }
      const fn = evaluate(node.expression, scope);
      requireThat(typeof fn === 'function' && approved.has(fn), 'source.call', 'Only supported pure construction calls are allowed.');
      return fn(...node.arguments.map(a => evaluate(a, scope)));
    }
    return refuse(node, `Unsupported ${ts.SyntaxKind[node.kind]}. Open source; no code was executed.`);
  }
  function evaluate(node, scope = new Map()) {
    requireThat(++steps <= 600_000 && ++depth <= 64, 'source.budget', 'Source evaluation exceeded its bounded construction budget.');
    try { const value = expression(node, scope);
      requireThat(typeof value !== 'string' || value.length <= 1_000_000, 'source.budget', 'Constructed text exceeds the interactive budget.');
      requireThat(!Array.isArray(value) || value.length <= 4096, 'source.budget', 'Constructed array exceeds the interactive budget.');
      return value;
    } finally { depth--; }
  }
  function report(error, node) {
    diagnostics.push({ severity: 'error', rule: error.code ?? 'dsl.refused', message: error.message,
      ...(error.details ?? location(node)) });
  }
  for (const d of source.parseDiagnostics) {
    const at = source.getLineAndCharacterOfPosition(d.start ?? 0);
    diagnostics.push({ severity: 'error', rule: 'source.syntax', message: ts.flattenDiagnosticMessageText(d.messageText, '\n'), file, line: at.line + 1, column: at.character + 1 });
  }
  if (!diagnostics.length) for (const s of source.statements) {
    if (!ts.isVariableStatement(s) || !s.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) {
      try { const value = readIdentifier(d.name, new Map()); if (Array.isArray(value) && value.every(v => plain(v) && typeof v.id === 'string')) dataExports[d.name.text] = value; } catch (e) { report(e, d.initializer); }
    }
  }
  // Imports and function bodies are not executed. Top-level effects must not
  // masquerade as fully checked declaration construction.
  for (const statement of source.statements) {
    const allowed = ts.isImportDeclaration(statement) || ts.isVariableStatement(statement)
      || ts.isFunctionDeclaration(statement) || ts.isInterfaceDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement) || ts.isEmptyStatement(statement)
      || ts.isExportDeclaration(statement)
      || (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression));
    if (!allowed) diagnostics.push({ severity: 'error', rule: 'source.top-level',
      message: 'Top-level executable statements are not applied by the static source reader. Use a product-owned inspection export.', ...location(statement) });
  }
  // Non-exported compiled declarations are useful too; never execute functions just to discover them.
  if (!diagnostics.length) for (const [name, b] of bindings) {
    if (b.tag !== 'const' || cache.has(name)) continue;
    const n = unwrap(b.node);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['defineMachine', 'defineDecisionTable'].includes(bindings.get(n.expression.text)?.name)) {
      try { readIdentifier(ts.factory.createIdentifier(name), new Map()); } catch (e) { report(e, b.node); }
    }
  }

  function resolveAst(node, scope, seen = new Set()) {
    node = unwrap(node);
    if (ts.isIdentifier(node)) {
      if (scope.has(node.text)) return refuse(node, 'This field comes from a helper parameter. Edit its source explicitly.');
      const b = bindings.get(node.text);
      if (b?.tag === 'const' && !seen.has(node.text)) { seen.add(node.text); return resolveAst(b.node, scope, seen); }
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'Object.freeze' && !bindings.has('Object')) return resolveAst(node.arguments[0], scope, seen);
    return node;
  }
  function property(node, key, scope) {
    node = resolveAst(node, scope);
    if (!ts.isObjectLiteralExpression(node)) return refuse(node, 'This field is derived or external. Edit the source expression.');
    const p = node.properties.find(p => p.name && nameOf(p.name) === key);
    if (!p) return refuse(node, `Property '${key}' is not directly authored. Use the source editor to add it.`);
    return resolveAst(ts.isPropertyAssignment(p) ? p.initializer : p.name, scope);
  }
  function planCellEdit(facetId, cellId, field, value) {
    const o = origins.get(facetId);
    requireThat(o, 'source.origin', 'Declaration source was not uniquely resolved.');
    const root = resolveAst(o.declaration, o.scope);
    let target;
    if (cellId === null) {
      requireThat(['initial', 'states', 'inputs', 'guards', 'rests', 'deadlines', 'ordering', 'otherwise', 'axes', 'cells'].includes(field), 'edit.field', 'Unsupported root field.');
      target = property(root, field, o.scope);
    } else {
      const array = property(root, 'cells', o.scope);
      if (!ts.isArrayLiteralExpression(array)) refuse(array, 'Cells are derived. Open their source instead of flattening them.');
      const matches = array.elements.filter(n => evaluate(n, o.scope)?.id === cellId);
      requireThat(matches.length === 1, 'edit.cell', 'Cell source is not unique.');
      const n = resolveAst(matches[0], o.scope);
      if (ts.isCallExpression(n) && ['on'].includes(bindings.get(n.expression.text)?.name)) {
        requireThat(['region', 'values'].includes(field), 'edit.field', 'A table cell supports region and values edits.');
        target = n.arguments[field === 'region' ? 1 : 2];
      } else {
        requireThat(['from', 'on', 'to', 'requires', 'forbids', 'region', 'values'].includes(field), 'edit.field', 'Unsupported cell field.');
        target = property(n, field, o.scope);
      }
    }
    const replacement = JSON.stringify(value, null, 2);
    requireThat(typeof replacement === 'string' && replacement.length < 80_000, 'edit.value', 'Invalid or oversized edit value.');
    return { text: text.slice(0, target.getStart(source)) + replacement + text.slice(target.end),
      span: location(target).span, shared: target.getStart(source) < o.location.span.start };
  }
  function planInsert(facetId, collection, value) {
    const o = origins.get(facetId);
    requireThat(o, 'source.origin', 'Declaration source was not uniquely resolved.');
    requireThat(['cells', 'states', 'inputs', 'guards', 'rests', 'deadlines'].includes(collection), 'edit.field', 'Unsupported declaration collection.');
    const array = property(o.declaration, collection, o.scope);
    if (!ts.isArrayLiteralExpression(array)) refuse(array, 'Collection is derived. Open source instead of flattening it.');
    const serialized = JSON.stringify(value, null, 2);
    requireThat(typeof serialized === 'string' && serialized.length < 80000, 'edit.value', 'Invalid or oversized insertion.');
    const startLine = text.slice(0, array.getStart(source)).split('\n').at(-1);
    const indent = startLine.match(/^[ \t]*/)[0];
    const item = serialized.replace(/\n/g, '\n' + indent + '  ');
    const edits = [{ start: array.end - 1, end: array.end - 1, replacement: '\n' + indent + '  ' + item + ',\n' + indent }];
    if (array.elements.length && !array.elements.hasTrailingComma) {
      const end = array.elements.at(-1).end;
      edits.push({ start: end, end, replacement: ',' });
    }
    let next = text;
    for (const edit of edits.sort((a,b) => b.start - a.start)) next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
    return { text: next, shared: array.getStart(source) < o.location.span.start };
  }
  function planSplitRegion(facetId, cellId, axis, selectedValues, newCellId) {
    const o = origins.get(facetId), f = facets.get(facetId);
    requireThat(o && f?.kind === 'decision-table', 'edit.table', 'Select a source-backed decision table.');
    requireThat(Array.isArray(selectedValues) && selectedValues.length > 0 && new Set(selectedValues).size === selectedValues.length,
      'edit.split', 'Choose a nonempty, unique subset of this region.');
    const cell = f.compiled.cells.find(c => c.id === cellId), domain = f.compiled.axes[axis];
    requireThat(cell && domain && typeof newCellId === 'string' && !f.compiled.cells.some(c => c.id === newCellId),
      'edit.split', 'Choose an existing cell/axis and a new unique cell ID.');
    const covered = cell.region[axis] === undefined ? domain : Array.isArray(cell.region[axis]) ? cell.region[axis] : [cell.region[axis]];
    requireThat(selectedValues.every(v => covered.includes(v)), 'edit.split', 'The new region must stay inside the original region.');
    const remaining = covered.filter(v => !selectedValues.includes(v));
    requireThat(remaining.length > 0, 'edit.split', 'A split must leave a nonempty original region.');
    const array = property(o.declaration, 'cells', o.scope);
    if (!ts.isArrayLiteralExpression(array)) refuse(array, 'Cells are derived. Edit their owner instead.');
    const entries = array.elements.filter(n => evaluate(n, o.scope)?.id === cellId);
    requireThat(entries.length === 1, 'edit.split', 'The source cell is ambiguous.');
    const original = resolveAst(entries[0], o.scope);
    requireThat(ts.isCallExpression(original) && ts.isIdentifier(original.expression)
      && bindings.get(original.expression.text)?.name === 'on', 'edit.split', 'This split lens requires a direct imported on(...) cell.');
    const originalRegion = original.arguments[1], outputExpression = original.arguments[2].getText(source);
    const oldRegion = JSON.stringify({ ...cell.region, [axis]: remaining }, null, 2);
    const newRegion = JSON.stringify({ ...cell.region, [axis]: selectedValues }, null, 2);
    const addition = `${original.expression.getText(source)}(${JSON.stringify(newCellId)}, ${newRegion}, ${outputExpression})`;
    const edits = [
      { start: originalRegion.getStart(source), end: originalRegion.end, value: oldRegion },
      { start: array.end - 1, end: array.end - 1, value: `\n    ${addition},\n  ` },
    ];
    if (array.elements.length && !array.elements.hasTrailingComma) edits.push({ start:array.elements.at(-1).end, end:array.elements.at(-1).end, value:',' });
    let next = text;
    for (const edit of edits.sort((a,b) => b.start-a.start)) next=next.slice(0,edit.start)+edit.value+next.slice(edit.end);
    const candidate = analyzeSource(next,file), after = candidate.facets.find(f => f.id === facetId);
    requireThat(candidate.valid && after, 'edit.split', candidate.diagnostics.map(d=>d.message).join('\n') || 'Split did not produce a valid source declaration.');
    for (const point of kernel.decisionPoints(f.compiled.axes)) {
      const before = kernel.decide(f.compiled,point), decision = kernel.decide(after.compiled,point);
      requireThat(JSON.stringify(before.values) === JSON.stringify(decision.values), 'edit.split-semantics', 'The split changed a decision output.');
    }
    return { text:next, outputParity:'all-points-equal', changedCellIds:[cellId,newCellId] };
  }
  return { file, digest: digest(text), facets: [...facets.values()], diagnostics, dataExports,
    valid: diagnostics.length === 0 && facets.size > 0, planCellEdit, planInsert, planSplitRegion };
}
