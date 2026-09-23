import ts from 'typescript';
import { digest, requireThat } from './util.mjs';
import { entityKey } from './architecture.mjs';

const unwrap = n => { while (n && (ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isParenthesizedExpression(n))) n = n.expression; return n; };
const literal = n => { n = unwrap(n); return n && ts.isStringLiteralLike(n) ? n.text : null; };
const propertyName = n => n && (ts.isIdentifier(n) || ts.isStringLiteralLike(n)) ? n.text : null;

function docOwner(node) {
  let current = node;
  while (current.parent && !ts.isSourceFile(current.parent)) {
    if (ts.isVariableStatement(current) || ts.isFunctionDeclaration(current) || ts.isClassDeclaration(current)) break;
    current = current.parent;
  }
  return current;
}
function leadingDoc(text, node) {
  const owner = docOwner(node);
  const ranges = ts.getLeadingCommentRanges(text, owner.getFullStart()) ?? [];
  const range = ranges.at(-1);
  if (!range) return null;
  const raw = text.slice(range.pos, range.end);
  if (!raw.startsWith('/**') && !raw.startsWith('///')) return null;
  return raw.replace(/^\/\*\*?/, '').replace(/\*\/$/, '')
    .split('\n').map(line => line.replace(/^\s*\*?\s?/, '')).join('\n').trim();
}
export function parseWhatWhy(doc) {
  if (typeof doc !== 'string' || !doc.trim()) return null;
  const what = doc.match(/\bWHAT:\s*([\s\S]*?)(?=\bWHY:|$)/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
  const why = doc.match(/\bWHY:\s*([\s\S]*?)$/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
  if (!what && !why) return null;
  return { what, why, complete: Boolean(what && why) };
}

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
  function visit(node, ancestors = [], ownerSymbol = null, knownConstructor = null, ownerContract = null) {
    requireThat(++count <= 100000, 'source.index-size', 'Source syntax tree exceeds the indexing budget.');
    if ((ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      ownerSymbol = node.name.text;
      ownerContract = parseWhatWhy(leadingDoc(text, node));
      symbols.push({ name: ownerSymbol, kind: ts.isFunctionDeclaration(node) ? 'function' : 'binding', span: span(node), contract: ownerContract, ...position(node) });
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const constructor = imports.get(node.expression.text);
      if (constructor) knownConstructor = constructor;
      if (constructor === 'on' && node.arguments.length >= 3) {
        const id = literal(node.arguments[0]);
        if (id) candidates.push({ id, parentIds: ancestors, file, sourceDigest, span: span(node),
          fields: { region: span(node.arguments[1]), values: span(node.arguments[2]) }, symbol: ownerSymbol,
          constructor, contract: ownerContract, ...position(node), provenance: 'syntax-location' });
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      const idProperty = node.properties.find(p => ts.isPropertyAssignment(p) && propertyName(p.name) === 'id');
      const id = idProperty ? literal(idProperty.initializer) : null;
      if (id) {
        const fields = Object.fromEntries(node.properties.filter(p => ts.isPropertyAssignment(p) && propertyName(p.name))
          .map(p => [propertyName(p.name), span(p.initializer)]));
        candidates.push({ id, parentIds: ancestors, file, sourceDigest, span: span(node), fields,
          symbol: ownerSymbol, constructor: knownConstructor, contract: ownerContract, ...position(node), provenance: 'syntax-location' });
        ancestors = [...ancestors, id];
      }
    }
    ts.forEachChild(node, child => visit(child, ancestors, ownerSymbol, knownConstructor, ownerContract));
  }
  visit(source);
  return { file, digest: sourceDigest, candidates, symbols,
    diagnostics: source.parseDiagnostics.map(d => ({ rule: 'source.syntax', message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      file, line: source.getLineAndCharacterOfPosition(d.start ?? 0).line + 1 })) };
}

/** Exact unique source locations; ambiguity is not solved by choosing the first match. */
export function locateEntities(architecture, sources, explicitOrigins = [], explicitContracts = []) {
  const indexes = sources.map(s => indexSource(s.text, s.path ?? s.file));
  const candidates = indexes.flatMap(i => i.candidates), candidatesById = new Map();
  for (const c of candidates) { const list=candidatesById.get(c.id) ?? []; list.push(c); candidatesById.set(c.id,list); }
  const sourceByPath = new Map(sources.map(s => [s.path ?? s.file, s]));
  const digestsByPath = new Map(indexes.map(index=>[index.file,index.digest]));
  const origins = [], unresolved = [], contracts = [];
  const diagnostics = indexes.flatMap(i => i.diagnostics);
  const explicit = new Map(explicitOrigins.map(o => [o.entityKey, o]));
  const explicitContract = new Map(explicitContracts.map(contract => [contract.entityKey, contract]));
  for (const entity of architecture.entities) {
    let matching = candidatesById.get(entity.id) ?? [];
    if (entity.kind === 'cell') matching = matching.filter(candidate => candidate.parentIds.includes(entity.data.facetId));
    if (entity.kind === 'facet') {
      const constructor = entity.data.kind === 'machine' ? 'defineMachine' : entity.data.kind === 'decision-table' ? 'defineDecisionTable' : null;
      if (constructor && matching.some(candidate => candidate.constructor === constructor)) matching = matching.filter(candidate => candidate.constructor === constructor);
    }
    const suppliedContract = explicitContract.get(entity.key);
    if (suppliedContract) {
      contracts.push({ ...suppliedContract, entityId: entity.id, entityKind: entity.kind, provenance: suppliedContract.provenance ?? 'inspection-contract' });
    } else if (matching.length === 1 && matching[0].contract?.complete) {
      const candidate = matching[0];
      contracts.push({ entityKey: entity.key, entityId: entity.id, entityKind: entity.kind,
        what: candidate.contract.what, why: candidate.contract.why, file: candidate.file, sourceDigest: candidate.sourceDigest,
        span: candidate.span, line: candidate.line, column: candidate.column, provenance: 'source-contract' });
    } else if (entity.kind === 'node-type' && entity.data?.kind === 'service') {
      const partial = matching.length === 1 ? matching[0].contract : null;
      diagnostics.push({ rule: 'contract.service-missing', severity: 'warning', entityKey: entity.key,
        file: matching.length === 1 ? matching[0].file : null, line: matching.length === 1 ? matching[0].line : null,
        message: partial ? "ProductSpec service '" + entity.id + "' has an incomplete WHAT/WHY contract."
          : "ProductSpec service '" + entity.id + "' has no exported WHAT/WHY contract." });
    }
    const supplied = explicit.get(entity.key);
    if (supplied) {
      const source = sourceByPath.get(supplied.file);
      if (!source || digestsByPath.get(supplied.file) !== supplied.sourceDigest || supplied.span && supplied.span.end > source.text.length) {
        unresolved.push({ entityKey: entity.key, reason: 'Original source is unavailable or changed.' }); continue;
      }
      origins.push({ ...supplied, status: 'matched', provenance: 'adapter-source-map' }); continue;
    }
    if (matching.length !== 1) {
      unresolved.push({ entityKey: entity.key, reason: matching.length ? 'Several source locations match; an explicit source map is required.' : 'No unique source location was exported or found.' }); continue;
    }
    const c = matching[0];
    origins.push({ entityKey: entity.key, file: c.file, sourceDigest: c.sourceDigest, span: c.span, fields: c.fields,
      exportName: c.symbol, editing: 'inspect', status: 'matched', provenance: 'unique-literal-location', line: c.line, column: c.column });
  }
  for (const contract of explicitContracts) {
    if (!architecture.entities.some(entity => entity.key === contract.entityKey)) {
      diagnostics.push({ rule: 'contract.entity-missing', severity: 'warning', entityKey: contract.entityKey,
        message: 'An exported WHAT/WHY contract refers to an entity outside this model.' });
    }
  }
  return { origins, unresolved, contracts,
    symbols: indexes.flatMap(index => index.symbols.map(symbol => ({ ...symbol, file: index.file }))),
    diagnostics };
}

export function sourceSelection(origins, file, offset) {
  return origins.filter(o => o.file === file && o.span && o.span.start <= offset && offset <= o.span.end)
    .sort((a, b) => (a.span.end - a.span.start) - (b.span.end - b.span.start))[0] ?? null;
}
