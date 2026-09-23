import { patchHTML } from './dom.js';
import { createExperience, hasDrafts } from './experience.js';
import { drawGraph, machineGraph } from './graph.js';
import { architectureControls, sourceNavigator, entityInspector, decisionReasons, traceView, traceFacet, traceGraphMarks, traceArchitectureMarks, traceEventRows, decisionRegionTable, initialProjectView, projectSummary, installDocumentState } from './studio-tools.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pretty = value => JSON.stringify(value, null, 2);
const views = ['System', 'Logic', 'Scenarios', 'Interface', 'Changes', 'Trace'];
const mobileViews = [['Welcome','Overview'],...views.map(view=>[view,view]),['Intent','Intent & behavior'],['Problems','Problems'],['Compare','Compare']];
let token, projects = [], project, state, generation = 0, graph, busy = false, toastTimer;
let experience, graphHost, graphSignature = '', bindingController, sourcePending = new Map();
function listen(element,type,handler) { element?.addEventListener(type,handler,{signal:bindingController.signal}); }
const sessions = new Map();
const freshState = () => ({ view: 'Logic', facetId: null, selected: null, search: '', facts: {}, guards: {}, input: null,
  machineState: null, result: null, timeline: [], cursor: -1, mode: 'Declared', text: null, draft: null,
  dirty: false, perFacet: new Map(), undo: [], redo: [], tableRows: null, scenarioText: null, scenarioResult: null, mockText: null, mockResult: null, archivedRuns: [] });

