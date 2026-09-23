import { intentPanel } from './documentation.js';
function traceTime(ms,domain) {
  if(domain==='wall')return new Date(ms).toISOString().slice(11,19)+' UTC';
  if(ms<1000)return ms+' ms';
  const seconds=Math.floor(ms/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);
  return (hours?hours+':'+String(minutes%60).padStart(2,'0'):minutes)+':'+String(seconds%60).padStart(2,'0');
}
/** Presentation only. All graph queries, trace checks and source validation remain server-side. */
export function architectureControls(project, state, escape) {
  const options = project.architecture.entities.filter(e => ['node','component','port','facet'].includes(e.kind));
  const optionHtml = options.map(e => `<option value="${escape(e.key)}">${escape(e.kind)} · ${escape(e.id)}</option>`).join('');
  const groups = project.architecture.groups.map(g => `<option value="${escape(g.id)}" ${state.architectureGroup === g.id ? 'selected' : ''}>${escape(g.label)}</option>`).join('');
  return `<section class="panel"><header class="panel-head"><h2>Architecture questions</h2><span class="badge">Declared dependencies</span></header>
    <div class="panel-body"><div class="fact-grid">
      <label>From / selected entity<select id="query-from">${optionHtml}</select></label>
      <label>To (for shortest path)<select id="query-to">${optionHtml}</select></label>
      <label>Grouping<select id="architecture-mode"><option value="owners" ${state.architectureMode !== 'domains' ? 'selected' : ''}>Owners & ports</option><option value="domains" ${state.architectureMode === 'domains' ? 'selected' : ''}>Declared groups</option></select></label>
      <label>Group scope<select id="architecture-group"><option value="">All owners</option><option value="__ungrouped" ${state.architectureGroup === '__ungrouped' ? 'selected' : ''}>Ungrouped</option>${groups}</select></label>
    </div><div class="toolbar query-actions">${['upstream','downstream','path','consumers','owner','impact'].map(kind=>`<button data-query="${kind}">${{upstream:'What feeds this?',downstream:'What uses this?',path:'Find path',owner:'Who owns this?',impact:'What could change?'}[kind] ?? kind[0].toUpperCase()+kind.slice(1)}</button>`).join('')}
      <button data-action="clear-query" class="subtle">Clear focus</button><label class="inline-check"><input id="query-context" type="checkbox" ${state.includeContext ? 'checked' : ''}> Include demand/context</label>
    </div>${state.queryResult ? `<div class="notice ${state.queryResult.supported && state.queryResult.found !== false ? 'info' : ''}">${escape(state.queryResult.message)}<p>${state.queryResult.keys.length} selected entities · ${state.queryResult.edgeIds.length} binding edges</p>${state.queryResult.affectedMounts?.length ? `<p>${state.queryResult.affectedMounts.length} potentially affected mounts: ${escape([...new Set(state.queryResult.affectedMounts.map(m=>m.artifactRef))].join(', '))}</p>` : ''}</div>` : ''}</div></section>`;
}

export function sourceNavigator(project, state, escape) {
  const sources=project.sources;
  return `<div class="source-navigation"><label>Source file<select id="source-file">${sources.map(s=>`<option value="${escape(s.path)}" ${s.path === state.sourcePath ? 'selected' : ''}>${escape(s.path)}</option>`).join('')}</select></label>
    <span class="muted mono" id="source-position">${state.sourceSpan ? `Source span ${state.sourceSpan.start}–${state.sourceSpan.end}` : 'Ctrl+Enter validates this draft'}</span></div>`;
}

function entityLabel(project,key) {
  const entity=project.architecture.entities.find(item=>item.key===key);
  if(entity?.kind==='cell'&&entity.parent)return entity.id+' · '+entity.parent.split('/').at(-1);
  if(entity)return entity.label??entity.id;
  try{return decodeURIComponent(key);}catch{return key;}
}

export function entityInspector(project, selection, escape) {
  const e=project.architecture.entities.find(e=>e.key===selection.id); if(!e) return null;
  const origin=project.sourceIndex.origins.find(o=>o.entityKey===e.key), unresolved=project.sourceIndex.unresolved.find(o=>o.entityKey===e.key);
  const touching=project.architecture.edges.filter(edge=>edge.from===e.key || edge.to===e.key);
  return `<div class="section-label">${escape(e.kind)}</div><h2>${escape(e.id)}</h2><details class="exact-key"><summary>Exact key</summary><code>${escape(e.key)}</code></details>
    <div class="toolbar inspector-actions"><button data-source-entity="${escape(e.key)}" ${!origin ? 'disabled' : ''}>Open source</button><button data-query-entity="${escape(e.key)}">Potential impact</button></div>
    ${origin ? `<div class="notice info">${escape(origin.file)}<p>${escape(origin.provenance)} · ${escape(origin.editing)}</p></div>` : `<div class="notice">${escape(unresolved?.reason ?? 'Source mapping unavailable.')}</div>`}
    ${['node','component'].includes(e.kind)?intentPanel(e.intent,project,escape):''}
    <details><summary>Declared properties</summary><pre>${e.data ? escape(JSON.stringify(e.data,null,2)) : 'Loading selected entity details…'}</pre></details>
    <div class="section-label">Direct declared relations</div><div class="compact-list">${touching.slice(0,40).map(edge=>`<button data-entity="${escape(edge.from === e.key ? edge.to : edge.from)}"><small>${escape(edge.kind)} · ${escape(edge.evidence ?? 'compiler')}</small><p>${escape(entityLabel(project,edge.from === e.key ? edge.to : edge.from))}</p></button>`).join('') || '<small>No explicit relations exported.</small>'}</div>`;
}

