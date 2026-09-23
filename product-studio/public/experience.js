import { documentationView } from './documentation.js';
/** Navigation, local preferences and passive refresh. No DSL or execution authority. */
const views = new Set(['System','Logic','Scenarios','Interface','Changes','Trace','Problems','Compare','Welcome','Intent']);
const text = v => typeof v === 'string' && v.length <= 2000;
const issueRows = project => (project.problems??project.diagnostics).map((issue,index)=>({issue,index}));
const isProblem = row => ['error','warning'].includes(row.issue.severity??'error');
function issueCard({issue,index},project,E) {
  const file=issue.file??issue.sourceFile;
  return '<div class="problem '+E(issue.severity??'error')+'"><strong>'+E(issue.rule)+'</strong> <span>'
    +E(issue.severity??'error')+'</span><p>'+E(issue.message)+'</p><button data-problem="'+index+'"'
    +(!project.sources.some(source=>source.path===file)?' disabled':'')+'>Open source'
    +(issue.line?' · line '+issue.line:'')+'</button></div>';
}
export function parseRoute(hash) {
  try {
    const params = new URLSearchParams(hash.replace(/^#/,'')), raw = params.get('view');
    if (!raw || raw.length > 12000) return null;
    const r = JSON.parse(raw);
    if (r.version !== 1 || !text(r.project) || !views.has(r.view) || !/^[a-f0-9]{64}$/.test(r.model)) return null;
    return {version:1,project:r.project,model:r.model,view:r.view,
      facet:text(r.facet)?r.facet:null, entity:text(r.entity)?r.entity:null,
      file:text(r.file)?r.file:null, traceDigest:/^[a-f0-9]{64}$/.test(r.traceDigest??'')?r.traceDigest:null,
      cursor:Number.isInteger(r.cursor)&&r.cursor>=-1&&r.cursor<20000?r.cursor:null};
  } catch { return null; }
}
export function hasDrafts(state) {
  return [...(state.documents?.entries() ?? [])].some(([file,d]) => d.dirty || (d.text !== null && d.text !== state.loadedSources?.find(s=>s.path===file)?.text))
    || state.scenarioDirty === true || state.mockDirty === true
    || [...(state.perFacet?.entries() ?? [])].some(([id, facet]) => id !== state.facetId && facet.scenarioDirty === true);
}
function savedBookmarks() {
  try {const v=JSON.parse(localStorage.getItem('studio-bookmarks-v1')||'{}');
    return v.version===1&&Array.isArray(v.items)?v.items.filter(i=>text(i.title)&&parseRoute('#view='+encodeURIComponent(JSON.stringify(i.route)))).slice(0,30):[];
  }catch{return [];}
}
function saveBookmarks(items) {try{localStorage.setItem('studio-bookmarks-v1',JSON.stringify({version:1,items:items.slice(-30)}));return true;}catch{return false;}}

export function createExperience(env) {
  const {getProject:P,getState:S,api,render,toast,escape:E}=env;
  const initialRoute=parseRoute(location.hash);
  let navigating=!!initialRoute,lastRoute='',timer=null,stopped=false,paletteTicket=0,navigationTicket=0;
  const pending=new Map();
  const ctx=()=>({project:P().key,bundleDigest:P().bundleDigest});
  const route=()=>({version:1,project:P().key,model:P().modelDigest,view:S().view,facet:S().facetId,
    entity:S().selected?.kind==='entity'?S().selected.id:null,file:S().sourcePath??null,
    traceDigest:S().view==='Trace'?P().trace?.traceDigest??null:null,cursor:S().view==='Trace'?S().traceCursor??null:null});
  function record() {
    if(navigating||!P())return;const next=JSON.stringify(route());if(next===lastRoute)return;
    const url='#view='+encodeURIComponent(next);
    if(!lastRoute)history.replaceState(null,'',url);else history.pushState(null,'',url);
    lastRoute=next;
  }
  async function restore(r) {
    if(!r)return; const ticket=++navigationTicket; navigating=true;
    try {
      if(P()?.key!==r.project)await env.loadProject(r.project);
      if(ticket!==navigationTicket || P()?.key!==r.project)return;
      const p=P(),s=S();
      if(p.modelDigest!==r.model)s.routeWarning='This link targets another model revision. Current declarations are shown; no old evidence is replayed.';
      if(r.facet&&p.facets.some(f=>f.id===r.facet))env.selectFacet(r.facet,false);
      s.view=r.view;
      if(r.entity&&p.architecture.entities.some(e=>e.key===r.entity))s.selected={kind:'entity',id:r.entity};
      else {s.selected=null;if(r.entity)s.routeWarning='The bookmarked entity is absent in this model. No replacement was guessed.';}
      if(r.file&&p.sources.some(f=>f.path===r.file))s.sourcePath=r.file;
      if(r.view==='Trace'&&r.traceDigest){
        if(p.trace?.traceDigest===r.traceDigest&&p.modelDigest===r.model)await env.loadTraceFrame(r.cursor??-1);
        else {s.traceFrame=null;s.traceCursor=-1;s.routeWarning='The exact linked trace is not loaded. Import it before viewing that event.';}
      }
      if(ticket!==navigationTicket)return;lastRoute=JSON.stringify(r);render();
    }catch(e){if(ticket===navigationTicket)toast(e.message);}finally{if(ticket===navigationTicket)navigating=false;}
  }
  function toolbar() {const p=P(),s=S(),problems=issueRows(p).filter(isProblem).length;return `<div class="experience-bar" data-key="experience">
    <div class="toolbar"><button data-exp="back" aria-label="Back">←</button><button data-exp="forward" aria-label="Forward">→</button>
    <button data-exp="palette">Commands <kbd>Ctrl ⇧ P</kbd></button><button data-exp="bookmark">☆ Save view</button><details class="view-menu" data-key="view-menu"><summary>More views</summary><div class="compact-list"><button data-exp="welcome">Overview</button><button data-exp="bookmarks">Saved views</button><button data-exp="copy-link">Copy link</button><button data-exp="compare">Compare builds</button><button data-exp="intent">Intent &amp; behavior</button></div></details></div>
    <div class="toolbar"><button data-exp="problems">Problems${problems?' ('+problems+')':''}</button>
    <label class="inline-check"><input id="watch-builds" type="checkbox" ${s.watchEnabled!==false?'checked':''}> Follow builds</label></div></div>`;}
  function notices(){const s=S();return `${s.routeWarning?`<div class="notice">${E(s.routeWarning)} <button data-exp="dismiss-route">Dismiss</button></div>`:''}
    ${s.watchError?`<div class="notice">Build check failed: ${E(s.watchError)}</div>`:''}
    ${s.pendingBuild?`<div class="notice" role="status">${E(s.pendingBuild)} <button data-exp="reload">Load available build</button></div>`:''}`;}
  function proof(){const s=S(),d=s.draft;return `<div class="proof-strip" role="status" aria-label="Verification scope">
    <span>Source <strong>${d?'Draft':'Unchanged'}</strong></span><span>Declaration <strong>${d?d.valid?'Accepted':'Refused':'Not evaluated'}</strong></span>
    <span>Model <strong>${d?d.diff.changes.length+' changed paths':'Loaded snapshot'}</strong></span>
    <span>Scenarios <strong>${!d && s.scenarioResult?.bundleDigest===P().bundleDigest ? s.scenarioResult.assertionStatus : 'Not evaluated'}</strong></span><span>Runtime <strong>Not evaluated</strong></span></div>`;}
  function page(view) {
    const p=P(),s=S(),rows=issueRows(p),blockers=rows.filter(isProblem),notes=rows.filter(row=>!isProblem(row));
    const noteGroups=[...new Set(notes.map(row=>row.issue.rule))].map(rule=>{
      const group=notes.filter(row=>row.issue.rule===rule);
      return '<details><summary>'+group.length+' '+E(rule)+'</summary>'+group.map(row=>issueCard(row,p,E)).join('')+'</details>';
    }).join('');
    const notesPanel=notes.length?'<details><summary>'+notes.length+' notes</summary>'+noteGroups+'</details>':'';
    if(view==='Intent')return documentationView(p,s,E);
    if(view==='Problems')return `<section class="panel"><header class="panel-head"><h2>Problems & missing evidence</h2></header><div class="panel-body">
      <p class="muted">Compiler diagnostics and source mapping gaps are different. No missing runtime delivery is inferred from a disconnected runtime.</p>
      ${blockers.length?blockers.map(row=>issueCard(row,p,E)).join(''):'<p>No errors or warnings.</p>'}
      ${notesPanel}
      <details><summary>${p.sourceIndex.unresolved.length} entities without exact source mapping</summary>${p.sourceIndex.unresolved.slice(0,100).map(d=>`<p><code>${E(d.entityKey)}</code> ${E(d.reason)}</p>`).join('')}<small>First 100 shown. Missing provenance is not a code error.</small></details></div></section>`;
    if(view==='Compare'){const c=s.comparison;return `<section class="panel"><header class="panel-head"><h2>Compare declared builds</h2><button data-exp="run-compare">Compare previous load</button></header><div class="panel-body"><p>Reload a newer build to retain one prior snapshot, or import a prior bundle through the existing importer.</p>
      <label>Compare against an already loaded product<select id="compare-before"><option value="">Previous load</option>${env.getProjects().filter(x=>x.key!==p.key).map(x=>`<option value="${E(x.key)}">${E(x.label)}</option>`).join('')}</select></label>
      ${c?`<div class="notice info">${E(c.notice)}<p>${c.counts.added} added · ${c.counts.removed} removed · ${c.counts.changed} changed${c.truncated?' · result limited':''}</p></div><div class="compact-list">${c.changes.map((v,i)=>`<details data-key="${E(v.key)}"><summary>${E(v.status)} · ${E(v.kind)} · ${E(v.key)}</summary><div class="split"><pre>${E(JSON.stringify(v.before,null,2))}</pre><pre>${E(JSON.stringify(v.after,null,2))}</pre></div></details>`).join('')}</div>`:'<p class="muted">No comparison requested. No Git checkout, generator or model call is performed.</p>'}</div></section>`;}
    return `<section class="panel"><div class="panel-body"><h2>${E(p.label)}</h2><div class="onboarding-grid">
      <button data-exp="system"><strong>${p.architecture.coverage.owners} owners</strong><span>Explore architecture</span></button>
      <button data-exp="logic"><strong>${p.facets.length} logic declarations</strong><span>Explain a decision</span></button>
      <button data-exp="palette"><strong>${p.sourceIndex.origins.length} source locations</strong><span>Find source</span></button></div>
      <details class="scope-note"><summary>Scope</summary><p>${E(p.provenance??p.validationNotice)}</p></details></div></section>`;
  }
  function bookmarks(){const d=document.querySelector('#dialog'),items=savedBookmarks();d.innerHTML=`<h2>Saved views</h2><p>Links contain identities only, not source text or trace payloads.</p><div class="compact-list">${items.map((b,i)=>`<button data-bookmark="${i}">${E(b.title)}</button>`).join('')||'<p>No saved views.</p>'}</div><button data-close>Close</button>`;d.showModal();d.querySelector('[data-close]').onclick=()=>d.close();d.querySelectorAll('[data-bookmark]').forEach(b=>b.onclick=()=>{d.close();restore(items[Number(b.dataset.bookmark)].route);});}
  function palette(){
    const d=document.querySelector('#dialog');d.innerHTML=`<h2>Go to anything</h2><label>Command, object or source<input id="command-search" autocomplete="off" autofocus placeholder="recording, source, compare…"></label><div id="command-results" class="compact-list"></div><button data-close>Close</button>`;d.showModal();d.querySelector('[data-close]').onclick=()=>{paletteTicket++;d.close();};
    const commands=[['Explore architecture','system'],['Open logic','logic'],['Open source','source'],['Review problems','problems'],['Compare builds','compare'],['Show saved views','bookmarks'],['Focus selected neighborhood','focus'],['Import trace','import-trace'],['Arrange graph','arrange']];
    const update=async()=>{const ticket=++paletteTicket, p=P(),q=d.querySelector('input').value;
      const local=commands.filter(([name])=>name.toLowerCase().includes(q.toLowerCase()));
      let found={rows:[]};try{found=await api('search',{...ctx(),text:q,max:30});}catch(e){toast(e.message);}
      if(ticket!==paletteTicket||!d.open||P().key!==p.key)return;
      d.querySelector('#command-results').innerHTML=local.map(([label,id])=>`<button data-command="${id}">${E(label)}</button>`).join('')+found.rows.map(e=>`<button data-object="${E(e.key)}"><strong>${E(e.label??e.id)}</strong><small>${E(e.kind)}${e.file?' · '+E(e.file):''}</small></button>`).join('');
      d.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{d.close();act(b.dataset.command);});
      d.querySelectorAll('[data-object]').forEach(b=>b.onclick=()=>{d.close();S().view='System';S().selected={kind:'entity',id:b.dataset.object};S().queryFrom=b.dataset.object;render();});
    };
    let debounce;d.onclose=()=>{paletteTicket++;clearTimeout(debounce);};d.querySelector('input').oninput=()=>{clearTimeout(debounce);debounce=setTimeout(update,120);};
    d.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();const buttons=[...d.querySelectorAll('#command-results button')],i=buttons.indexOf(document.activeElement);buttons[(i+1)%buttons.length]?.focus();}
      if(e.key==='Escape'){paletteTicket++;d.close();}};update();d.querySelector('input').focus();
  }
  async function act(name){
    try{const s=S(),p=P();
      if(name==='back'){history.back();return;}if(name==='forward'){history.forward();return;}
      if(name==='palette'){palette();return;}if(name==='bookmarks'){bookmarks();return;}
      if(name==='bookmark'){const items=savedBookmarks();const r=route(),title=s.selected?.id??s.facetId??s.view;
        const next=items.filter(i=>JSON.stringify(i.route)!==JSON.stringify(r));next.push({title,route:r});toast(saveBookmarks(next)?'View saved locally.':'Local storage unavailable; use Copy link.');return;}
      if(name==='copy-link'){const url=new URL(location.href);url.hash='view='+encodeURIComponent(JSON.stringify(route()));
        try{await navigator.clipboard.writeText(url.href);toast('Local view link copied. No source or trace payload is included.');}catch{env.showInfo('View link','Copy this local address.',url.href);}return;}
      if(name==='dismiss-route'){s.routeWarning=null;render();return;}
      if(['problems','compare','system','logic','source','welcome','intent'].includes(name)){s.view={problems:'Problems',compare:'Compare',system:'System',logic:'Logic',source:'Changes',welcome:'Welcome',intent:'Intent'}[name];render();return;}
      if(name==='reload'){await env.reload(false);return;}
      if(name==='run-compare'){const identity=ctx(), before=document.querySelector('#compare-before')?.value;const result=await api('compare',{...identity,beforeProject:before||undefined});if(P().bundleDigest===identity.bundleDigest){s.comparison=result;render();}return;}
      if(name==='focus'){await env.focus();return;}
      if(name==='arrange'){env.arrange();return;}
      if(name==='import-trace'){env.perform('import-trace');return;}
    }catch(e){toast(e.message);}
  }
  function fetchOnce(key,load,apply){if(pending.has(key))return;pending.set(key,load().then(apply).catch(e=>toast(e.message)).finally(()=>pending.delete(key)));}
  function afterRender(){const p=P(),s=S();record();
    document.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>{const menu=b.closest('details.view-menu');if(menu)menu.open=false;act(b.dataset.exp);});
    const watch=document.querySelector('#watch-builds');if(watch)watch.onchange=()=>{s.watchEnabled=watch.checked;};
    document.querySelectorAll('[data-problem]').forEach(b=>b.onclick=()=>{const problem=(p.problems??p.diagnostics)[Number(b.dataset.problem)],file=p.sources.find(f=>f.path===(problem.file??problem.sourceFile));if(!file)return;
      s.sourcePath=file.path;s.sourceLine=problem.line??1;s.view='Changes';render();});
    document.querySelectorAll('[data-doc-section]').forEach(b=>b.onclick=()=>{s.documentationSection=b.dataset.docSection;s.documentationOffset=0;render();});
    document.querySelectorAll('[data-doc-offset]').forEach(b=>b.onclick=()=>{s.documentationOffset=Number(b.dataset.docOffset);render();});
    document.querySelectorAll('[data-doc-retry]').forEach(b=>b.onclick=()=>{s.documentationError=null;render();});
    document.querySelectorAll('[data-doc-reports]').forEach(b=>b.onclick=()=>{s.documentationSection='reports';s.documentationOffset=0;act('intent');});
    document.querySelectorAll('[data-doc-file]').forEach(b=>b.onclick=()=>{
      const file=p.sources.find(f=>f.path===b.dataset.docFile);if(!file)return;
      s.sourcePath=file.path;s.sourceLine=Number(b.dataset.docLine)||1;s.sourceSpan=null;s.sourceLoadError=null;s.view='Changes';render();
    });
    const identity=ctx();
    if(s.view==='Intent') {
      const section=s.documentationSection??'contracts',offset=s.documentationOffset??0,ticket=`${p.bundleDigest}:${section}:${offset}`;
      if(s.documentationPage?.ticket!==ticket&&s.documentationError?.ticket!==ticket)fetchOnce(ticket,async()=>{
        try{return {value:await api('documentation',{...identity,section,offset,limit:50})};}
        catch(error){return {error:error.message};}
      },r=>{
        if(P().bundleDigest!==p.bundleDigest||(S().documentationSection??'contracts')!==section||(S().documentationOffset??0)!==offset)return;
        if(r.error)s.documentationError={ticket,message:r.error};else{s.documentationPage={ticket,value:r.value};s.documentationError=null;}render();
      });
    }
    if((s.view==='Interface'&&!p.interfaceLoaded)||(s.view==='System'&&p.evidence&&!p.evidence.snapshot))fetchOnce(p.bundleDigest+':interface',()=>api('interface',identity),r=>{if(P().bundleDigest!==p.bundleDigest)return;p.gallery=r.gallery;if(p.product)p.product.artifactScopes=r.artifactScopes;p.interfaceLoaded=true;if(r.evidence)p.evidence=r.evidence;render();});
    if(s.selected?.kind==='entity'){
      const selected=p.architecture.entities.find(e=>e.key===s.selected.id);
      if(selected&&!selected.data)fetchOnce(p.bundleDigest+':entity:'+selected.key,()=>api('entity',{...identity,entity:selected.key}),r=>{if(P().bundleDigest!==p.bundleDigest)return;Object.assign(selected,r.entity);p.architecture.edges=[...p.architecture.edges.filter(e=>!r.relations.some(r=>r.id===e.id)),...r.relations];render();});
    }
  }
  async function poll(){if(stopped)return;
    try {const p=P(),s=S();if(p&&!p.fixture&&s.watchEnabled!==false&&!document.hidden&&!env.isBusy()){
      const identity=ctx(),result=await api('changes',identity);if(P().bundleDigest!==identity.bundleDigest)return;s.watchError=null;
      if(result.changed.length||result.errors?.length){const message=result.requiresRestart?'Workspace configuration changed. Restart Studio to load its new selection.':hasDrafts(s)?'A newer source/build is available. Your draft is retained; review or export it before reloading.':result.ready?'A complete new build is available.':'Source changed; waiting for the product owner to regenerate a stable bundle.';
        if(s.pendingBuild!==message){s.pendingBuild=message;render();}
        if(result.ready&&!hasDrafts(s)&&!document.querySelector('#dialog')?.open&&!document.querySelector('#source-editor:focus'))await env.reload(true);
      }else if(s.pendingBuild){s.pendingBuild=null;render();}
    }}catch(e){if(P() && S().watchError!==e.message){S().watchError=e.message;render();}}finally{timer=setTimeout(poll,3000);}}
  const pop=()=>restore(parseRoute(location.hash));window.addEventListener('popstate',pop);
  const keys=e=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='p'){e.preventDefault();palette();}};window.addEventListener('keydown',keys);
  timer=setTimeout(poll,3000);
  return {toolbar,notices,proof,page,afterRender,restoreInitial:async()=>{if(initialRoute)await restore(initialRoute);else{navigating=false;record();}},
    dispose(){stopped=true;clearTimeout(timer);window.removeEventListener('popstate',pop);window.removeEventListener('keydown',keys);}};
}
