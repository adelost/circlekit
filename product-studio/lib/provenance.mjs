import ts from 'typescript';
import { digest, requireThat } from './util.mjs';
import { entityKey } from './architecture.mjs';

const unwrap = n => { while (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n))) n = n.expression; return n; };
const literal = n => { n = unwrap(n); return n && ts.isStringLiteralLike(n) ? n.text : null; };
const propertyName = n => n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null;

/** Index positions only. This module never interprets a helper or executes an import. */
export function indexSource(text, file) {
  requireThat(typeof text === 'string' && text.length <= 1000000, 'source.index-size', 'Source exceeds the indexing budget.');
  if (!/\.(?:ts|mjs|js)$/.test(file)) return { file, digest: digest(text), candidates: [], symbols: [],
    diagnostics: [{ rule: 'source.language', message: 'Syntax indexing is unavailable for this language. Explicit exported source locations remain usable.', file }] };
  const sourceDigest = digest(text);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, /\.m?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const candidates = [], symbols = [], imports = new Map();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === '@v1d/product-spec') {
      const names = statement.importClause?.namedBindings;
      if (names && ts.isNamedImports(names)) for (const spec of names.elements)
        imports.set(spec.name.text, (spec.propertyName ?? spec.name).text);
    }
  }
  let count = 0;
  const span = node => ({ start: node.getStart(source), end: node.end });
  const position = node => { const at = source.getLineAndCharacterOfPosition(node.getStart(source)); return { line: at.line + 1, column: at.character + 1 }; };
  function visit(node, ancestors = [], ownerSymbol = null, knownConstructor = null) {
    requireThat(++count <= 100000, 'source.index-size', 'Source syntax tree exceeds the indexing budget.');
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      ownerSymbol = node.name.text;
      symbols.push({ name: ownerSymbol, kind: ts.isFunctionDeclaration(node) ? 'function' : 'binding', span: span(node), ...position(node) });
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const constructor = imports.get(node.expression.text);
      if (constructor) knownConstructor = constructor;
      if (constructor === 'on' && node.arguments.length >= 3) {
        const id = literal(node.arguments[0]);
        if (id) candidates.push({ id, parentIds: ancestors, file, sourceDigest, span: span(node),
          fields: { region: span(node.arguments[1]), values: span(node.arguments[2]) }, symbol: ownerSymbol,
          constructor, ...position(node), provenance: 'syntax-location' });
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const idProperty = node.properties.find(p => ts.isPropertyAssignment(p) && propertyName(p.name) === 'id');
      const id = idProperty ? literal(idProperty.initializer) : null;
      if (id) {
        const fields = Object.fromEntries(node.properties.filter(p => ts.isPropertyAssignment(p) && propertyName(p.name))
          .map(p => [propertyName(p.name), span(p.initializer)]));
        candidates.push({ id, parentIds: ancestors, file, sourceDigest, span: span(node), fields,
          symbol: ownerSymbol, constructor: knownConstructor, ...position(node), provenance: 'syntax-location' });
        ancestors = [...ancestors, id];
      }
    }
    ts.forEachChild(node, child => visit(child, ancestors, ownerSymbol, knownConstructor));
  }
  visit(source);
  return { file, digest: sourceDigest, candidates, symbols,
    diagnostics: source.parseDiagnostics.map(d => ({ rule: 'source.syntax', message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      file, line: source.getLineAndCharacterOfPosition(d.start ?? 0).line + 1 })) };
}

/** Exact unique source locations; ambiguity is not solved by choosing the first match. */
export function locateEntities(architecture, sources, explicitOrigins = []) {
  const indexes = sources.map(s => indexSource(s.text, s.path ?? s.file));
  const candidates = indexes.flatMap(i => i.candidates), candidatesById = new Map();
  for (const c of candidates) { const list=candidatesById.get(c.id) ?? []; list.push(c); candidatesById.set(c.id,list); }
  const sourceByPath = new Map(sources.map(s => [s.path ?? s.file, s]));
  const digestsByPath = new Map(indexes.map(index=>[index.file,index.digest]));
  const origins = [], unresolved = [];
  const explicit = new Map(explicitOrigins.map(o => [o.entityKey, o]));
  for (const entity of architecture.entities) {
    const supplied = explicit.get(entity.key);
    if (supplied) {
      const source = sourceByPath.get(supplied.file);
      if (!source || digestsByPath.get(supplied.file) !== supplied.sourceDigest || supplied.span && supplied.span.end > source.text.length) {
        unresolved.push({ entityKey: entity.key, reason: 'Original source is unavailable or changed.' }); continue;
      }
      origins.push({ ...supplied, status: 'matched', provenance: 'adapter-source-map' }); continue;
    }
    let matching = candidatesById.get(entity.id) ?? [];
    if (entity.kind === 'cell') matching = matching.filter(c => c.parentIds.includes(entity.data.facetId));
    if (entity.kind === 'facet') {
      const constructor = entity.data.kind === 'machine' ? 'defineMachine' : entity.data.kind === 'decision-table' ? 'defineDecisionTable' : null;
      if (constructor && matching.some(c => c.constructor === constructor)) matching = matching.filter(c => c.constructor === constructor);
    }
    if (matching.length !== 1) {
      unresolved.push({ entityKey: entity.key, reason: matching.length ? 'Several source locations match; an explicit source map is required.' : 'No unique source location was exported or found.' }); continue;
    }
    const c = matching[0];
    origins.push({ entityKey: entity.key, file: c.file, sourceDigest: c.sourceDigest, span: c.span, fields: c.fields,
      exportName: c.symbol, editing: 'inspect', status: 'matched', provenance: 'unique-literal-location', line: c.line, column: c.column });
  }
  return { origins, unresolved, symbols: indexes.flatMap(index => index.symbols.map(s => ({ ...s, file: index.file }))),
    diagnostics: indexes.flatMap(i => i.diagnostics) };
}

export function sourceSelection(origins, file, offset) {
  return origins.filter(o => o.file === file && o.span && o.span.start <= offset && offset <= o.span.end)
    .sort((a, b) => (a.span.end - a.span.start) - (b.span.end - b.span.start))[0] ?? null;
}