function traceStateBand(trace,cursor,E) {
  const path=trace.statePath??[];
  if(!path.length)return '';
  let active=0;
  for(const [index,item] of path.entries())if((index===0?-1:item.eventIndex)<=cursor)active=index;
  const nodes=path.map((item,index)=>
    '<button data-trace-sequence="'+item.sequence+'" data-trace-index="'+(index===0?-1:item.eventIndex)+'"'+(index===active?' aria-current="step"':'')+'>'+E(item.state)+'</button>'
    +(index<path.length-1?'<span aria-hidden="true">→</span>':'')).join('');
  return '<div class="trace-state-band"><span class="section-label">State path</span><div class="trace-state-path">'+nodes+'</div>'
    +(trace.statePathTruncated?'<small>First 128 state changes shown.</small>':'')+'</div>';
}

function traceLogicCard(frame,E) {
  const comparison=frame?.logicCheck;
  if(!comparison)return '';
  const observed=frame.current?.logic??{}, predicted=comparison.result??{};
  const status={consistent:'Consistent',different:'Different',unknown:'Needs facts',unavailable:'Unavailable'}[comparison.kind]??'Unknown';
  const step=observed.from&&observed.to
    ?E(observed.from)+' <span aria-hidden="true">→</span> '+E(observed.to)
    :E(observed.cellId??observed.facetId??'Decision');
  const via=observed.cellId?' via '+E(observed.cellId):observed.input?' via '+E(observed.input):'';
  const guards=Object.entries(observed.guards??observed.facts??{}).map(([name,value])=>
    '<span class="trace-guard '+(value===true?'true':value===false?'false':'unknown')+'">'+E(name)+' '+E(String(value))+'</span>').join('');
  const model=comparison.kind==='different'
    ?'<p>Model: '+E(predicted.from??observed.from??'')+' → '+E(predicted.to??'unknown')
      +(predicted.cellId?' via '+E(predicted.cellId):'')+'</p>':'';
  return '<section class="trace-comparison '+E(comparison.kind)+'"><div class="trace-comparison-head"><strong>'
    +status+'</strong><span>'+step+via+'</span></div>'+model
    +(guards?'<div class="trace-guards">'+guards+'</div>':'')
    +'<details><summary>Comparison details</summary><p>'+E(comparison.message??'')+'</p><pre>'
    +E(JSON.stringify(predicted,null,2))+'</pre></details></section>';
}

