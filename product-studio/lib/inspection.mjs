import { canonicalJson, digest, plain, requireThat, forbiddenKey } from './util.mjs';

export const INSPECTION_VERSION = 2;
export const isDigest = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const relativeSourcePath = p => typeof p === 'string' && p.length <= 500 && /^[A-Za-z0-9_./-]+$/.test(p)
  && p.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));

/** A serialization contract only. It neither defines ProductSpec semantics nor runs a compiler. */
export function assertSerializable(value, where = 'bundle', depth = 0, budget = { count: 0 }) {
  requireThat(depth <= 48 && ++budget.count <= 150000, 'inspection.budget', 'Inspection data exceeds its structural budget.');
  requireThat(value === null || ['string', 'number', 'boolean', 'object'].includes(typeof value), 'inspection.data', `${where} is not plain serializable data. Pass compiled output, not declarations containing callbacks.`);
  if (typeof value === 'number') requireThat(Number.isFinite(value), 'inspection.number', `${where} is not finite.`);
  if (typeof value === 'object' && value !== null) {
    requireThat(Array.isArray(value) || plain(value), 'inspection.object', `${where} must be an array or plain record.`);
    for (const [key, child] of Object.entries(value)) {
      requireThat(!forbiddenKey(key), 'inspection.key', 'Reserved keys are not accepted.');
      assertSerializable(child, `${where}.${key}`, depth + 1, budget);
    }
  }
}

function modelIdentity(bundle) {
  return digest(canonicalJson({ compiler: bundle.compiler, sourceRevision: bundle.sourceRevision,
    sources: bundle.sources, product: bundle.product, facets: bundle.facets }));
}
function envelopeIdentity(bundle) { const { bundleDigest, ...contents } = bundle; return digest(canonicalJson(contents)); }

export function createInspectionBundle({ productId, compiler, sourceRevision = null, product = null,
  facets = [], sources = [], origins = [], groups = [], relations = [], scenarios = [], evidenceFiles = [],
  artifacts = {}, diagnostics = [] }) {
  const bundle = { kind: 'product-studio-bundle', version: INSPECTION_VERSION, productId, compiler, sourceRevision,
    product, facets, sources, origins, groups, relations, scenarios, evidenceFiles, artifacts, diagnostics };
  assertSerializable(bundle);
  bundle.modelDigest = modelIdentity(bundle);
  bundle.bundleDigest = envelopeIdentity(bundle);
  return validateInspectionBundle(bundle);
}

export function validateInspectionBundle(bundle) {
  assertSerializable(bundle);
  requireThat(bundle.kind === 'product-studio-bundle' && bundle.version === INSPECTION_VERSION,
    'inspection.version', 'Unsupported inspection bundle version.');
  requireThat(typeof bundle.productId === 'string' && bundle.productId.length > 0 && bundle.productId.length <= 200,
    'inspection.product', 'Inspection product identity is required.');
  requireThat(plain(bundle.compiler) && bundle.compiler.name === '@v1d/product-spec' && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(bundle.compiler.version),
    'inspection.compiler', 'Record the actual ProductSpec compiler package and version.');
  requireThat(bundle.sourceRevision === null || typeof bundle.sourceRevision === 'string', 'inspection.revision', 'Source revision must be a string or null.');
  requireThat(bundle.product === null || bundle.product?.id === bundle.productId, 'inspection.product', 'Product and inspection identities differ.');
  for (const field of ['facets','sources','origins','groups','relations','scenarios','evidenceFiles','diagnostics'])
    requireThat(Array.isArray(bundle[field]) && bundle[field].length <= (field === 'origins' ? 20000 : 10000), 'inspection.list', `Expected a bounded '${field}' list.`);
  const facets = new Set();
  for (const facet of bundle.facets) {
    requireThat(plain(facet) && typeof facet.kind === 'string' && typeof facet.id === 'string' && plain(facet.compiled), 'inspection.facet', 'Malformed compiled facet.');
    requireThat(facet.id === facet.compiled.id && !facets.has(facet.id), 'inspection.facet', 'Duplicate facet ID or compiled identity mismatch.');
    facets.add(facet.id);
  }
  const sources = new Map();
  for (const source of bundle.sources) {
    requireThat(relativeSourcePath(source.file) && isDigest(source.digest) && !sources.has(source.file), 'inspection.source', 'Invalid or duplicate source file identity.');
    sources.set(source.file, source);
  }
  const origins = new Set();
  for (const o of bundle.origins) {
    requireThat(typeof o.entityKey === 'string' && sources.has(o.file) && o.sourceDigest === sources.get(o.file).digest,
      'inspection.origin', 'Source provenance must reference an exactly identified source file.');
    requireThat(!origins.has(o.entityKey), 'inspection.origin', 'Ambiguous source origin; export one owner or leave it unresolved.'); origins.add(o.entityKey);
    requireThat(o.span === null || plain(o.span) && Number.isSafeInteger(o.span.start) && Number.isSafeInteger(o.span.end)
      && o.span.start >= 0 && o.span.end > o.span.start, 'inspection.span', 'Invalid source span.');
    requireThat(['editable', 'shared', 'derived', 'external', 'unsupported', 'inspect'].includes(o.editing), 'inspection.editing', 'Unknown source edit capability.');
  }
  requireThat(isDigest(bundle.modelDigest) && bundle.modelDigest === modelIdentity(bundle), 'inspection.digest', 'Compiled model identity does not match the bundle contents.');
  requireThat(isDigest(bundle.bundleDigest) && bundle.bundleDigest === envelopeIdentity(bundle), 'inspection.digest', 'Inspection envelope identity does not match its contents.');
  return bundle;
}

/** Safe to display on a different reader version, but simulation must not silently substitute a kernel. */
export function compatibilityReport(bundle, actualVersion) {
  const exact = bundle.compiler.version === actualVersion;
  return { inspect: true, simulate: exact, producer: bundle.compiler.version, evaluator: actualVersion,
    reason: exact ? null : `This model was compiled with ProductSpec ${bundle.compiler.version}; this Studio uses ${actualVersion}. Inspection remains available. Use the matching kernel before simulation.` };
}

export function checkSourceIdentity(bundle, loadedSources) {
  const loaded = new Map(loadedSources.map(s => [s.path ?? s.file, s]));
  const matches = [], missing = [], changed = [];
  for (const source of bundle.sources) {
    const file = loaded.get(source.file);
    if (!file) missing.push(source.file);
    else if (digest(file.text) !== source.digest) changed.push(source.file);
    else matches.push(source.file);
  }
  return { kind: changed.length ? 'stale' : missing.length ? 'unavailable' : 'matched', matches, missing, changed,
    message: changed.length ? 'Source changed since this model was exported. Regenerate through the product owner; the saved model remains inspectable.'
      : missing.length ? 'Some original sources are unavailable. Compiled inspection remains available; unresolved source edits are disabled.'
      : 'All declared source digests match. This is source correlation, not proof of a currently installed runtime.' };
}
