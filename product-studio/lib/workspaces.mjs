import { readFile, writeFile, mkdir, readdir, realpath, mkdtemp, link, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveScenarioDocument, readScenarioDocument, listScenarioDocuments } from './scenario-store.mjs';
import { saveGitDraft as commitGitDraft } from './git-draft.mjs';
import { architectureOf, architectureSlice, queryArchitecture, entityKey } from './architecture.mjs';
import { locateEntities } from './provenance.mjs';
import { checkSourceIdentity, compatibilityReport } from './inspection.mjs';
import { decodeTrace, inspectTrace } from './trace.mjs';
import { TOOL_VERSIONS } from './kernel.mjs';
import { analyzeSource } from './source.mjs';
import { decodeArtifact, graphOf, attachSnapshot } from './model.mjs';
import { evaluateFacet, enumerateTable, runScenario, runMockScenario } from './simulation.mjs';
import { safeFile, digest, boundedJson, requireThat, StudioError, semanticDiff, unifiedPatch, canonicalJson } from './util.mjs';

const exec = promisify(execFile);
const fixtureRoot = fileURLToPath(new URL('../fixtures/', import.meta.url));
const PRESETS = [
  { id: 'skyvw', label: 'SKYVW', sources: ['appspec/products/skyvw/jumps/recording-machine.ts'], artifact: 'appspec/generated/skyvw/skyvw.product.json', graph: 'appspec/generated/skyvw/skyvw.graph.mmd' },
  { id: 'amux', label: 'AMUX', sources: ['policies/context-cost.mjs'] },
  { id: 'video', label: 'Video editor', sources: ['ui/scripts/lib/studio-activity-product.mjs'] },
  { id: 'showcase', label: 'CircleKit Showcase', sources: ['showcase-product/src/catalog.ts'], artifact: 'showcase-product/generated/showcase-product.json', graph: 'showcase-product/generated/showcase-product.graph.mmd' },
];
const exists = async (root, file) => { try { return await safeFile(root, file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

async function sourceCompilerPin(root, sources) {
  const checked = new Map(), versions = new Set(), files = [];
  for (const source of sources) {
    const parts = source.path.split('/').slice(0,-1);
    for (let depth = parts.length; depth >= 0; depth--) {
      const file = [...parts.slice(0,depth),'package-lock.json'].join('/');
      if (!checked.has(file)) checked.set(file, await exists(root,file));
      const lock = checked.get(file); if (!lock) continue;
      const version = boundedJson(lock.text).packages?.['node_modules/@v1d/product-spec']?.version;
      if (version) { versions.add(version); files.push({file,digest:digest(lock.text)}); break; }
    }
  }
  return { versions:[...versions], files:[...new Map(files.map(f=>[f.file,f])).values()] };
}

export class Workbench {
  constructor({ dataDir, gitDraftRoots = [] }) { this.dataDir = dataDir; this.gitDraftRoots = new Set(gitDraftRoots.map(root => path.resolve(root))); this.projects = new Map(); this.drafts = new Map(); }
  async initialize(roots = []) {
    const fixtures = boundedJson(await readFile(path.join(fixtureRoot, 'catalog.json'), 'utf8'));
    for (const fixture of fixtures) await this.load({ ...fixture, root: fixtureRoot, fixture: true });
    for (const input of roots) {
      const root = await realpath(input);
      const custom = await exists(root, 'studio.workspace.json');
      if (custom) {
        const config = boundedJson(custom.text, 64000);
        requireThat([1,2].includes(config.version) && Array.isArray(config.projects) && config.projects.length <= 20, 'workspace.config', 'Unsupported studio.workspace.json.');
        for (const p of config.projects) await this.load({ ...p, root, fixture: false });
      } else for (const p of PRESETS) {
        if (await exists(root, p.sources[0]) || p.artifact && await exists(root, p.artifact)) await this.load({ ...p, root, fixture: false });
      }
    }
  }
  async load(config) {
    requireThat(typeof config.id === 'string' && typeof config.label === 'string' && Array.isArray(config.sources ?? []) && (config.sources ?? []).length <= 32, 'workspace.config', 'Invalid workspace declaration.');
    const key = `${config.id}-${digest(config.root).slice(0, 10)}`;
    const sources = [], errors = [];
    let imported = { product: null, facets: [], identity: {} }, graphDigest = null;
    const artifactPath = config.bundle ?? config.artifact;
    if (artifactPath) {
      const artifact = await exists(config.root, artifactPath);
      if (artifact) {
        try { imported = decodeArtifact(artifact.text, artifactPath); }
        catch (e) { errors.push({ rule: e.code ?? 'artifact.read', message: e.message }); }
      } else errors.push({ rule: 'artifact.missing', message: 'Generated inspection is unavailable. Export through the product owner, then reload.' });
    }
    const sourcePaths = [...new Set([...(config.sources ?? []), ...(imported.inspection?.sources ?? []).map(s => s.file)])];
    requireThat(sourcePaths.length <= 256, 'workspace.sources', 'At most 256 explicitly selected source files can be attached.');
    for (const relative of sourcePaths) {
      const file = await exists(config.root, relative);
      if (!file) { errors.push({ rule: 'source.missing', message: `Configured source unavailable: ${relative}` }); continue; }
      try {
        // A compiled bundle is the primary meaning. Source is indexed, never reinterpreted to replace it.
        const parsed = imported.inspection
          ? { facets: [], diagnostics: [], dataExports: {}, digest: digest(file.text), valid: false, mode: 'source-index' }
          : analyzeSource(file.text, relative);
        sources.push({ path: relative, text: file.text, parsed });
      } catch (e) {
        sources.push({ path: relative, text: file.text, parsed: { facets: [], diagnostics: [{ rule: e.code ?? 'source.read', message: e.message }], dataExports: {}, digest: digest(file.text), valid: false } });
      }
    }
    if (config.graph) { const graph = await exists(config.root, config.graph); if (graph) graphDigest = digest(graph.text); }
    graphDigest ??= imported.inspection?.artifacts.graphSha256 ?? null;
    let revision = config.revision ?? null;
    if (!config.fixture) try { revision = (await exec('git', ['-C', config.root, 'rev-parse', 'HEAD'], { timeout: 3000 })).stdout.trim(); } catch { /* A Git checkout is not required to inspect files. */ }
    const readSet = sources.map(s => ({ file: s.path, digest: s.parsed.digest }));
    for (const file of [...new Set([config.bundle, config.artifact, config.graph, 'studio.workspace.json', 'package-lock.json', 'ui/package-lock.json', 'appspec/package-lock.json', 'showcase-product/package-lock.json'].filter(Boolean))]) {
      const value = await exists(config.root, file); if (value) readSet.push({ file, digest: digest(value.text) });
    }
    const pins = !config.fixture ? await sourceCompilerPin(config.root,sources) : {versions:[],files:[]};
    const sourceCompatibility = pins.versions.length === 1 ? compatibilityReport({compiler:{version:pins.versions[0]}},TOOL_VERSIONS.productSpec) : pins.versions.length > 1 ? {inspect:true,simulate:false,reason:'Attached source files use different ProductSpec versions. Export separate inspection bundles for their package boundaries.'} : null;
    const compilerCompatibility = imported.compatibility ?? sourceCompatibility;
    for (const item of pins.files) if(!readSet.some(r=>r.file===item.file))readSet.push(item);
    const p = { key, config, sources, imported, graphDigest, errors, revision, readSet, compilerCompatibility, sourceCompatibility, evidence: null, trace: null };
    this.projects.set(key, p); return this.view(p);
  }
  require(key) { const p = this.projects.get(key); requireThat(p, 'project.missing', 'Project is not loaded.', 404); return p; }
  list() { return [...this.projects.values()].map(p => ({ key: p.key, label: p.config.label, fixture: !!p.config.fixture, originKind: p.config.originKind ?? (p.config.fixture ? 'fixture' : 'workspace'), revision: p.revision })); }
  facets(p) {
    const combined = new Map(p.imported.facets.map(f => [f.id, f]));
    if (p.imported.inspection) return [...combined.values()];
    for (const s of p.sources) for (const f of s.parsed.facets) {
      requireThat(!combined.has(f.id) || !combined.get(f.id).source, 'project.duplicate', `Two sources declare '${f.id}'.`);
      combined.set(f.id, { ...f, file: s.path, runnable: s.parsed.valid && p.compilerCompatibility?.simulate !== false, blockedReason: p.compilerCompatibility?.reason ?? (s.parsed.valid ? null : 'This source has unresolved diagnostics; inspect it but correct the source before simulation.') });
    }
    return [...combined.values()];
  }
  view(p) {
    const facets = this.facets(p);
    const sourceSet = p.sources.map(s => ({ path: s.path, digest: s.parsed.digest }));
    const bundleDigest = digest({ versions: TOOL_VERSIONS, key: p.key, sourceSet, productDigest: p.imported.identity.productDigest, readSet: p.readSet, revision: p.revision });
    const modelDigest = p.imported.identity.modelDigest ?? digest({ product: p.imported.product, facets: facets.map(f => ({ kind:f.kind, compiled:f.compiled })), versions: TOOL_VERSIONS, sourceSet });
    const inspection = p.imported.inspection;
    const architecture = architectureOf(p.imported.product, facets, inspection ?? {});
    const sourceIndex = locateEntities(architecture, p.sources, inspection?.origins ?? []);
    for (const f of facets) {
      const origin = sourceIndex.origins.find(o => o.entityKey === entityKey('facet', f.id, f.kind));
      if (origin) { f.file = origin.file; f.source = { file:origin.file, ...origin.span, span:origin.span, line:origin.line, digest:origin.sourceDigest }; }
    }
    const sourceIdentity = inspection ? checkSourceIdentity(inspection, p.sources) : null;
    const gallery = p.imported.product?.showcase?.cases ?? p.sources.flatMap(s => Object.values(s.parsed.dataExports).flat()).filter(v => v.title && v.scenarios);
    return { key: p.key, label: p.config.label, fixture: !!p.config.fixture, originKind: p.config.originKind ?? (p.config.fixture ? 'fixture' : 'workspace'), revision: p.revision,
      toolVersions: TOOL_VERSIONS, modelDigest, productId: inspection?.productId ?? p.imported.product?.id ?? p.config.id, architecture, canvas: architectureSlice(architecture), sourceIndex, sourceIdentity, compatibility: p.compilerCompatibility ?? p.imported.compatibility ?? null, trace: p.trace ?? null, scenarios: inspection?.scenarios ?? [], provenance: p.config.provenance ?? null, bundleDigest, product: p.imported.product, graph: graphOf(p.imported.product), facets, gallery,
      sources: p.sources.map(s => ({ path: s.path, digest: s.parsed.digest, text: s.text, diagnostics: s.parsed.diagnostics, valid: s.parsed.valid })),
      diagnostics: [...p.errors, ...(inspection?.diagnostics ?? []), ...p.sources.flatMap(s => s.parsed.diagnostics), ...sourceIndex.diagnostics], evidence: p.evidence,
      capabilities: { gitDrafts: !p.config.fixture && !!p.config.root && this.gitDraftRoots.has(p.config.root), inspect: true, simulate: facets.some(f => f.runnable !== false), sourceDrafts: p.sources.length > 0, architectureQueries: architecture.coverage.owners > 0, recordedTrace: true, nativePreview: false, documentWrites: false, liveExecution: false },
      validationNotice: p.imported.product ? 'Imported structure checked. Source freshness, full product compilation and native conformance have not been established by this viewer.' : 'Standalone declarations. This is not a complete application graph.' };
  }
  getFacet(key, id, expectedDigest) {
    const p = this.require(key), view = this.view(p);
    requireThat(view.bundleDigest === expectedDigest, 'revision.changed', 'Source changed. Reload before running or editing.', 409);
    const facet = view.facets.find(f => f.id === id);
    requireThat(facet, 'facet.missing', 'Declaration not found.', 404);
    return { p, facet, view };
  }
  checkedView(request) {
    const p = this.require(request.project), view = this.view(p);
    requireThat(view.bundleDigest === request.bundleDigest, 'revision.changed', 'Source changed. Reload the selected view.', 409);
    return { p, view };
  }
  query(request) {
    const { view } = this.checkedView(request);
    const result = request.query ? queryArchitecture(view.architecture, request.query) : null;
    return { result, canvas: architectureSlice(view.architecture, { ...(request.filter ?? {}), result }) };
  }
  importTrace(request) {
    const { p, view } = this.checkedView(request);
    p.trace = decodeTrace(request.text, view); return this.view(p);
  }
  traceFrame(request) {
    const { p, view } = this.checkedView(request);
    requireThat(p.trace, 'trace.missing', 'Import a compatible trace first.');
    const frame = inspectTrace(p.trace, request.filter);
    const logic = frame.current?.logic;
    if (logic) {
      const f = view.facets.find(f => f.id === logic.facetId);
      if (!f || f.runnable === false) frame.logicCheck = { kind: 'unavailable', message: 'A matching runnable logic facet is not available.' };
      else {
        try {
          const result = evaluateFacet(f, { state: logic.from, input: logic.input, guards: logic.guards, facts: logic.facts });
          const same = result.kind === 'decision' ? result.cell === logic.cellId && canonicalJson(result.values) === canonicalJson(logic.values)
            : result.kind === 'transition' && result.cellId === logic.cellId && result.to === logic.to;
          frame.logicCheck = { kind: result.kind === 'needs-facts' ? 'unknown' : same ? 'consistent' : 'different', result, message: 'Comparison to this model, not authentication of the recorded event.' };
        } catch (error) { frame.logicCheck = { kind: 'unavailable', message: error.message }; }
      }
    }
    return frame;
  }
  evaluate(request) { const { facet } = this.getFacet(request.project, request.facetId, request.bundleDigest); return evaluateFacet(facet, request); }
  table(request) { const { facet } = this.getFacet(request.project, request.facetId, request.bundleDigest); return enumerateTable(facet); }
  scenario(request) { const { facet, view } = this.getFacet(request.project, request.facetId, request.bundleDigest); return runScenario(facet, request.scenario, view.bundleDigest); }
  mocks(request) { return runMockScenario(request.scenario); }
  async saveScenario(request) {
    const { view } = this.checkedView(request);
    requireThat(view.facets.some(f => f.id === request.facetId) && request.scenario?.facetId === request.facetId && request.scenario?.bundleDigest === view.bundleDigest, 'scenario.facet', 'Select a known logic facet.');
    return saveScenarioDocument(this.dataDir, { kind:'product-studio-scenario', version:1, title:request.title, modelDigest:view.modelDigest, facetId:request.facetId, scenario:request.scenario });
  }
  async scenarios() { return listScenarioDocuments(this.dataDir); }
  async openScenario(request) {
    const { view } = this.checkedView(request), document = await readScenarioDocument(this.dataDir,request.id);
    requireThat(document.modelDigest === view.modelDigest && document.facetId === request.facetId, 'scenario.identity', 'Saved scenario belongs to a different model or declaration.');
    return { ...document, scenario:{...document.scenario, bundleDigest:view.bundleDigest} };
  }
  async refresh(key) { const p = this.require(key); requireThat(p.config.root, 'project.reload', 'An imported artifact is a fixed snapshot; import a new revision instead.'); return this.load(p.config); }
  async importArtifact({ text, label = 'Imported artifact' }) {
    requireThat(this.projects.size < 64, 'project.limit', 'Close a session before importing more than 64 projects.');
    const imported = decodeArtifact(text), key = 'import-' + digest(text).slice(0, 16);
    const p = { key, config: { id: key, label: String(label).slice(0, 100), fixture: false, originKind: 'imported-artifact' }, sources: [], imported, graphDigest: null, errors: [], readSet: [], revision: null, evidence: null, trace: null };
    this.projects.set(key, p); return this.view(p);
  }
  async importSource({ text, label = 'Source draft', file = 'declaration.ts' }) {
    requireThat(this.projects.size < 64 && /^[A-Za-z0-9_./-]+\.(ts|mjs|js)$/.test(file) && !file.split('/').includes('..'), 'source.path', 'Choose a safe TS, JS or MJS filename.');
    const parsed = analyzeSource(text, file), key = 'source-' + digest({ text, file }).slice(0, 16);
    const p = { key, config: { id: key, label: String(label).slice(0, 100), fixture: true, originKind: 'source-draft' }, sources: [{ path: file, text, parsed }], imported: { product: null, facets: [], identity: {} }, graphDigest: null, errors: [], readSet: [], revision: null, evidence: null, trace: null };
    this.projects.set(key, p); return this.view(p);
  }
  async propose(request) {
    const p = this.require(request.project), view = this.view(p);
    requireThat(view.bundleDigest === request.bundleDigest, 'revision.changed', 'Source changed. Reload before editing.', 409);
    const facet = view.facets.find(f => f.id === request.facetId);
    const source = p.sources.find(s => s.path === (request.file ?? facet?.file));
    if (request.sourceDigest) requireThat(request.sourceDigest === source?.parsed.digest, 'edit.conflict', 'The draft was based on another source revision. Reconcile it before applying.', 409);
    requireThat(source && (typeof request.text === 'string' || facet?.editable || p.imported.inspection), 'edit.unsupported', 'An attached source file is required. Artifacts cannot be inverse-compiled.');
    if (p.config.root && !p.config.fixture) {
      const current = await safeFile(p.config.root, source.path);
      requireThat(digest(current.text) === source.parsed.digest, 'edit.conflict', 'Source changed on disk. Reload and review a refreshed diff.', 409);
    }
    const parsedBefore = source.parsed.mode === 'source-index' ? analyzeSource(source.text, source.path) : source.parsed;
    const afterText = typeof request.text === 'string' ? request.text
      : request.command === 'table.splitRegion' ? parsedBefore.planSplitRegion(facet.id,request.cellId,request.axis,request.values,request.newCellId).text
      : request.insert ? parsedBefore.planInsert(facet.id, request.collection, request.value).text
      : parsedBefore.planCellEdit(facet.id, request.cellId ?? null, request.field, request.value).text;
    const parsed = analyzeSource(afterText, source.path);
    requireThat(!facet || parsed.facets.some(f => f.id === facet.id) || !parsed.valid, 'edit.identity', 'Renaming the selected declaration is not supported by this draft operation.');
    const draftId = digest({ project: p.key, file: source.path, base: view.bundleDigest, text: afterText });
    const d = { id: draftId, project: p.key, facetId: facet?.id ?? parsed.facets[0]?.id ?? source.path, bundleDigest: view.bundleDigest, file: source.path,
      readSet: p.readSet ?? [], expectedHead: p.revision, baseDigest: source.parsed.digest, before: source.text, text: afterText, parsed,
      diagnostics: [...parsed.diagnostics, ...(p.compilerCompatibility?.simulate === false || p.imported.compatibility?.simulate === false || p.sourceCompatibility?.simulate === false ? [{rule:'compiler.version',message:p.sourceCompatibility?.reason ?? p.compilerCompatibility?.reason ?? p.imported.compatibility?.reason}] : [])], valid: parsed.valid && p.compilerCompatibility?.simulate !== false && p.imported.compatibility?.simulate !== false && p.sourceCompatibility?.simulate !== false,
      diff: semanticDiff(parsedBefore.facets.map(f => f.compiled), parsed.facets.map(f => f.compiled)),
      patch: unifiedPatch(source.path, source.text, afterText) };
    requireThat(this.drafts.size < 200 || this.drafts.has(draftId), 'draft.limit', 'Draft limit reached. Save or restart this local session.');
    this.drafts.set(draftId, d); return this.draftView(d);
  }
  draftView(d) { const { parsed, ...visible } = d; return { ...visible, facets: parsed.facets, validationScope: 'Supported source declarations only. Full product build and native behavior were not checked.' }; }
  async saveDraft(id) {
    const d = this.drafts.get(id); requireThat(d, 'draft.missing', 'Draft not found.', 404);
    // Invalid drafts may be retained, but are never labelled validated.
    const root = path.join(this.dataDir, 'drafts'); await mkdir(root, { recursive: true, mode: 0o700 });
    const envelope = { version: 1, ...this.draftView(d), savedAt: new Date().toISOString(), persistence: 'studio-local-only' };
    const file = path.join(root, `${d.id}.json`);
    const staging = await mkdtemp(path.join(root, '.stage-'));
    try {
      const temporary = path.join(staging, 'draft.json');
      await writeFile(temporary, JSON.stringify(envelope, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      try { await link(temporary, file); }
      catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const prior = boundedJson(await readFile(file, 'utf8'));
        requireThat(prior.id === d.id && prior.text === d.text && prior.baseDigest === d.baseDigest, 'draft.conflict', 'A saved draft with this identity has different content. It was not overwritten.');
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    return { id: d.id, persistence: 'studio-local-only', message: 'Draft saved in Product Studio. Repository source was not changed.', patch: d.patch };
  }
  async saveGitDraft(id) {
    const d = this.drafts.get(id); requireThat(d, 'draft.missing', 'Draft not found.', 404);
    const p = this.require(d.project);
    requireThat(p.config.root && !p.config.fixture && this.gitDraftRoots.has(p.config.root), 'git.disabled', 'Git draft saves are not enabled for this exact workspace.', 403);
    return commitGitDraft({ root: p.config.root, dataDir: this.dataDir, draft: d, expectedHead: d.expectedHead, readSet: d.readSet });
  }
  async savedDrafts() {
    const root = path.join(this.dataDir, 'drafts');
    let names; try { names = await readdir(root); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    return Promise.all(names.filter(n => /^[a-f0-9]{64}\.json$/.test(n)).slice(0, 200).map(async n => {
      const d = boundedJson(await readFile(path.join(root, n), 'utf8'));
      return { id: d.id, project: d.project, file: d.file, valid: d.valid, savedAt: d.savedAt };
    }));
  }
  async savedDraft(id) {
    requireThat(/^[a-f0-9]{64}$/.test(id), 'draft.id', 'Invalid draft identity.');
    return boundedJson(await readFile(path.join(this.dataDir, 'drafts', `${id}.json`), 'utf8'));
  }
  snapshot(request) {
    const p = this.require(request.project);
    // For imported products, an exact full-graph file can be attached by the user.
    let graphDigest = p.graphDigest;
    if (request.graphText) { requireThat(typeof request.graphText === 'string' && request.graphText.length <= 8_000_000, 'graph.size', 'Graph file too large.'); graphDigest = digest(request.graphText); }
    const evidence = attachSnapshot(p.imported.product, p.imported.identity.productDigest, graphDigest, request.text);
    p.graphDigest = graphDigest; p.evidence = evidence;
    return this.view(p);
  }
}
