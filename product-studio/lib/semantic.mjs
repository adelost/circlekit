import { Workbench } from './workspaces.mjs';
import { plain, requireThat, errorPayload } from './util.mjs';
import { isDigest } from './inspection.mjs';

const COMMANDS = new Set(['inspect', 'query', 'source', 'simulate', 'scenario', 'trace']);
const INDEX_FIELDS = ['key', 'id', 'kind', 'label', 'group', 'parent', 'owner'];

/** Same loader as the GUI, without HTTP, persistent storage or implicit examples. */
export async function openHeadlessStudio({ roots = [], examples = false } = {}) {
  requireThat(Array.isArray(roots) && roots.length <= 16, 'workspace.limit', 'Attach at most 16 workspace roots.');
  requireThat(roots.length > 0 || examples, 'workspace.required', 'Choose a repository or explicitly use --examples.');
  const workbench = new Workbench({ dataDir: undefined, gitDraftRoots: [] });
  await workbench.initialize(roots, { includeFixtures: examples });
  const projects = workbench.list();
  requireThat(projects.length > 0, 'project.missing', 'No product was found. Add studio.workspace.json or attach a supported existing repository.', 404);
  return { workbench, projects };
}

export function selectProject(projects, selector) {
  const exact = selector === undefined ? [] : projects.filter(p => p.key === selector);
  const matches = exact.length ? exact : selector === undefined ? projects
    : projects.filter(p => p.id === selector || p.productId === selector);
  const choices = projects.map(({ key, id, productId, label }) => ({ key, id, productId, label }));
  requireThat(matches.length === 1, matches.length ? 'project.ambiguous' : 'project.missing',
    matches.length ? 'Several products match. Select an exact workspace key with --product.' : 'No product matches the selector.',
    matches.length ? 409 : 404, { choices });
  return matches[0];
}


function page(items, { max = 100, offset = 0 } = {}) {
  requireThat(Number.isSafeInteger(max) && max >= 1 && max <= 1000
    && Number.isSafeInteger(offset) && offset >= 0, 'output.page', 'Use --max 1..1000 and a nonnegative --offset.');
  const rows = items.slice(offset, offset + max);
  return { rows, page: { total: items.length, offset, returned: rows.length,
    nextOffset: offset + rows.length < items.length ? offset + rows.length : null,
    truncated: offset > 0 || offset + rows.length < items.length } };
}
const indexRow = e => Object.fromEntries(INDEX_FIELDS.map(key => [key, e[key] ?? null]));

/**
 * Read/debug access to the existing Workbench. No source-edit methods, private
 * evaluators, network clients or product-name branches belong in this surface.
 * Results are snapshot-scoped. Construct a new session to inspect newer files.
 */
export class SemanticStudio {
  constructor(workbench, projectKey, { expectModel } = {}) {
    this.workbench = workbench;
    this.view = workbench.view(workbench.require(projectKey));
    requireThat(expectModel === undefined || isDigest(expectModel), 'identity.format', '--expect-model requires a SHA-256 model digest.');
    requireThat(expectModel === undefined || expectModel === this.view.modelDigest,
      'identity.model', 'The loaded model differs from --expect-model. Inspect the new model before continuing.', 409);
    this.context = { project: projectKey, bundleDigest: this.view.bundleDigest };
  }

  metadata(command) {
    const v = this.view, p = this.workbench.require(v.key), producer = p.imported.inspection;
    return {
      schemaVersion: 1, command, product: v.productId, modelDigest: v.modelDigest,
      bundleDigest: v.bundleDigest,
      producer: { productSpec: producer?.compiler.version ?? p.sourceCompatibility?.producer ?? null,
        sourceRevision: producer ? producer.sourceRevision : v.revision,
        origin: producer ? 'inspection-bundle' : 'source-or-legacy-artifact' },
      evaluator: v.toolVersions,
      scope: { workspace: v.key, facet: null },
      sourceIdentity: v.sourceIdentity ?? { kind: 'not-exported' },
      compatibility: v.compatibility,
      diagnostics: v.diagnostics,
      limitations: [v.validationNotice,
        'Loaded snapshot only; no product execution, repository writes or full build performed.',
        ...(v.sourceIdentity ? [v.sourceIdentity.message] : ['No exported source-to-model provenance was supplied.']),
        ...(v.compatibility?.reason ? [v.compatibility.reason] : []),
      ],
    };
  }

  async execute(command, options = {}) {
    let envelope;
    try {
      requireThat(COMMANDS.has(command) && plain(options), 'command.invalid', 'Unsupported semantic command or options.');
      this.workbench.checkedView(this.context);
      envelope = this.metadata(command);
      let result;
      switch (command) {
        case 'inspect': result = this.inspect(options); break;
        case 'query': result = this.query(options); break;
        case 'source': result = this.source(options); break;
        case 'simulate': result = this.simulate(options); break;
        case 'scenario': result = this.scenario(options); break;
        case 'trace': result = this.trace(options); break;
      }
      const facetId = options.facetId ?? options.document?.facetId ?? options.document?.scenario?.facetId ?? null;
      envelope.scope.facet = facetId;
      envelope.evidenceKind = command === 'trace' ? result.provenance === 'synthetic' ? 'simulation' : 'recorded-trace'
        : ['simulate', 'scenario'].includes(command) ? 'simulation' : 'declared';
      let failure = null;
      if (result.supported === false) failure = { code: 'query.unsupported', message: result.message };
      if (result.kind === 'needs-facts' || result.stopped) failure = { code: 'simulation.needs-facts', message: 'Supply the missing guard facts before stepping.' };
      if (command === 'scenario' && result.pass === false) failure = { code: 'scenario.assertion', message: 'One or more independent scenario assertions failed.' };
      return { ...envelope, ok: !failure, result, ...(failure ? { error: failure } : {}) };
    } catch (error) {
      return { ...(envelope ?? { schemaVersion: 1, command }), ok: false, error: errorPayload(error) };
    }
  }