async function api(route, body) {
  if (body && ['import','import-source','trace','snapshot'].includes(route)) body = {...body,summary:true};
  const response = await fetch('/api/' + route, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-studio-token': token, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) { const e = new Error(result.error?.message ?? 'Operation failed.'); e.code = result.error?.code; throw e; }
  return result;
}
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').style.display = 'block'; toastTimer = setTimeout(() => { $('#toast').style.display = 'none'; }, 7000); }
function facet() { return project?.facets.find(f => f.id === state.facetId); }
function source() { const f = facet(); return project?.sources.find(s => s.path === state?.sourcePath) ?? project?.sources.find(s => s.path === f?.file) ?? project?.sources[0]; }
const action = (name, label, cls = '', disabled = false) => `<button data-action="${name}" class="${cls}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const options = (values, selected) => values.map(v => `<option value="${escape(v)}" ${v === selected ? 'selected' : ''}>${escape(v)}</option>`).join('');
const banner = (text, kind = 'info') => `<div class="notice ${kind}">${escape(text)}</div>`;
const empty = (title, text, extra = '') => `<div class="empty"><span class="symbol">◇</span><h2>${escape(title)}</h2><p>${escape(text)}</p>${extra}</div>`;
const panel = (title, body, toolbar = '') => `<section class="panel" data-key="${escape(title)}"><header class="panel-head"><h2>${title}</h2><div class="toolbar">${toolbar}</div></header>${body}</section>`;
function requestContext() { return { project: project.key, facetId: state.facetId, bundleDigest: project.bundleDigest, sourceDigest: state?.document?.().baseDigest ?? source()?.digest }; }
function download(name, text, mime = 'application/json') { const url = URL.createObjectURL(new Blob([text], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }

async function loadProject(key) {
  const ticket = ++generation;
  const p = await api('project?id=' + encodeURIComponent(key) + '&mode=summary');
  if (ticket !== generation) return;
  const isFirstVisit = !sessions.has(key);
  project = p; state = sessions.get(key) ?? freshState(); sessions.set(key, state); installDocumentState(state,p);
  if (!p.facets.some(f => f.id === state.facetId)) selectFacet(p.facets.find(f=>['machine','decision-table'].includes(f.kind))?.id ?? p.facets[0]?.id ?? null, false);
  if (isFirstVisit) state.view = initialProjectView(p);
  render();
  if (state.view === 'Trace' && p.trace && !state.traceFrame) await loadTraceFrame(p.trace.eventCount-1);
}
function selectFacet(id, paint = true) {
  ++generation;
  const keys = ['selected','facts','guards','input','machineState','result','timeline','cursor','mode','tableRows','scenarioText','scenarioDirty','scenarioResult','archivedRuns'];
  if (state.facetId) state.perFacet.set(state.facetId, Object.fromEntries(keys.map(k => [k, state[k]])));
  const remembered = state.perFacet.get(id);
  state.facetId = id; state.selected = null; state.result = null; state.tableRows = null; state.mode = 'Declared';
  state.timeline = []; state.cursor = -1;
  state.scenarioText = null; state.scenarioDirty = false; state.scenarioResult = null; state.sourceLoadError = null;
  const f = facet(); state.sourcePath = f?.file ?? project.sources[0]?.path ?? null; state.sourceSpan = null;
  if (f?.kind === 'machine' && f.runnable !== false) { state.machineState = f.compiled.initial; state.input = f.compiled.inputs[0]; state.guards = Object.fromEntries(f.compiled.guards.map(g => [g, 'unknown'])); }
  if (f?.kind === 'decision-table' && f.runnable !== false) state.facts = Object.fromEntries(Object.entries(f.compiled.axes).map(([k, v]) => [k, v[0]]));
  if (remembered) Object.assign(state, remembered);
  if (paint) render();
}
function selectedCell() {
  const f = facet(); if (!f || !Array.isArray(f.compiled?.cells)) return null;
  return f.compiled.cells.find(c => c.id === state.selected?.id) ?? f.compiled.cells.find(c => c.id === (state.result?.cellId ?? state.result?.cell));
}

function render() {
  if (!project) return;
  const f = facet(), query = state.search.toLowerCase(), title = { System: 'Explore the system', Logic: f?.kind === 'machine' ? 'Lifecycle logic' : 'Policy decisions', Scenarios: 'Explore possible outcomes', Interface: 'Components & surfaces', Changes: 'Code & review', Trace: 'Trace', Problems: 'Problems & evidence', Compare: 'Review model changes', Welcome: 'Overview', Intent: 'Intent, structure and behavior' }[state.view];
  const list = project.facets.filter(item => item.id.toLowerCase().includes(query));
  const sourceLabel = ({ fixture: 'Public source fixture', example: 'Synthetic example', workspace: 'Local workspace', 'source-draft': 'Source draft', 'imported-artifact': 'Imported artifact' })[project.originKind] ?? 'Local data';
  const topic=state.view==='Trace' ? state.traceFrame?.current?.logic?.facetId ?? project.architecture.entities.find(e=>e.key===state.traceFrame?.current?.entityKey)?.id ?? 'Trace'
    : ['Logic','Scenarios'].includes(state.view) ? state.facetId??state.view
    : state.view==='System'&&state.selected?.kind==='entity' ? project.architecture.entities.find(e=>e.key===state.selected.id)?.id??'System' : state.view;
  const subtitleText=subtitle();
  const html = `<div class="shell" data-view="${state.view}" data-mode="${state.text !== null ? 'candidate' : state.mode === 'Simulation' ? 'simulation' : (state.mode.startsWith('Recorded') || state.mode==='Test run') ? 'recorded' : 'declared'}">
    <header class="topbar"><div class="brand"><div class="brand-mark">P</div><span>PRODUCT STUDIO</span></div>
      <select class="project-select" id="project" aria-label="Select product">${projects.map(p => `<option value="${escape(p.key)}" ${p.key === project.key ? 'selected' : ''}>${escape(p.label)}</option>`).join('')}</select>
      <nav aria-label="Workbench views">${views.map(v => `<button data-view="${v}" class="${v === state.view ? 'active' : ''}" ${v === state.view ? 'aria-current="page"' : ''}>${v}</button>`).join('')}<select id="mobile-view" aria-label="Workbench view">${mobileViews.map(([id,label])=>`<option value="${escape(id)}" ${id===state.view?'selected':''}>${escape(label)}</option>`).join('')}</select></nav>
      <div class="spacer"></div><div class="top-actions"><button id="convergence-badge" class="badge convergence ${project.convergence?.verdict === 'Converged' ? 'good' : project.convergence?.verdict === 'Diverged' ? 'error' : ''}" aria-label="Convergence details">${escape(project.convergence?.label ?? 'Unknown')}</button><span class="badge top-mode ${state.mode === 'Simulation' ? 'simulation' : ''}">${escape(state.mode)}</span>${action('reload', '↻', 'subtle', !project.key || project.key.startsWith('import-') || project.key.startsWith('source-'))}</div>
    </header>
    <div class="main-grid"><aside class="explorer" aria-label="Program explorer">
      <div class="section-label">Workspace</div><input id="search" aria-label="Search nodes, ports or rules" placeholder="Search nodes, ports or rules" value="${escape(state.search)}">
      <div class="section-label">Logic · ${project.facets.length}</div><div class="explorer-list">${list.map(item => `<button class="explorer-item ${['Logic','Scenarios'].includes(state.view)&&item.id === state.facetId ? 'active' : ''}" data-facet="${escape(item.id)}"><span class="kind-dot ${item.kind}"></span><span>${escape(item.id)}</span></button>`).join('') || '<small>No matching declarations</small>'}</div>
      ${project.graph.nodes.length ? `<div class="section-label">Structure · ${project.graph.nodes.length}</div><div class="explorer-list">${project.graph.nodes.filter(n => n.id.toLowerCase().includes(query)).slice(0, 35).map(n => `<button class="explorer-item" data-node="${escape(n.id)}"><span class="kind-dot"></span><span>${escape(n.id)}</span></button>`).join('') || '<small>No matching owners</small>'}</div>` : ''}
      <div class="explorer-actions"><details class="view-menu"><summary>Add…</summary><div class="compact-list">${action('import', 'Import source / JSON', 'subtle')}${action('new', 'New declaration', 'subtle')}${action('saved', 'Open saved drafts', 'subtle')}${action('connect-help', 'Attach repositories', 'subtle')}</div></details></div>
    </aside>
    <main class="content">${experience?.toolbar() ?? ''}${experience?.notices() ?? ''}<div class="page-heading"><div><div class="eyebrow">${escape(project.label)} / ${escape(topic)}</div><h1>${title}</h1>${subtitleText?`<p class="subtitle">${escape(subtitleText)}</p>`:''}</div><div class="toolbar">${action('explorer', 'Explorer', 'mobile-toggle')}${action('inspector', 'Inspector', 'mobile-toggle')}<span class="badge">${sourceLabel}</span></div></div>
      ${project.diagnostics.length ? `<details class="notice"><summary>${project.diagnostics.length} source or artifact diagnostics</summary>${diagnostics(project.diagnostics)}</details>` : ''}
      ${project.sourceIdentity && project.sourceIdentity.kind !== 'matched' ? banner(project.sourceIdentity.message) : ''}
      ${project.compatibility?.reason ? banner(project.compatibility.reason) : ''}
      ${['Problems','Compare','Welcome','Intent'].includes(state.view) ? experience.page(state.view) : state.view === 'Trace' ? traceView(project,state,escape) : state.view === 'System' ? systemView() : state.view === 'Logic' ? logicView() : state.view === 'Scenarios' ? scenariosView() : state.view === 'Interface' ? interfaceView() : changesView()}
    </main><aside class="inspector" aria-label="Selected object inspector">${inspector()}</aside></div>
    <footer class="footer"><span class="safe">● No external execution</span><span>${escape(state.mode)}</span><span class="optional">${escape(project.revision?.slice(0, 7) ?? project.bundleDigest.slice(0, 8))}</span><span class="spacer"></span><span id="edit-status">${state.text !== null ? 'Draft changes · source unchanged' : 'Source read-only'}</span><span class="optional">Runtime disconnected</span></footer>
  </div>`;
  patchHTML($('#app'), html);
  bind(); renderGraph(); experience?.afterRender();
  if ((state.view === 'Changes' || state.showCode) && source() && source().text === undefined && !state.sourceLoadError) ensureSource().catch(e => { state.sourceLoadError=e.message; render(); toast(e.message); });
  if (f?.kind === 'decision-table' && f.runnable !== false && state.view === 'Logic' && state.tableRows === null) loadTable();
}
function subtitle() {
  if (state.view === 'Intent') return 'Responsibility, boundaries and reported tests.';
  if (state.view === 'Logic') return 'Try declared rules with test inputs.';
  if (state.view === 'System') return 'Declared owners and connections.';
  if (state.view === 'Scenarios') return 'Explore event sequences with virtual time.';
  if (state.view === 'Trace') return '';
  if (state.view === 'Interface') return 'Components and surfaces.';
  return '';
}
function diagnostics(items) { return `<ul class="error-list">${items.map(d => `<li><code>${escape(d.rule)}</code> ${d.line ? `<small>line ${d.line}:${d.column}</small>` : ''}<p>${escape(d.message)}</p></li>`).join('')}</ul>`; }

function systemView() {
  if (!project.product) return panel('Standalone declarations', empty('No full product graph loaded', 'This product exposes the facets listed below. Studio does not invent connections or algorithms.', `<div class="card-grid">${project.facets.map(f => `<button class="catalog-card" data-facet="${escape(f.id)}"><span class="badge">${f.kind}</span><h3>${escape(f.id)}</h3><p>${f.compiled.cells?.length ?? 0} declared cells</p></button>`).join('')}</div>`));
  const p = project.product;
  return panel(`Declared topology <span class="badge">${project.graph.nodes.length} owners</span>`, `<div id="graph" data-managed="graph" class="graph-host"></div><div class="risk-caption">${state.canvas?.shownOwners ?? project.canvas?.shownOwners ?? project.graph.nodes.length} of ${project.architecture.coverage.owners} owners in scope; at most 160 rendered. Port types and contracts are visible in the inspector; graph layout never changes the program.</div>`, `${action('fit', 'Fit')}${action('zoom-in', '+')}${action('zoom-out', '−')}<button data-exp="arrange">Arrange</button><button data-exp="focus">Focus ±2</button>${action('snapshot', 'Import snapshot')}`)
    + architectureControls(project,state,escape)
    + panel('Artifacts & surfaces', `<div class="panel-body"><div class="card-grid">${p.artifacts.map(a => `<button class="catalog-card" data-artifact="${escape(a.id)}"><span class="badge">Artifact</span><h3>${escape(a.id)}</h3><p>${escape((a.serves ?? []).join(' / '))}</p><code>${escape(a.entryScreen)}</code></button>`).join('')}</div></div>`)
    + (project.evidence ? evidenceView() : '');
}
function evidenceView() {
  if(!project.evidence.snapshot)return banner('Loading captured port summary…');
  const e = project.evidence.snapshot;
  return panel('Recorded port snapshot', `<div class="panel-body">${banner(project.evidence.notice)}<small>Captured ${escape(new Date(e.takenAtMs).toISOString())}</small><div class="table-wrap"><table><thead><tr><th>Port</th><th>Count</th><th>Last age at capture</th><th>Quality</th><th>Summary</th></tr></thead><tbody>${e.ports.map(p => `<tr><td>${escape(p.port)}</td><td>${p.count}</td><td>${Math.round((e.takenAtMs - p.lastAtMs) / 1000)} s</td><td>${escape(p.lastQuality)}</td><td>${escape(p.lastSummary)}</td></tr>`).join('')}</tbody></table></div></div>`);
}
function logicView() {
  const f = facet();
  const blocked = reason => reason === project.compatibility?.reason ? '' : banner(reason);
  if (!f) return empty('Select a logic declaration', 'Import a supported TypeScript/MJS declaration or generated table/machine.');
  if (!['machine','decision-table'].includes(f.kind)) return blocked(f.blockedReason ?? 'No specialized runner is available.') + panel('Exported facet', `<pre class="panel-body">${escape(pretty(f.compiled))}</pre>`);
  if (f.kind === 'machine') {
    const m = f.compiled;
    if (f.runnable === false) return blocked(f.blockedReason ?? 'This facet is inspect-only.') + panel('Compiled model', `<pre class="panel-body">${escape(pretty(m))}</pre>`);
    return panel(`State machine <code>${escape(f.id)}</code>`, `<div id="graph" data-managed="graph" class="graph-host"></div><div class="risk-caption">${m.states.length} states · ${m.cells.length} declared transitions · ${escape(m.ordering)} · no-match: ${escape(m.otherwise)}</div>`, `${action('fit', 'Fit')}${action('zoom-in', '+')}${action('zoom-out', '−')}${action('add-cell', '+ Transition', '', !f.editable)}${action('edit-root', 'Definition', '', !f.editable)}${action('edit-source', 'Open source', '', !source())}`)
      + panel('Simulation inputs', `<div class="panel-body"><div class="fact-grid"><label>Synthetic state<select id="machine-state">${options(m.states, state.machineState)}</select></label><label>Event<select id="machine-input">${options(m.inputs, state.input)}</select></label><label>Virtual time (ms)<input id="virtual-time" type="number" min="0" step="1" value="${state.timeline.at(-1)?.atMs ?? 0}"></label></div><div class="toolbar">${action('step', '▷ Step event', 'primary', f.runnable === false)}${action('reset', 'Reset simulation')}${action('export-run', 'Export scenario', '', !state.timeline.length)}<span class="badge simulation">Synthetic guards</span></div>${resultView()}</div>`)
      + timelineView() + (state.showCode ? changesView() : `<button data-action="toggle-code" class="subtle">Code alongside this model</button>`);
  }
  const m = f.compiled;
  if (f.runnable === false) return blocked(f.blockedReason ?? 'This table is inspect-only.') + panel('Compiled model', `<pre class="panel-body">${escape(pretty(m))}</pre>`);
  return panel(`Decision table <code>${escape(f.id)}</code>`, `<div class="panel-body"><div class="fact-grid">${Object.entries(m.axes).map(([a, v]) => `<label>${escape(a)}<select data-fact="${escape(a)}">${options(v, state.facts[a])}</select></label>`).join('')}</div><div class="toolbar">${action('evaluate', '▷ Evaluate point', 'primary', f.runnable === false)}${action('edit-source', 'Open source', '', !source())}<span class="badge">${Object.values(m.axes).reduce((n, a) => n * a.length, 1)} points · ${m.cells.length} cells</span></div>${resultView()}</div>`)
    + panel('Named regions', decisionRegionTable(f,escape,state.selected?.id))
    + panel('Every declared point', `<div class="toolbar panel-body"><button data-action="table-prev">Previous 100</button><span>Rows ${(state.tableOffset??0)+1}–${Math.min((state.tableOffset??0)+100,state.tableRows?.length??0)} of ${state.tableRows?.length??0}</span><button data-action="table-next">Next 100</button></div><div class="table-wrap">${state.tableRows ? `<table><thead><tr>${Object.keys(m.axes).map(a => `<th>${escape(a)}</th>`).join('')}<th>Cell</th><th>Values</th></tr></thead><tbody>${state.tableRows.slice(state.tableOffset??0,(state.tableOffset??0)+100).map((r, localIndex) => `<tr data-point="${localIndex+(state.tableOffset??0)}" tabindex="0">${Object.values(r.at).map(v => `<td>${escape(v)}</td>`).join('')}<td>${escape(r.cell)}</td><td>${escape(JSON.stringify(r.values))}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Loading results from the shared kernel…</div>'}</div>`);
}
function resultView() {
  const r = state.result;
  if (!r) return '<small>Choose facts and evaluate. Unknown guard facts are never silently false.</small>';
  if (r.kind === 'needs-facts') return banner(r.message + ' Missing: ' + r.guards.join(', '), 'warning');
  return `<div class="notice success"><div class="result-big">${escape(r.kind === 'transition' ? `${r.from} → ${r.to}` : JSON.stringify(r.values))}</div><p>Cell: <code>${escape(r.cellId ?? r.cell ?? 'No matching cell; declared no-match behavior')}</code></p>${r.notice ? `<small>${escape(r.notice)}</small>` : ''}</div>`;
}
function timelineView() {
  if (!state.timeline.length) return '';
  return panel('Simulation history', `<div class="timeline">${state.timeline.map((e, i) => `<button data-history="${i}" class="timeline-event ${state.cursor === i ? 'current' : ''}"><small>${e.atMs} ms · #${i + 1}</small><strong>${escape(e.input)}</strong><code>${escape(e.to)}</code><small>${escape(e.cellId ?? 'no match')}</small></button>`).join('')}</div><div class="risk-caption">Revisiting history changes this simulator only. Stepping from an earlier frame branches the run; the original is retained for export.</div>`);
}
function scenarioTemplate() {
  const f = facet(); if (!f) return {};
  const e = f.kind === 'machine' ? { atMs: 0, input: state.input, guards: state.guards } : { atMs: 0, facts: state.facts };
  return { id: 'my-scenario', facetId: f.id, bundleDigest: project.bundleDigest, initialState: state.machineState, events: [e] };
}
const mockTemplate = () => ({ contracts: { 'example.catalog': { request: { item: 'string' }, response: { found: 'boolean' } } },
  fixtures: [{ boundaryId: 'example.catalog', request: { item: 'example' }, delayMs: 350, response: { found: true } }],
  requests: [{ operationId: 'request-1', boundaryId: 'example.catalog', atMs: 0, payload: { item: 'example' } }] });
function scenariosView() {
  const f = facet();
  state.scenarioText ??= pretty(scenarioTemplate()); state.mockText ??= pretty(mockTemplate());
  return banner('Scenarios run the shared logic kernel. Boundary fixtures are synthetic contracts, not connected product services. Missing mocks never fall back to external requests.')
    + panel('Versioned event scenario', `<div class="panel-body"><div class="toolbar"><button data-action="save-scenario">Save scenario locally</button><button data-action="open-scenarios">Open saved scenario</button></div><p class="muted">Add ordered events and independent <code>expect</code> assertions. Unknown guards stop the run. Time is virtual.</p><textarea id="scenario-editor" spellcheck="false" aria-label="Scenario JSON">${escape(state.scenarioText)}</textarea><div class="toolbar">${action('run-scenario', '▷ Run scenario', 'primary', !f)}${action('scenario-from-run', 'Use current history', '', !state.timeline.length)}${action('download-scenario', 'Export JSON')}</div>${state.scenarioResult ? `<div class="notice ${state.scenarioResult.stopped || state.scenarioResult.pass === false ? 'error' : state.scenarioResult.pass === null ? 'info' : 'success'}">${state.scenarioResult.stopped ? 'Stopped: missing facts.' : `${state.scenarioResult.events.length} events evaluated; ${state.scenarioResult.assertions.length} independent assertions supplied.`}</div><pre>${escape(pretty(state.scenarioResult))}</pre>` : ''}</div>`)
    + panel('Deterministic boundary fixtures', `<div class="panel-body"><p class="muted">Exact primitive-record requests, virtual delays, duplicate operation detection and fail-closed matching. This does not exercise the application transport.</p><textarea id="mock-editor" spellcheck="false" aria-label="Mock scenario JSON">${escape(state.mockText)}</textarea><div class="toolbar">${action('run-mocks', 'Run fixture requests', 'primary')}${action('download-mocks', 'Export fixtures')}</div>${state.mockResult ? `<pre>${escape(pretty(state.mockResult))}</pre>` : ''}</div>`);
}
function interfaceView() {
  const cases = project.gallery.filter(c => `${c.id} ${c.title} ${c.purpose}`.toLowerCase().includes(state.search.toLowerCase()));
  const scopes = project.product?.artifactScopes ?? [];
  return banner('Native previews, GPU execution and video-document writes are not connected. This view inspects catalog definitions and declared scopes; it does not replace product renderers.')
    + panel('Component catalog', `<div class="panel-body">${cases.length ? `<div class="card-grid">${cases.map(c => `<button class="catalog-card" data-case="${escape(c.id)}"><span class="symbol">◈</span><span class="badge">${escape(c.section ?? 'component')}</span><h3>${escape(c.title)}</h3><p>${escape(c.purpose)}</p><small>${c.scenarios?.length ?? 0} declared scenarios · inspect only</small></button>`).join('')}</div>` : empty('No catalog facet attached', 'Load Showcase generated ProductSpec JSON or attach its repository to browse the real catalog.')}</div>`)
    + panel('Artifact mount scopes', `<div class="panel-body">${scopes.length ? `<div class="compact-list">${scopes.map((s, i) => `<button data-scope="${i}"><code>${escape(s.artifactRef)} / ${escape(s.screenRef)}</code><p>${escape(s.surface)} · ${s.includedMounts?.length ?? 0} included · ${s.omittedMounts?.length ?? 0} omitted</p></button>`).join('')}</div>` : '<p class="muted">No compiled mount scopes in this selection.</p>'}</div>`);
}
function changesView() {
  const src = source(), f = facet();
  if (!src) return empty('Source not attached', 'Compiled JSON cannot recover imports, helper families or invariant code. Attach a supported source file to edit.');
  if (src.text === undefined) return banner(state.sourceLoadError ?? 'Loading this source file from the exact snapshot…');
  const text = state.text ?? src.text, d = state.draft;
  const sourceChanged = text !== src.text;
  return (experience?.proof() ?? '') + banner('Changes stay in a separate Studio draft. No repository source, video document, agent or runtime is changed. Export the patch and apply it through the product owner.')
    + sourceNavigator(project,state,escape)
    + panel(`Source <code>${escape(src.path)}</code>`, `<div class="source-editor-wrap"><pre id="line-gutter" aria-hidden="true">${Array.from({length:text.split('\n').length},(_,i)=>i+1).join('\n')}</pre><textarea class="code-editor" id="source-editor" data-document="${escape(src.path)}" spellcheck="false" aria-label="DSL source editor" >${escape(text)}</textarea></div><div class="panel-body"><div class="toolbar">${action('validate', 'Validate draft', 'primary')}${action('undo', 'Undo edit', '', !state.undo.length)}${action('redo', 'Redo edit', '', !state.redo.length)}${action('simulate-draft', 'Explore this draft', '', !d?.valid)}${action('save', 'Save local draft', '', !d)}${action('git-save', 'Save Git draft branch', '', !d?.valid || !project.capabilities.gitDrafts)}${action('patch', 'Download patch', '', !d || !d.valid)}${action('download-source', 'Export source')}</div><small>${sourceChanged ? 'Source edits stay separate. Validation has a deliberately bounded scope.' : 'Source is unchanged.'} ${project.capabilities.gitDrafts ? 'Git draft saves enabled for this exact repository.' : 'Git branch saving is disabled unless explicitly enabled at server startup.'}</small></div>`)
    + (d ? panel('Validation & semantic diff', `<div class="panel-body">${banner(d.valid ? 'Supported declarations passed the shared kernel. Full product build and native behavior are not verified.' : 'Draft is invalid or contains an unsupported expression. It can be saved as an invalid draft, but not exported as validated.', d.valid ? 'success' : 'error')}${diagnostics(d.diagnostics)}<small>${d.diff.changes.length} changed paths${d.diff.truncated ? ' (truncated)' : ''}</small><pre>${escape(pretty(d.diff.changes))}</pre><details><summary>Source patch</summary><pre class="diff">${escape(d.patch)}</pre></details></div>`) : '')
    + panel('Persistence boundaries', '<div class="panel-body"><p><strong>Local draft</strong> preserves the proposed source and base revision in Studio storage.</p><p><strong>Patch</strong> is a reviewable source change. It is not applied automatically.</p><p><strong>Video project</strong> and <strong>native runtime</strong> changes require their existing owners and are not available here.</p></div>');
}
function inspector() {
  if (state.selected?.kind === 'entity') { const html=entityInspector(project,state.selected,escape); if(html) return html; }
  const f = facet(), cell = selectedCell();
  const overview = state.selected ? '' : projectSummary(project,escape);
  if (state.selected?.kind === 'node' && state.view === 'System') {
    const n = project.graph.nodes.find(n => n.id === state.selected.id);
    if (n) return `<div class="section-label">${escape(n.kind)}</div><h2>${escape(n.id)}</h2><dl class="properties"><dt>Type</dt><dd>${escape(n.type?.id ?? 'Not exported')}</dd><dt>Ports</dt><dd>${n.ports?.length ?? 0}</dd></dl><details open><summary>Declared ports</summary><pre>${escape(pretty(n.ports))}</pre></details><details><summary>Type and runtime contract</summary><pre>${escape(pretty(n.type))}</pre></details><details><summary>Instance</summary><pre>${escape(pretty(n.declaration))}</pre></details>${banner('Inspect only. Connecting ports requires source provenance and full product validation, which this adapter has not supplied.')}`;
  }
  if (state.selected?.kind === 'case') {
    const c = project.gallery.find(c => c.id === state.selected.id);
    if (c) return `<div class="section-label">Catalog case</div><h2>${escape(c.title)}</h2><p class="subtitle">${escape(c.purpose)}</p><hr><code>${escape(c.id)}</code><div class="section-label">Scenarios</div>${(c.scenarios ?? []).map(s => `<div class="notice info"><strong>${escape(s.label)}</strong><p>${escape(s.description)}</p></div>`).join('')}${banner('Native preview not connected. These are declared cases, not executed results.')}`;
  }
  if (state.selected?.kind === 'artifact' || state.selected?.kind === 'scope') {
    const value = state.selected.kind === 'artifact' ? project.product?.artifacts.find(a => a.id === state.selected.id) : project.product?.artifactScopes[Number(state.selected.id)];
    return `<div class="section-label">Declared scope</div><pre>${escape(pretty(value))}</pre><hr>${banner('Declared capability is not proof of a connected renderer.')}`;
  }
  if (['Welcome','Problems','Compare','System','Trace','Intent'].includes(state.view)) return overview;
  if (!f) return overview;
  if (f.runnable === false || !['machine','decision-table'].includes(f.kind)) return `${overview}<h2>${escape(f.id)}</h2>${banner(f.blockedReason ?? 'Inspection only')}<details><summary>Raw exported model</summary><pre>${escape(pretty(f.compiled))}</pre></details>`;
  if (f.kind === 'machine') {
    const relevant = new Set(f.compiled.cells.filter(c => c.from === state.machineState && c.on === state.input).flatMap(c => [...c.requires, ...c.forbids]));
    return `${overview}<div class="section-label">${cell ? 'Transition definition' : 'Machine'}</div><h2>${escape(cell?.id ?? f.id)}</h2>${cell ? `<dl class="properties"><dt>From</dt><dd>${escape(cell.from)}</dd><dt>Event</dt><dd>${escape(cell.on)}</dd><dt>To</dt><dd>${escape(cell.to)}</dd></dl><div class="toolbar">${action('use-cell', 'Use as synthetic input')}${action('edit-cell', 'Edit definition', '', !f.editable)}</div><hr>` : ''}
      <div class="section-label">Scenario facts · not definition edits</div><small>Required for this event are marked •. Unknown blocks stepping.</small>
      ${f.compiled.guards.map(g => `<label class="guard-row ${String(state.guards[g])}"><code>${relevant.has(g) ? '• ' : ''}${escape(g)}</code><select data-guard="${escape(g)}" aria-label="Scenario guard ${escape(g)}"><option value="unknown" ${state.guards[g] === 'unknown' ? 'selected' : ''}>Unknown</option><option value="true" ${state.guards[g] === true ? 'selected' : ''}>True</option><option value="false" ${state.guards[g] === false ? 'selected' : ''}>False</option></select></label>`).join('')}
      <hr><div class="section-label">Source ${f.source ? `· line ${f.source.line}` : ''}</div><pre class="source-excerpt">${escape(pretty(cell ?? { id: f.id, initial: f.compiled.initial, rests: f.compiled.rests, deadlines: f.compiled.deadlines }))}</pre><hr><small>Guards are supplied facts. No sensor, deadline timer or native field update runs here.</small>`;
  }
  return `${overview}<div class="section-label">Decision region</div><h2>${escape(cell?.id ?? f.id)}</h2>${cell ? `<dl class="properties"><dt>Region</dt><dd><pre>${escape(pretty(cell.region))}</pre></dd><dt>Values</dt><dd><pre>${escape(pretty(cell.values))}</pre></dd></dl>${action('edit-cell', 'Edit region / values', '', !f.editable)} ${action('split-region', 'Split region', '', !f.editable)}` : '<p class="subtitle">Select a named cell or evaluate a point.</p>'}<hr><div class="section-label">Product invariants</div>${(f.compiled.invariants ?? []).length ? f.compiled.invariants.map(v => `<p class="notice info">${escape(v)}</p>`).join('') : '<small>No additional product invariants in this table.</small>'}<hr><div class="section-label">Why / why not</div>${decisionReasons(state.result?.alternatives,escape)}${f.validation.includes('structure-only') ? banner('Invariant callback code was not present in the imported artifact. It was not re-executed.') : ''}`;
}

function renderGraph() {
  const host = $('#graph'); if (!host) { graph?.destroy(); graph=null; graphHost=null; graphSignature=''; return; }
  const f = state.view==='Trace'?traceFacet(project,state):facet(); let nodes, edges;
  if (['Logic','Trace'].includes(state.view) && f?.kind === 'machine') {
    ({nodes,edges}=machineGraph(f));
  } else {
    const canvas = state.view==='Trace'?project.canvas:state.canvas ?? project.canvas;
    if (canvas) { nodes=canvas.nodes; edges=canvas.edges; } else {
    const q = state.search.toLowerCase();
    nodes = project.graph.nodes.filter(n => !q || `${n.id} ${n.kind} ${(n.ports ?? []).map(p => p.ref).join(' ')}`.toLowerCase().includes(q)).map(n => ({ ...n, label: n.id, subtitle: `${n.kind} · ${n.ports?.length ?? 0} ports` }));
    edges = project.graph.edges.map(e => ({ ...e, label: e.purpose ?? e.kind ?? 'binding' }));
    }
  }
  const compact=state.view==='Trace'&&host.clientWidth<700,flow=f?.kind==='machine'&&['Trace','Logic'].includes(state.view);
  const cameraKey = project.key + ':' + (state.view === 'System' ? 'System:'+(state.architectureMode ?? 'owners') + ':' + (state.architectureGroup ?? '') + ':' + (state.focusKey ?? 'all') : state.view+':'+(f?.id??'system')+(compact?':compact':'')+(flow?':flow-v1':''));
  const signature = JSON.stringify({cameraKey, model:project.modelDigest, nodes, edges});
  const marks=state.view==='Trace'&&state.traceFrame?(f?.kind==='machine'
    ?traceGraphMarks(f,state.traceFrame,traceEventRows(project,state))
    :!f?traceArchitectureMarks(project,state.traceFrame,traceEventRows(project,state)):null):null;
  const selected=state.view==='Trace'?marks?.currentEdge:state.selected?.id,active=state.view==='Trace'?marks?.currentTo:state.view==='Logic'?state.machineState:null;
  if (host === graphHost && signature === graphSignature && (!selected || graph.has(selected) || !nodes.some(n=>n.id===selected))) { graph.select(selected,active,marks); return; }
  graph?.destroy();graphHost=host;graphSignature=signature;
  graph = drawGraph(host, { nodes, edges, key: cameraKey, legacyKey:flow?null:project.key+':'+(f?.id??'system')+':'+state.view,
    initial:flow?f.compiled.initial:null,columns:compact?2:flow?Math.min(6,Math.max(4,f.compiled.states.length)):3,viewWidth:compact?650:1000,viewHeight:state.view==='Trace'?350:550,
    selected, active, trace:marks,focusIds:state.view==='Trace'&&!f?marks?.focusIds:null,
    onSelect: (kind, id) => { if (state.view === 'System' && state.architectureMode === 'domains') { state.architectureGroup=id; state.architectureMode='owners'; refreshArchitecture(); return; } if(state.view==='Trace'){if(f){selectFacet(f.id,false);state.view='Logic';}else state.view='System';} state.selected = { kind: state.view === 'System' && kind === 'node' ? 'entity' : state.view === 'Logic' && kind === 'edge' ? 'cell' : kind, id }; render(); if (innerWidth < 950) $('.inspector').classList.add('open'); } });
}
async function loadTable() {
  const ticket = generation, id = state.facetId; state.tableRows = [];
  try { const rows = await api('table', requestContext()); if (ticket === generation && id === state.facetId) { state.tableRows = rows; render(); } } catch (e) { toast(e.message); }
}
function bind() {
  bindingController?.abort(); bindingController = new AbortController();
  $('#project').onchange = e => loadProject(e.target.value).catch(e => toast(e.message));
  $('#search').oninput = e => { state.search = e.target.value; clearTimeout(state.searchTimer); state.searchTimer=setTimeout(()=>{if(state.view==='System')refreshArchitecture();else render();},120); };
  const showView=view=>{
    if(view==='System'&&state.selected?.kind==='entity') {
      const selected=project.architecture.entities.find(entity=>entity.key===state.selected.id);
      if(!['node','component','port','facet'].includes(selected?.kind))state.selected=null;
    }
    state.view = view; render();
    if(state.view==='Trace' && project.trace && !state.traceFrame)
      loadTraceFrame(project.trace.eventCount-1);
  };
  document.querySelectorAll('.topbar nav button[data-view]').forEach(b => b.onclick = () => showView(b.dataset.view));
  listen($('#mobile-view'),'change',e=>showView(e.target.value));
  document.querySelectorAll('[data-facet]').forEach(b => b.onclick = () => { selectFacet(b.dataset.facet, false); state.view = 'Logic'; render(); });
  document.querySelectorAll('[data-node]').forEach(b => b.onclick = () => { state.view = 'System'; state.selected = { kind: 'entity', id: project.architecture.entities.find(e=>e.id===b.dataset.node && ['node','component'].includes(e.kind))?.key };  render(); });
  document.querySelectorAll('[data-cell]').forEach(b => { const choose = () => { if(state.view==='Trace'){const f=traceFacet(project,state);if(f){selectFacet(f.id,false);state.view='Logic';}} state.selected = { kind: 'cell', id: b.dataset.cell }; render(); }; b.onclick = choose; b.onkeydown = e => { if (e.key === 'Enter') choose(); }; });
  document.querySelectorAll('[data-point]').forEach(b => { const choose = () => { state.facts = { ...state.tableRows[Number(b.dataset.point)].at }; perform('evaluate'); }; b.onclick = choose; b.onkeydown = e => { if (e.key === 'Enter') choose(); }; });
  document.querySelectorAll('[data-case]').forEach(b => b.onclick = () => { state.selected = { kind: 'case', id: b.dataset.case }; render(); if (innerWidth < 950) $('.inspector').classList.add('open'); });
  document.querySelectorAll('[data-artifact],[data-scope]').forEach(b => b.onclick = () => { state.selected = { kind: b.dataset.artifact ? 'artifact' : 'scope', id: b.dataset.artifact ?? b.dataset.scope }; render(); });
  document.querySelectorAll('[data-guard]').forEach(b => b.onchange = () => { ++generation; state.guards[b.dataset.guard] = b.value === 'unknown' ? 'unknown' : b.value === 'true'; state.result = null; render(); });
  document.querySelectorAll('[data-fact]').forEach(b => b.onchange = () => { ++generation; state.facts[b.dataset.fact] = b.value; state.result = null; render(); });
  document.querySelectorAll('[data-history]').forEach(b => b.onclick = () => { state.cursor = Number(b.dataset.history); const frame = state.timeline[state.cursor]; state.machineState = frame.to; state.result = frame; state.mode = 'Simulation'; render(); });
  listen($('#machine-state'),'change', e => { ++generation; state.machineState = e.target.value; state.result = null; render(); });
  listen($('#machine-input'),'change', e => { ++generation; state.input = e.target.value; render(); });
  listen($('#scenario-editor'),'input', e => { ++generation; state.scenarioText = e.target.value; state.scenarioDirty = true; state.scenarioResult = null; });
  listen($('#mock-editor'),'input', e => { ++generation; state.mockText = e.target.value; state.mockDirty = true; state.mockResult = null; });
  listen($('#source-editor'),'input', e => { ++generation; if (state.text === null) state.undo.push(source().text); state.text = e.target.value; state.draft = null; state.dirty = true; state.scenarioResult = null; $('#edit-status').textContent = 'Unvalidated draft · source unchanged'; updateGutter(e.target.value); });
  document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => perform(b.dataset.action));
  bindStudioTools();
}

async function perform(name) {
  const nonblocking = ['explorer', 'inspector', 'fit', 'zoom-in', 'zoom-out'];
  if (busy && !nonblocking.includes(name)) return toast('An operation is still in progress.');
  if (name === 'fit') return graph?.reset();
  if (name === 'zoom-in' || name === 'zoom-out') return graph?.zoom(name === 'zoom-in' ? 1.2 : .8);
  if (name === 'explorer' || name === 'inspector') { $('.' + name).classList.toggle('open'); return; }
  const ticket = generation;
  busy = true;
  try {
    const f = facet(), cell = selectedCell();
    if (['validate','edit-cell','edit-root','add-cell','split-region','download-source','patch'].includes(name) && source()?.text === undefined) { await ensureSource(); if(ticket!==generation)return; }
    if (name==='table-prev'||name==='table-next') { state.tableOffset=Math.max(0,Math.min(Math.max(0,(state.tableRows?.length??0)-1), (state.tableOffset??0)+(name==='table-next'?100:-100)));render();return; }
    if (await performStudioTool(name)) return;
    if (name === 'explorer' || name === 'inspector') { $('.' + name).classList.toggle('open'); return; }
    if (name === 'fit') return graph?.reset();
    if (name === 'zoom-in' || name === 'zoom-out') return graph?.zoom(name === 'zoom-in' ? 1.2 : .8);
    if (name === 'import') return $('#file-import').click();
    if (name === 'snapshot') return $('#snapshot-import').click();
    if (name === 'connect-help') return showInfo('Attach real repositories', 'Stop this server and start it with the repositories you want to inspect. No clone, worktree or product process is started.', 'npm start -- --workspace /path/to/skydive-altimeter --workspace /path/to/agentmux --workspace /path/to/ai-dsl --workspace /path/to/circlekit');
    if (name === 'reload') { await reloadProject(false); return; }
    if (name === 'use-cell' && cell && f?.kind === 'machine') {
      state.guards = Object.fromEntries(f.compiled.guards.map(g => [g, cell.requires.includes(g)]));
      state.machineState = cell.from; state.input = cell.on; state.mode = 'Simulation'; state.result = null; render(); toast('Guard values explicitly set as synthetic input. This is not observed runtime evidence.'); return;
    }
    if (name === 'step' || name === 'evaluate') {
      const atMs = Number($('#virtual-time')?.value ?? 0);
      const result = await api('evaluate', { ...requestContext(), state: state.machineState, input: state.input, guards: state.guards, facts: state.facts });
      if (ticket !== generation) return;
      state.result = result; state.mode = 'Simulation';
      if (result.kind === 'transition') {
        if (state.cursor < state.timeline.length - 1) { state.archivedRuns.push([...state.timeline]); state.timeline = state.timeline.slice(0, state.cursor + 1); }
        const time = Math.max(Number.isSafeInteger(atMs) ? atMs : 0, state.timeline.at(-1)?.atMs ?? 0);
        state.timeline.push({ ...result, atMs: time }); state.cursor = state.timeline.length - 1; state.machineState = result.to; state.selected = { kind: 'cell', id: result.cellId };
      } else if (result.kind === 'decision') state.selected = { kind: 'cell', id: result.cell };
      render(); return;
    }
    if (name === 'reset') { if (state.timeline.length) state.archivedRuns.push([...state.timeline]); state.timeline = []; state.cursor = -1; state.machineState = f?.compiled.initial; state.result = null; state.mode = 'Simulation'; render(); return; }
    if (name === 'edit-source') { state.view = 'Changes'; render(); return; }
    if (name === 'validate') {
      const text = $('#source-editor')?.value ?? state.text ?? source().text;
      const proposal = await api('propose', { ...requestContext(), file: source().path, text });
      if (ticket === generation && text === ($('#source-editor')?.value ?? state.text ?? source().text)) { state.dirty = text !== source().text; state.text = text; state.draft = proposal; render(); }
      return;
    }
    if (name === 'save' || name === 'git-save') { const result = await api(name === 'save' ? 'save-draft' : 'save-git-draft', { id: state.draft.id }); if (ticket === generation) { state.dirty = false; toast(result.message + (result.branch ? ' Branch: ' + result.branch : '')); } return; }
    if (name === 'simulate-draft') { const d = state.draft; const p = await api('import-source', { text: d.text, file: d.file, label: 'Candidate · ' + state.facetId }); projects = await api('projects'); await loadProject(p.key); toast('Independent candidate loaded. The original project, source and simulation were retained.'); return; }
    if (name === 'patch') return download(source().path.split('/').at(-1) + '.patch', state.draft.patch, 'text/x-diff');
    if (name === 'download-source') return download(source().path.split('/').at(-1), state.text ?? source().text, 'text/plain');
    if (name === 'undo' && state.undo.length) { state.redo.push(state.text ?? source().text); state.text = state.undo.pop(); state.draft = null; state.dirty = state.text !== source().text; render(); return; }
    if (name === 'redo' && state.redo.length) { state.undo.push(state.text ?? source().text); state.text = state.redo.pop(); state.draft = null; state.dirty = state.text !== source().text; render(); return; }
    if (name === 'edit-cell') return editDialog(f, cell);
    if (name === 'edit-root') return editDialog(f, f.compiled, true);
    if (name === 'add-cell') return addCellDialog(f);
    if (name === 'new') return newDialog();
    if (name === 'saved') {
      const rows = await api('drafts'); if (ticket !== generation) return;
      const dialog = $('#dialog'); dialog.innerHTML = `<h2>Saved local drafts</h2><p class="subtitle">Opening a draft does not apply it to a repository.</p><div class="compact-list">${rows.map(d => `<button data-open-draft="${escape(d.id)}"><strong>${escape(d.file)}</strong><p>${escape(d.savedAt)} · ${d.valid ? 'logic validated' : 'invalid draft'}</p></button>`).join('') || '<p class="empty">No saved drafts.</p>'}</div><hr><button id="close-dialog">Close</button>`; dialog.showModal();
      $('#close-dialog').onclick = () => dialog.close();
      dialog.querySelectorAll('[data-open-draft]').forEach(b => b.onclick = async () => {
        try { const d = await api('draft?id=' + b.dataset.openDraft); const p = await api('import-source', { text: d.text, file: d.file, label: 'Saved draft · ' + d.file.split('/').at(-1) }); projects = await api('projects'); dialog.close(); await loadProject(p.key); } catch (e) { toast(e.message); }
      }); return;
    }
    if (name === 'run-scenario') { const result = await api('scenario', { ...requestContext(), scenario: JSON.parse(state.scenarioText) }); if (ticket === generation) { state.scenarioResult = result; state.mode = 'Simulation'; render(); } return; }
    if (name === 'run-mocks') { const result = await api('mocks', { scenario: JSON.parse(state.mockText) }); if (ticket === generation) { state.mockResult = result; state.mode = 'Simulation'; render(); } return; }
    if (name === 'scenario-from-run') { state.scenarioText = pretty(exportScenario()); render(); return; }
    if (name === 'export-run' || name === 'download-scenario') return download('scenario.json', name === 'export-run' ? pretty(exportScenario()) : state.scenarioText);
    if (name === 'download-mocks') {download('boundary-fixtures.json', state.mockText);state.mockDirty=false;return;}
  } catch (e) { if (ticket === generation) { if (['step','evaluate'].includes(name)) state.result = null; if (name === 'run-scenario') state.scenarioResult = null; if (name === 'run-mocks') state.mockResult = null; render(); toast((e.code ? e.code + ': ' : '') + e.message); } }
  finally { busy = false; }
}
function exportScenario() {
  return { id: 'recorded-simulation', facetId: state.facetId, bundleDigest: project.bundleDigest,
    initialState: state.timeline[0]?.from ?? state.machineState,
    events: state.timeline.map(e => ({ atMs: e.atMs, input: e.input, guards: e.guardFacts })),
    note: 'Recorded synthetic inputs. No independent expected assertions were generated.' };
}
function showInfo(title, text, code = '') {
  const d = $('#dialog'); d.innerHTML = `<h2>${escape(title)}</h2><p class="subtitle">${escape(text)}</p>${code ? `<pre class="notice info">${escape(code)}</pre>` : ''}<button id="close-dialog">Close</button>`;
  d.showModal(); $('#close-dialog').onclick = () => d.close();
}
function showConvergence() {
  const c=project.convergence,d=$('#dialog');
  d.innerHTML=`<h2>${escape(c.label)}</h2><p class="subtitle">Loaded evidence for ${escape(project.label)}. No tests or product code ran to produce this verdict.</p>
    <p class="muted">Laws ${c.counts.laws.passed} passed, ${c.counts.laws.failed} failed, ${c.counts.laws.skipped} skipped. Trace ${c.counts.trace.consistent} consistent, ${c.counts.trace.different} different, ${c.counts.trace.unknown} unknown. WHAT/WHY ${c.counts.contracts.validated}/${c.counts.contracts.total} validated, ${c.counts.contracts.matched} matched to exported source provenance, ${c.counts.contracts.external} external or unmapped.</p>
    <p class="muted">Kernel ${escape(c.kernel.producer ?? 'unknown')} / ${escape(c.kernel.evaluator)}: ${c.kernel.match?'matched':'unknown or different'}. Trace identity: ${c.traceIdentity.loaded?'matched loaded artifact or model':'unavailable'}.</p>
    <div class="compact-list">${c.reasons.map((r,i)=>`<button data-convergence-reason="${i}">${escape(r.label)}<br><code>${escape(r.entityKey)}</code>${r.file?` · ${escape(r.file)}`:''}${r.sequence!==undefined?` · sequence ${r.sequence}`:''}<p>${escape(r.message)}</p></button>`).join('') || '<p>No contradictions in loaded evidence.</p>'}</div>
    ${c.gaps.length?`<div class="section-label">Missing or inconclusive</div><ul>${c.gaps.map(g=>`<li>${escape(g)}</li>`).join('')}</ul>`:''}
    <button id="close-dialog">Close</button>`;
  d.showModal();$('#close-dialog').onclick=()=>d.close();
  d.querySelectorAll('[data-convergence-reason]').forEach(button=>button.onclick=async()=>{
    const reason=c.reasons[Number(button.dataset.convergenceReason)];d.close();
    if(reason.kind==='trace') {state.view='Trace';state.traceOffset=0;await loadTraceFrame(reason.index);}
    else if(project.architecture.entities.some(entity=>entity.key===reason.entityKey)) {
      state.view='System';state.selected={kind:'entity',id:reason.entityKey};state.queryFrom=reason.entityKey;render();
    } else if(reason.file && project.sources.some(source=>source.path===reason.file)) {
      state.view='Changes';state.sourcePath=reason.file;state.selected=null;render();
    } else toast('This reason has no attached entity or source in the loaded snapshot.');
  });
}
function editDialog(f, cell, root = false) {
  if (!cell) return toast('Select a cell first.');
  const fields = root ? ['initial','states','inputs','guards','rests','deadlines','ordering','otherwise'] : f.kind === 'machine' ? ['from', 'on', 'to', 'requires', 'forbids'].filter(k => Object.hasOwn(cell, k)) : ['region', 'values'];
  const d = $('#dialog');
  d.innerHTML = `<form id="edit-form"><h2>Edit ${escape(cell.id)}</h2><p class="muted">Definition change, not scenario input. The exact source diff is shown before any export.</p><label>Field<select id="edit-field">${options(fields, fields[0])}</select></label><label>Replacement JSON<textarea id="edit-value" spellcheck="false">${escape(pretty(cell[fields[0]]))}</textarea></label><div class="toolbar"><button type="submit" class="primary">Prepare source draft</button><button type="button" id="cancel-dialog">Cancel</button></div></form>`;
  d.showModal(); $('#cancel-dialog').onclick = () => d.close(); $('#edit-field').onchange = e => { $('#edit-value').value = pretty(cell[e.target.value]); };
  $('#edit-form').onsubmit = async e => {
    e.preventDefault(); const ticket = generation;
    try {
      if (state.text !== null && state.text !== source().text) return toast('Use Explore this draft to continue visual edits on your candidate, or combine changes in the source editor. The original draft is retained.');
      const result = await api('propose', { ...requestContext(), cellId: root ? null : cell.id, field: $('#edit-field').value, value: JSON.parse($('#edit-value').value) });
      if (ticket !== generation) return;
      state.undo.push(state.text ?? source().text); state.redo = []; state.dirty = true; state.text = result.text; state.draft = result; state.view = 'Changes'; d.close(); render();
    } catch (err) { toast(err.message); }
  };
}
function addCellDialog(f) {
  const m = f.compiled, d = $('#dialog');
  d.innerHTML = `<form id="transition-form"><h2>Add transition</h2><p class="muted">Append one ordinary machine cell without rewriting existing source. The compiler still checks ambiguity and reachability.</p><label>Stable cell ID<input id="transition-id" value="new-transition" required pattern="[a-z][a-z0-9.\\-]*"></label><div class="fact-grid"><label>From<select id="transition-from">${options(m.states,m.states[0])}</select></label><label>Event<select id="transition-on">${options(m.inputs,m.inputs[0])}</select></label><label>To<select id="transition-to">${options(m.states,m.states[1])}</select></label></div><label>Required guards, separated by commas<input id="transition-requires" placeholder="${escape(m.guards.join(', '))}"></label><label>Forbidden guards, separated by commas<input id="transition-forbids"></label><div class="toolbar"><button type="submit" class="primary">Prepare source draft</button><button type="button" id="cancel-dialog">Cancel</button></div></form>`;
  d.showModal(); $('#cancel-dialog').onclick = () => d.close();
  $('#transition-form').onsubmit = async e => {
    e.preventDefault(); const ticket = generation;
    if (state.text !== null && state.text !== source().text) return toast('Explore the current draft first, or combine edits in the source editor.');
    const csv = id => $(id).value.split(',').map(v => v.trim()).filter(Boolean);
    const value = { id: $('#transition-id').value, from: $('#transition-from').value, on: $('#transition-on').value, to: $('#transition-to').value };
    const requires = csv('#transition-requires'), forbids = csv('#transition-forbids');
    if (requires.length) value.requires = requires; if (forbids.length) value.forbids = forbids;
    try { const r = await api('propose', { ...requestContext(), insert: true, collection: 'cells', value });
      if (ticket !== generation) return;
      state.undo.push(state.text ?? source().text); state.text = r.text; state.draft = r; state.dirty = true; state.redo = []; state.view = 'Changes'; d.close(); render();
    } catch (error) { toast(error.message); }
  };
}
function newDialog() {
  const d = $('#dialog');
  d.innerHTML = '<form id="new-form"><h2>New declaration</h2><p class="muted">Create ordinary ProductSpec source. No new language or runtime implementation is generated.</p><label>Kind<select id="new-kind"><option value="machine">State machine</option><option value="table">Decision table</option></select></label><label>Stable ID<input id="new-id" value="my-product.logic" required pattern="[a-z][a-z0-9.\\-]*"></label><div class="toolbar"><button type="submit" class="primary">Create source draft</button><button type="button" id="cancel-dialog">Cancel</button></div></form>';
  d.showModal(); $('#cancel-dialog').onclick = () => d.close();
  $('#new-form').onsubmit = async e => {
    e.preventDefault(); const id = $('#new-id').value, isMachine = $('#new-kind').value === 'machine';
    const text = isMachine ? `import { defineMachine } from '@v1d/product-spec';\n\nexport const machine = defineMachine({\n  id: ${JSON.stringify(id)},\n  states: ['IDLE', 'RUNNING'], initial: 'IDLE',\n  inputs: ['Start', 'Stop'], guards: [],\n  rests: ['IDLE', 'RUNNING'], deadlines: [],\n  ordering: 'exclusive', otherwise: 'stay',\n  cells: [\n    { id: 'start', from: 'IDLE', on: 'Start', to: 'RUNNING' },\n    { id: 'stop', from: 'RUNNING', on: 'Stop', to: 'IDLE' },\n  ],\n});\n`
      : `import { defineDecisionTable, choice, on } from '@v1d/product-spec';\n\nexport const policy = defineDecisionTable({\n  id: ${JSON.stringify(id)},\n  axes: { permission: ['ALLOWED', 'BLOCKED'] },\n  columns: { action: choice(['RUN', 'HOLD']) },\n  cells: [\n    on('allowed', { permission: 'ALLOWED' }, { action: 'RUN' }),\n    on('blocked', { permission: 'BLOCKED' }, { action: 'HOLD' }),\n  ],\n});\n`;
    try { const p = await api('import-source', { text, file: 'new-declaration.ts', label: id }); projects = await api('projects'); d.close(); await loadProject(p.key); }
    catch (err) { toast(err.message); }
  };
}

function updateGutter(text) {
  const gutter=$('#line-gutter'); if(gutter) gutter.textContent=Array.from({length:text.split('\n').length},(_,i)=>i+1).join('\n');
}
async function refreshArchitecture(query=null) {
  const ticket=++generation;
  try {
    const result=await api('query',{...requestContext(),query,filter:{mode:state.architectureMode ?? 'owners',group:state.architectureGroup || null,query:state.search}});
    if(ticket!==generation) return;
    state.canvas=result.canvas;state.queryResult=result.result;state.focusKey=null;render();
  }catch(error){if(ticket===generation)toast(error.message);}
}
async function openEntitySource(key) {
  const origin=project.sourceIndex.origins.find(o=>o.entityKey===key);
  if(!origin) return toast('A unique, current source location is not available for this entity.');
  ++generation;state.sourcePath=origin.file;state.sourceSpan=origin.span;state.selected={kind:'entity',id:key};state.view='Changes';state.sourceLoadError=null;render();
  const ticket=generation;try { await ensureSource(); } catch(error){toast(error.message);return;}
  if(ticket!==generation)return;
  const editor=$('#source-editor');
  if(editor && origin.span && (state.text===null || state.text===source().text)) {
    editor.focus();editor.setSelectionRange(origin.span.start,origin.span.end);
    editor.scrollTop=Math.max(0,source().text.slice(0,origin.span.start).split('\n').length-3)*20;
    if($('#line-gutter')) $('#line-gutter').scrollTop=editor.scrollTop;
  }else if(state.text!==null && state.text!==source().text) toast('This source has a draft. Original model spans are not applied to modified text. Validate and open the candidate to refresh mapping.');
}
function bindStudioTools() {
  listen($('#convergence-badge'),'click',showConvergence);
  const from=$('#query-from'),to=$('#query-to');
  if(from){from.value=state.queryFrom ?? (state.selected?.kind==='entity' ? state.selected.id : project.architecture.entities.find(e=>e.kind==='node')?.key ?? '');from.onchange=()=>{state.queryFrom=from.value;};}
  if(to){to.value=state.queryTo ?? project.architecture.entities.find(e=>e.kind==='component')?.key ?? from?.value;to.onchange=()=>{state.queryTo=to.value;};}
  listen($('#query-context'),'change',e=>{state.includeContext=e.target.checked;});
  for(const field of ['mode','group']) listen($('#architecture-'+field),'change',e=>{state[field==='mode'?'architectureMode':'architectureGroup']=e.target.value;refreshArchitecture();});
  document.querySelectorAll('[data-query]').forEach(b=>b.onclick=()=>refreshArchitecture({kind:b.dataset.query,from:$('#query-from').value,to:$('#query-to').value,purposes:state.includeContext?['data','demand','context']:['data']}));
  document.querySelectorAll('[data-query-entity]').forEach(b=>b.onclick=()=>{state.view='System';state.queryFrom=b.dataset.queryEntity;refreshArchitecture({kind:'impact',from:b.dataset.queryEntity});});
  document.querySelectorAll('[data-source-entity]').forEach(b=>b.onclick=()=>openEntitySource(b.dataset.sourceEntity));
  document.querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{state.selected={kind:'entity',id:b.dataset.entity};state.queryFrom=b.dataset.entity;render();if(innerWidth<950)$('.inspector').classList.add('open');});
  document.querySelectorAll('[data-trace-sequence]').forEach(b=>{
    const choose=()=>loadTraceFrame(Number(b.dataset.traceIndex));
    b.onclick=choose;b.onkeydown=e=>{if(e.key==='Enter')choose();};
  });
  listen($('#trace-cursor'),'change',e=>loadTraceFrame(Number(e.target.value)));
  listen($('#source-file'),'change',e=>{++generation;state.sourcePath=e.target.value;state.sourceSpan=null;state.sourceLoadError=null;render();});
  const editor=$('#source-editor');
  listen(editor,'scroll',()=>{const g=$('#line-gutter');if(g)g.scrollTop=editor.scrollTop;});
  listen(editor,'click',()=>{
    const at=editor.selectionStart,line=editor.value.slice(0,at).split('\n').length;
    if($('#source-position'))$('#source-position').textContent=`Line ${line} · offset ${at}`;
    if(editor.value!==source().text)return;
    const candidates=project.sourceIndex.origins.filter(o=>o.file===source().path && o.span && o.span.start<=at && at<=o.span.end)
      .sort((a,b)=>(a.span.end-a.span.start)-(b.span.end-b.span.start));
    if(candidates[0]){state.selected={kind:'entity',id:candidates[0].entityKey};patchHTML($('.inspector'),inspector());
      document.querySelectorAll('[data-source-entity]').forEach(b=>b.onclick=()=>openEntitySource(b.dataset.sourceEntity));
      document.querySelectorAll('[data-query-entity]').forEach(b=>b.onclick=()=>{state.view='System';state.queryFrom=b.dataset.queryEntity;refreshArchitecture({kind:'impact',from:b.dataset.queryEntity});});experience?.afterRender();}
  });
}
async function loadTraceFrame(cursor) {
  if(!project.trace)return;
  const ticket=++generation;
  try {
    const result=await api('trace-page',{...requestContext(),traceDigest:project.trace.traceDigest,offset:state.traceOffset??0,limit:200,filter:{cursor,search:state.traceSearch ?? '',operationId:state.traceOperation || null}});
    if(ticket!==generation)return;
    state.traceCursor=cursor;state.traceFrame=result;state.mode=project.trace.provenance==='synthetic'?'Simulation'
      :project.trace.provenance==='test-run'?'Test run':'Recorded trace';
    if(result.current)state.selected={kind:'entity',id:result.current.entityKey};render();
    if(result.totalEvents>result.events.length||state.traceSearch||state.traceOperation)loadTraceHistory();
  }catch(error){if(ticket===generation)toast(error.message);}
}
function loadTraceHistory() {
  const owner=project,view=state,digest=owner.trace?.traceDigest;
  if(!digest||view.traceHistory?.digest===digest||view.traceHistoryPending||view.traceHistoryError?.digest===digest)return;
  view.traceHistoryPending=api('trace-export',{project:owner.key,bundleDigest:owner.bundleDigest,traceDigest:digest})
    .then(trace=>{
      if(project!==owner||state!==view||project.trace?.traceDigest!==digest)return;
      view.traceHistory={digest,events:trace.events.map((event,eventIndex)=>({eventIndex,kind:event.kind,entityKey:event.entityKey,logic:event.logic}))};render();
    }).catch(error=>{
      if(project!==owner||state!==view||project.trace?.traceDigest!==digest)return;
      view.traceHistoryError={digest,message:error.message};render();
    }).finally(()=>{view.traceHistoryPending=null;});
}
async function performStudioTool(name) {
  if(name==='clear-query'){state.canvas=null;state.queryResult=null;await refreshArchitecture();return true;}
  if(name==='toggle-code'){state.showCode=!state.showCode;render();return true;}
  if(name==='import-trace'){$('#trace-import').click();return true;}
  if(name==='trace-format'){
    download('trace-header.json',pretty({kind:'product-studio-trace',version:1,modelDigest:project.modelDigest,
      provenance:'synthetic',events:[]}));return true;
  }
  if(name==='export-trace'){const loaded=await api('trace-export',{...requestContext(),traceDigest:project.trace.traceDigest});const {traceDigest,notice,incompleteCausality,complete,...trace}=loaded;download('recorded-trace.json',pretty(trace));return true;}
  if(name.startsWith('trace-') && project.trace){
    const last=project.trace.eventCount-1,at=state.traceCursor ?? last;
    if(name==='trace-page-next'||name==='trace-page-prev'){state.traceOffset=Math.max(0,(state.traceOffset??0)+(name==='trace-page-next'?200:-200));await loadTraceFrame(at);return true;}
    if(name==='trace-filter'){state.traceOffset=0;state.traceSearch=$('#trace-search').value;state.traceOperation=$('#trace-operation').value;await loadTraceFrame(at);}
    else if(['trace-first','trace-last','trace-back','trace-next'].includes(name))await loadTraceFrame(name==='trace-first'?Math.min(0,last):name==='trace-last'?last:Math.max(Math.min(0,last),Math.min(last,at+(name==='trace-next'?1:-1))));
    else return false;return true;
  }
  if(name==='save-scenario'){
    const scenario=JSON.parse(state.scenarioText),receipt=await api('save-scenario',{...requestContext(),title:scenario.id ?? 'Scenario',scenario});state.scenarioDirty=false;toast(receipt.message);return true;
  }
  if(name==='open-scenarios'){
    const rows=await api('scenarios'),d=$('#dialog');
    d.innerHTML=`<h2>Saved scenarios</h2><p class="subtitle">Only scenarios matching the selected model and declaration can be loaded.</p><div class="compact-list">${rows.map(r=>`<button data-scenario-id="${escape(r.id)}" ${r.modelDigest!==project.modelDigest || r.facetId!==state.facetId?'disabled':''}>${escape(r.title)}<p>${escape(r.facetId)}</p></button>`).join('') || '<p>No saved scenarios.</p>'}</div><button id="close-dialog">Close</button>`;
    d.showModal();$('#close-dialog').onclick=()=>d.close();
    document.querySelectorAll('[data-scenario-id]').forEach(b=>b.onclick=async()=>{const ticket=generation;try{const r=await api('open-scenario',{...requestContext(),id:b.dataset.scenarioId});if(ticket!==generation)return;state.scenarioText=pretty(r.scenario);state.scenarioDirty=false;state.scenarioResult=null;d.close();render();}catch(error){toast(error.message);}});return true;
  }
  if(name==='split-region'){splitRegionDialog();return true;}
  return false;
}
function splitRegionDialog() {
  const f=facet(),cell=selectedCell();if(f?.kind!=='decision-table'||!cell)return toast('Select an editable table cell first.');
  const d=$('#dialog');d.innerHTML=`<form id="split-form"><h2>Split a region, preserve decisions</h2><p class="muted">Separate selected values on one axis into a new named cell. Both cells initially retain the exact output.</p><label>Axis<select id="split-axis">${options(Object.keys(f.compiled.axes),Object.keys(f.compiled.axes)[0])}</select></label><label>New cell ID<input id="split-id" value="${escape(cell.id)}-split" required></label><label>Values for the new cell (JSON array)<textarea id="split-values">${escape(pretty([f.compiled.axes[Object.keys(f.compiled.axes)[0]][0]]))}</textarea></label><div class="toolbar"><button type="submit" class="primary">Review split</button><button type="button" id="cancel-dialog">Cancel</button></div></form>`;d.showModal();$('#cancel-dialog').onclick=()=>d.close();
  $('#split-form').onsubmit=async e=>{e.preventDefault();const ticket=generation;try{
    if(state.text!==null&&state.text!==source().text)return toast('Explore the current candidate before adding another visual command.');
    const r=await api('propose',{...requestContext(),command:'table.splitRegion',cellId:cell.id,axis:$('#split-axis').value,newCellId:$('#split-id').value,values:JSON.parse($('#split-values').value)});
    if(ticket!==generation)return;state.undo.push(state.text??source().text);state.text=r.text;state.draft=r;state.dirty=true;state.view='Changes';d.close();render();
  }catch(error){toast(error.message);}};
}
$('#trace-import').onchange=async e=>{const file=e.target.files[0];if(!file)return;const ticket=++generation;try{
  if(file.size>8000000)throw new Error('Trace exceeds the 8 MB import limit.');
  const p=await api('trace',{...requestContext(),text:await file.text(),fileName:file.name});if(ticket!==generation)return;
  project=p;installDocumentState(state,p);state.traceOffset=0;state.view='Trace';state.traceFrame=null;await loadTraceFrame(p.trace.eventCount-1);
}catch(error){if(ticket===generation)toast(error.message);}finally{e.target.value='';}};