export function traceView(project, state, escape) {
  const trace=project.trace;
  if(!trace) return `<section class="panel"><header class="panel-head"><h2>Recorded trace</h2><button data-action="import-trace">Import trace</button></header><div class="panel-body"><div class="notice info">Import ordered events from a product-owned recorder. Count-only snapshots cannot be played as event history.</div><p class="muted">Producer identity for this selection:</p><pre>${escape(JSON.stringify({productId:project.productId,modelDigest:project.modelDigest},null,2))}</pre><button data-action="trace-format">Export recorder example</button><p class="muted">The example records nothing automatically. Connect actual runtime hooks through their existing owner.</p></div></section>`;
  const frame=state.traceFrame, cursor=state.traceCursor ?? trace.eventCount-1, max=Math.max(0,trace.eventCount-1);
  const rows=frame?.events ?? [];
  return `<section class="panel"><header class="panel-head"><h2>${trace.provenance === 'synthetic' ? 'Synthetic trace' : trace.provenance === 'test-run' ? 'Test run trace' : 'Recorded trace'} <code>${escape(trace.sessionId)}</code></h2><div class="toolbar"><button data-action="import-trace">Import another</button><button data-action="export-trace">Export trace</button></div></header>
    <div class="panel-body"><div class="notice ${trace.complete ? 'info' : ''}">${escape(trace.notice)}<p>${trace.eventCount} retained events · ${trace.truncation.droppedBefore} dropped before capture${trace.truncation.gaps.length ? ` · ${trace.truncation.gaps.length} recorded gaps` : ''}</p></div>
      ${traceStateBand(trace,cursor,escape)}
      <div class="toolbar"><button data-action="trace-first">⏮ First</button><button data-action="trace-back">◁ Back</button><button data-action="trace-next">Next ▷</button><button data-action="trace-last">Last ⏭</button><label>Frame <input id="trace-cursor" type="range" min="0" max="${max}" value="${Math.max(0,cursor)}" ${trace.eventCount ? '' : 'disabled'}></label><code>${cursor+1} / ${trace.eventCount}</code><span class="badge">${escape(trace.clock.domain)} ms</span></div>
      <div class="fact-grid"><label>Filter recorded text<input id="trace-search" value="${escape(state.traceSearch ?? '')}" placeholder="Entity, cell or summary"></label><label>Operation ID<input id="trace-operation" value="${escape(state.traceOperation ?? '')}" placeholder="Exact operation ID"></label><button data-action="trace-filter">Filter</button></div>
      ${frame?.current ? `<div class="notice info"><strong>#${frame.current.sequence} · ${escape(frame.current.kind)} · ${traceTime(frame.current.atMs,trace.clock.domain)}</strong><p>${escape(frame.current.summary ?? '')}</p><button data-entity="${escape(frame.current.entityKey)}">Inspect ${escape(entityLabel(project,frame.current.entityKey))}</button></div>` : ''}
      ${traceLogicCard(frame,escape)}
      <details ${frame?.causalPath.length > 1 ? 'open' : ''}><summary>Explicit causal path</summary><p class="muted">Only producer-supplied causedBy links. No causality is inferred from timestamps.</p><div class="pill-row">${(frame?.causalPath ?? []).map(e=>`<button data-trace-sequence="${e.sequence}" data-trace-index="${e.eventIndex ?? -1}">#${e.sequence} ${escape(e.kind)}</button>`).join(' → ')}</div>${frame?.missingParent ? `<div class="notice">Recorded ancestor #${escape(frame.missingParentSequence)} is outside the retained capture. The explicit chain is incomplete.</div>` : ''}</details>
    </div><div class="toolbar panel-body"><button data-action="trace-page-prev">Previous 200</button><span>Offset ${state.traceOffset??0}</span><button data-action="trace-page-next" ${frame?.nextOffset===null?'disabled':''}>Next 200</button></div><div class="trace-lanes" aria-label="Recorded event lanes">${[...new Set(rows.map(e=>e.entityKey))].slice(0,12).map(key=>`<div class="trace-lane"><code>${escape(entityLabel(project,key))}</code><div>${rows.filter(e=>e.entityKey===key).slice(0,30).map(e=>`<button data-trace-sequence="${e.sequence}" data-trace-index="${e.eventIndex}" title="#${e.sequence}: ${escape(e.kind)} at ${traceTime(e.atMs,trace.clock.domain)}">${escape(e.kind.slice(0,1).toUpperCase())}</button>`).join('')}</div></div>`).join('')}<small>Sequence lanes for the current page, not proportional time or inferred causality.</small></div><div class="table-wrap"><table><thead><tr><th>Sequence</th><th>Time</th><th>Kind</th><th>Entity</th><th>Summary</th></tr></thead><tbody>${rows.map(e=>`<tr tabindex="0" data-trace-sequence="${e.sequence}" data-trace-index="${e.eventIndex ?? -1}" class="${e.sequence === frame?.current?.sequence ? 'selected' : ''}"><td>${e.sequence}</td><td>${traceTime(e.atMs,trace.clock.domain)}</td><td>${escape(e.kind)}</td><td>${escape(entityLabel(project,e.entityKey))}</td><td>${escape(e.summary ?? '')}</td></tr>`).join('')}</tbody></table></div><div class="risk-caption">Showing ${rows.length} of ${frame?.total ?? trace.eventCount} matching events. Use filters for a focused slice. Playback changes observation time only, never a live process.</div></section>`;
}

export function installDocumentState(state, project) {
  state.documents ??= new Map(); state.loadedSources = project.sources;
  for (const [file,d] of state.documents) {
    const current=project.sources.find(s=>s.path===file);
    if(current && d.baseDigest!==current.digest && d.text===null && !d.dirty) {
      d.baseDigest=current.digest;d.draft=null;d.undo=[];d.redo=[];
    }
  }
  const ensure = () => {
    const file=state.sourcePath ?? state.loadedSources[0]?.path ?? '__none';
    if(!state.documents.has(file)) {
      const src=state.loadedSources.find(s=>s.path===file);
      state.documents.set(file,{text:null,draft:null,undo:[],redo:[],dirty:false,baseDigest:src?.digest ?? null});
    }
    return state.documents.get(file);
  };
  if(!state.documentPropertiesInstalled) {
    for(const field of ['text','draft','undo','redo','dirty']) {
      delete state[field];Object.defineProperty(state,field,{enumerable:true,configurable:false,get:()=>ensure()[field],set:value=>{ensure()[field]=value;}});
    }
    state.documentPropertiesInstalled=true;
  }
  state.document = ensure;
}