  entity(key) {
    requireThat(typeof key === 'string' && key.length <= 2000, 'entity.required', 'Use an exact entity key returned by inspect.');
    const entity = this.view.architecture.entities.find(e => e.key === key);
    requireThat(entity, 'entity.missing', 'No such entity in this selected model. Entity IDs are not guessed from names.', 404);
    return entity;
  }

  inspect({ entity: key, search = '', fields = INDEX_FIELDS, max, offset } = {}) {
    const { architecture, sourceIndex, facets } = this.view;
    if (key !== undefined) {
      const entity = this.entity(key);
      return { entity, ports: architecture.entities.filter(e => e.owner === key).map(indexRow),
        relations: architecture.edges.filter(e => e.from === key || e.to === key),
        source: sourceIndex.origins.find(o => o.entityKey === key) ?? null,
        sourceLimitation: sourceIndex.unresolved.find(o => o.entityKey === key)?.reason ?? null };
    }
    requireThat(typeof search === 'string' && search.length <= 1000, 'inspect.search', 'Search must be bounded text.');
    requireThat(Array.isArray(fields) && fields.length > 0 && fields.every(f => INDEX_FIELDS.includes(f))
      && new Set(fields).size === fields.length, 'output.fields', 'Select unique inspect fields: ' + INDEX_FIELDS.join(', '));
    const q = search.toLowerCase();
    const matches = architecture.entities.filter(e => `${e.key} ${e.id} ${e.kind} ${e.group ?? ''}`.toLowerCase().includes(q));
    const paged = page(matches, { max, offset });
    return { entities: paged.rows.map(e => Object.fromEntries(fields.map(k => [k, e[k] ?? null]))), page: paged.page,
      facets: facets.map(f => ({ id: f.id, kind: f.kind, runnable: f.runnable !== false, blockedReason: f.blockedReason ?? null })),
      groups: architecture.groups.map(g => ({ id: g.id, label: g.label, evidence: g.evidence, members: g.members.length })),
      coverage: architecture.coverage };
  }

  query({ kind, from, to, purposes = ['data'] }) {
    this.entity(from);
    if (kind === 'path') this.entity(to);
    return this.workbench.query({ ...this.context, query: { kind, from, to, purposes } }).result;
  }

  source({ entity: key }) {
    this.entity(key);
    const origin = this.view.sourceIndex.origins.find(o => o.entityKey === key);
    requireThat(origin, 'source.unavailable', this.view.sourceIndex.unresolved.find(o => o.entityKey === key)?.reason
      ?? 'No unique source location is available.', 404, { entityKey: key });
    return { ...origin, line: origin.line ?? null, column: origin.column ?? null,
      notice: 'Source provenance only. No code was changed; no edit capability was inferred.' };
  }

  simulate({ facetId, input }) {
    requireThat(typeof facetId === 'string' && plain(input), 'simulate.input', 'Select --facet and provide an input record.');
    // Caller data cannot replace project, facet or revision in the checked context.
    const { facet } = this.workbench.getFacet(this.view.key, facetId, this.view.bundleDigest);
    const allowed = facet.kind === 'decision-table' ? ['facts'] : ['state', 'input', 'guards'];
    requireThat(Object.keys(input).every(k => allowed.includes(k)), 'simulate.fields', 'Unexpected simulation input field. Use only ' + allowed.join(', '));
    return this.workbench.evaluate({ ...input, ...this.context, facetId });
  }

  scenario({ document, facetId }) {
    requireThat(plain(document), 'scenario.document', 'Supply a scenario JSON object.');
    let scenario = document;
    if (document.kind === 'product-studio-scenario') {
      requireThat(document.version === 1 && document.modelDigest === this.view.modelDigest
        && plain(document.scenario) && document.facetId === document.scenario.facetId,
        'scenario.identity', 'Scenario document belongs to a different model or declaration.');
      // Portable saved documents can rebind the view digest only after model equality.
      scenario = { ...document.scenario, bundleDigest: this.view.bundleDigest };
    }
    const selected = facetId ?? scenario.facetId;
    requireThat(typeof selected === 'string' && selected === scenario.facetId,
      'scenario.facet', 'The scenario facet does not match the selected declaration.');
    return this.workbench.scenario({ ...this.context, facetId: selected, scenario });
  }

  trace({ text, cursor, entity, operationId, search = '', max, offset }) {
    if (entity !== undefined) this.entity(entity);
    const loaded = this.workbench.importTrace({ ...this.context, text });
    const frame = this.workbench.traceFrame({ ...this.context,
      filter: { cursor, entityKey: entity ?? null, operationId: operationId ?? null, search } });
    const paged = page(frame.events, { max, offset });
    return { ...frame, events: paged.rows, page: paged.page, traceDigest: loaded.trace.traceDigest,
      sessionId: loaded.trace.sessionId, clock: loaded.trace.clock, provenance: loaded.trace.provenance,
      truncation: loaded.trace.truncation, complete: loaded.trace.complete,
      notice: loaded.trace.notice,
      cursorMeaning: 'Zero-based index in the entire capture, not the filtered page. Activity is through the cursor; the event browser searches the full capture.' };
  }
}