async function ensureSource() {
  const p=project, s=source(); if(!s || s.text !== undefined)return s;
  const key=p.bundleDigest+':'+s.path;
  if(sourcePending.has(key))return sourcePending.get(key);
  const task=api('source',{project:p.key,bundleDigest:p.bundleDigest,file:s.path,sourceDigest:s.digest}).then(value=>{
    if(project.bundleDigest===p.bundleDigest){s.text=value.text;state.sourceLoadError=null;render();
      if(state.sourceLine&&state.sourcePath===s.path){const lines=s.text.split('\n'),at=lines.slice(0,state.sourceLine-1).join('\n').length;const editor=$('#source-editor');editor?.setSelectionRange(at,at);if(editor)editor.scrollTop=Math.max(0,state.sourceLine-3)*20;state.sourceLine=null;}}
    return value;
  }).finally(()=>sourcePending.delete(key));
  sourcePending.set(key,task);return task;
}
async function reloadProject(automatic=false) {
  if(hasDrafts(state)){toast('Your source/scenario draft is retained. Export or open it as a candidate before replacing the loaded build.');return;}
  const owner=state,old=project,ticket=++generation;
  const p=await api('reload',{project:old.key,bundleDigest:old.bundleDigest,automatic,summary:true});
  if(ticket!==generation||state!==owner)return;
  if(hasDrafts(owner)){owner.pendingBuild='A build arrived while you were editing. Your draft is retained; open a candidate before loading it.';render();return;}
  const selected=owner.selected,facetId=owner.facetId,view=owner.view,file=owner.sourcePath;
  owner.documents.clear();owner.perFacet.clear();owner.traceFrame=null;owner.canvas=null;owner.queryResult=null;owner.comparison=null;
  project=p;installDocumentState(owner,p);owner.facetId=null;
  selectFacet(p.facets.some(f=>f.id===facetId)?facetId:p.facets[0]?.id??null,false);
  owner.view=view;owner.selected=selected?.kind==='entity'&&!p.architecture.entities.some(e=>e.key===selected.id)?null:selected;
  if(file&&p.sources.some(s=>s.path===file))owner.sourcePath=file;
  owner.pendingBuild=null;owner.sourceLoadError=null;owner.scenarioResult=null;owner.result=null;owner.mode='Declared';render();
  toast('New build loaded. Selection was retained where its identity still exists; previous build is available in Compare.');
}
async function focusNeighborhood(){
  const from=state.selected?.kind==='entity'?state.selected.id:state.queryFrom??$('#query-from')?.value;
  if(!from)return toast('Select an owner or port first.');
  const identity=requestContext(),ticket=++generation,purposes=state.includeContext?['data','demand','context']:['data'];
  const [up,down]=await Promise.all(['upstream','downstream'].map(kind=>api('query',{...identity,query:{kind,from,purposes,maxDepth:2}})));
  if(ticket!==generation)return;
  const keys=new Set([...up.result.keys,...down.result.keys]),edges=new Set([...up.result.edgeIds,...down.result.edgeIds]);
  state.canvas={nodes:[...new Map([...up.canvas.nodes,...down.canvas.nodes].map(n=>[n.id,n])).values()],edges:[...new Map([...up.canvas.edges,...down.canvas.edges].map(e=>[e.id,e])).values()],shownOwners:keys.size};
  state.queryResult={keys:[...keys],edgeIds:[...edges],supported:true,message:'Two declared dependency levels in each direction. Internal algorithm causality is not inferred.'};
  state.selected={kind:'entity',id:from};state.focusKey=from;state.view='System';render();graph?.arrange();
}
$('#file-import').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error('File exceeds the 8 MB import limit.');
    const text = await file.text();
    const p = await api(/\.(ts|mjs|js)$/i.test(file.name) ? 'import-source' : 'import', { text, file: file.name, label: file.name });
    projects = await api('projects'); await loadProject(p.key);
  } catch (err) { toast(err.message); } finally { e.target.value = ''; }
};
$('#snapshot-import').onchange = async e => {
  const file = e.target.files[0]; if (!file) return; const ticket = generation;
  try { if (file.size > 8_000_000) throw new Error('Snapshot is too large.'); const p = await api('snapshot', { project: project.key, text: await file.text() }); if (ticket === generation) { project = p; installDocumentState(state,p); const details=await api('interface',requestContext()); project.evidence=details.evidence; state.mode = 'Recorded snapshot'; render(); } }
  catch (err) { toast(err.message); } finally { e.target.value = ''; }
};
window.addEventListener('beforeunload', e => { if ([...sessions.values()].some(s => s.scenarioDirty || s.mockDirty || [...(s.perFacet?.entries() ?? [])].some(([id,f])=>id!==s.facetId && f.scenarioDirty) || [...(s.documents?.values() ?? [])].some(d => d.dirty))) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && $('#source-editor')) { e.preventDefault(); perform('validate'); return; } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#search')?.focus(); $('.explorer')?.classList.add('open'); } });
experience=createExperience({getProject:()=>project,getState:()=>state,getProjects:()=>projects,
  api,render,loadProject,selectFacet,loadTraceFrame,perform,toast,escape,showInfo,
  reload:reloadProject,focus:focusNeighborhood,arrange:()=>graph?.arrange(),isBusy:()=>busy});
try {
  const bootstrap = await fetch('/api/bootstrap').then(r => r.json()); token = bootstrap.token; projects = bootstrap.projects;
  if (!projects.length) throw new Error('No fixture or configured workspace is available.');
  const link = new URLSearchParams(location.hash.slice(1));
  const wanted = projects.find(p => p.key === link.get('project'));
  await loadProject(wanted?.key ?? projects[0].key);
  await experience.restoreInitial();
  if (link.has('entity') && project.architecture.entities.some(e=>e.key===link.get('entity'))) { state.view='System';state.selected={kind:'entity',id:link.get('entity')};render(); }
} catch (e) { $('#app').innerHTML = `<main class="loading"><h1>Product Studio could not start</h1><pre>${escape(e.message)}</pre><p>Check the local terminal and installed package versions.</p></main>`; }
