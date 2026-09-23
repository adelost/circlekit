/** Presentation only: intent, compiled facts and reported results retain separate labels. */
function sourceButton(file, line, project, E, label='Open source') {
  const available=project.sources.some(s=>s.path===file);
  return `<button data-doc-file="${E(file??'')}" data-doc-line="${Number.isSafeInteger(line)?line:1}" ${available?'':'disabled'}>${E(label)}</button>`;
}
function contractBody(record, project, E) {
  if(!record)return '<p class="notice">No type-owned WHAT/WHY in this source scope. Inspect the exact owning package; no replacement was guessed.</p>';
  const c=record.contract;
  const validation={ 'local-amux':'Checked by the selected AMUX evaluator', 'producer-reported':'Validation reported by the exporter', 'presence-only':'Presence checked; wording not evaluated' }[record.validation]??'Validation unavailable';
  return `<div class="contract-intent"><dl class="properties"><dt>WHAT</dt><dd>${E(c.what??'Missing responsibility.')}</dd><dt>WHY</dt><dd>${E(c.why??'Missing boundary or failure mode.')}</dd></dl>
    <p><span class="badge">${E(c.status)}</span> ${E(validation)}</p>
    <p class="muted">${E(record.correlation)}${record.correlation==='matched-source'?' · Exact exported source identity.':' · Source intent is not proven to describe this loaded model.'}</p>
    ${sourceButton(record.source.file,record.source.line,project,E)} <small>${E(record.source.file)}:${record.source.line}</small></div>`;
}
function reportedTest(row,project,E) {
  const {report,test}=row;
  if(!test)return `<tr><td>Info</td><td>${E(report.status==='unavailable'?'Report not produced':report.status==='invalid'?'Invalid report':'No collected tests')}</td><td><code>${E(report.file)}</code></td></tr>`;
  const rawScope=test.proofKind??test.level;
  const scope=['unspecified','unavailable'].includes(String(rawScope).toLowerCase())?null:rawScope;
  const correlation=report.modelCorrelation??report.correlation;
  const framework=report.run?.framework;
  const scenarios=(test.scenarios??[]).map(s=>`<dl class="properties">${['given','when','then'].filter(k=>s.phases[k]).map(k=>`<dt>${k.toUpperCase()}</dt><dd>${E(s.phases[k])}</dd>`).join('')}</dl>`).join('');
  const associations=test.associations?.length?`<p>Associations, not coverage: ${test.associations.map(a=>`<code>${E(a.entityKey)}</code> <small>${E(a.kind??'unknown')}</small>`).join(', ')}</p>`:'';
  return `<tr data-key="${E(report.reportDigest+':'+test.id)}"><td><span class="badge">${E(test.status)}</span></td>
    <td><strong>${E(test.name)}</strong>${framework||scope?`<small>${[framework,scope].filter(Boolean).map(E).join(' · ')}</small>`:''}${test.flaky?' <small>Flaky after retry</small>':''}
      ${scenarios||associations?`<details><summary>Details</summary>${scenarios}${associations}</details>`:''}</td>
    <td>${test.file?`<small title="${E(test.file)}">${E(test.file.split('/').at(-1))}${test.line?':'+test.line:''}</small>${project.sources.some(source=>source.path===test.file)?sourceButton(test.file,test.line,project,E,'Open'):''}`:''}
      ${correlation&&correlation!=='unavailable'?`<small>${E(correlation)}</small>`:''}</td></tr>`;
}
export function documentationView(project,state,E) {
  const section=state.documentationSection??'contracts',offset=state.documentationOffset??0;
  const ticket=`${project.bundleDigest}:${section}:${offset}`;
  const page=state.documentationPage?.ticket===ticket?state.documentationPage.value:null;
  const error=state.documentationError?.ticket===ticket?state.documentationError.message:null;
  const scope=page?.scope??project.documentation?.scope;
  return `<section class="panel"><header class="panel-head"><h2>Intent & behavior</h2></header><div class="panel-body">
    <p class="muted">${section==='reports'?'Owner-run results. Source references are not coverage; traces are separate.':'WHAT/WHY, declared structure and test reports remain separate.'}</p>
    <div class="toolbar">${[['contracts','WHAT / WHY'],['legacy','Legacy reason'],['reports','Behavior reports']].map(([id,label])=>`<button data-doc-section="${id}" aria-pressed="${section===id}">${label}</button>`).join('')}</div>
    ${scope&&section!=='reports'?`<p class="muted">${scope.services} local service declarations in ${scope.files} source files · ${scope.complete?'Static discovery complete for this scope':'Incomplete discovery; see Problems'}</p><details><summary>Selected source roots</summary><pre>${E((scope.sourceRoots??[]).join('\n'))}</pre></details>`:''}
    ${error?`<p class="notice">${E(error)} <button data-doc-retry>Retry</button></p>`:!page?'<p role="status">Loading selected documentation page…</p>':
      `<p role="status">${page.total} ${section==='reports'?'reported test rows':'records'} · showing ${page.rows.length} from offset ${page.offset}</p>
      ${section==='reports'?`<div class="table-wrap"><table class="reports-table"><thead><tr><th>Status</th><th>Test</th><th>Source</th></tr></thead><tbody>${page.rows.map(row=>reportedTest(row,project,E)).join('')}</tbody></table></div>`:
        page.rows.map(row=>section==='contracts'?`<article class="panel" data-key="${E(row.entityKey)}"><div class="panel-body"><h3>${E(row.id)}</h3>${contractBody(row,project,E)}</div></article>`:`<article class="panel"><div class="panel-body"><h3>${E(row.id)}</h3><div class="section-label">Legacy reason</div><p>${E(row.reason)}</p><p class="muted">Preserved legacy declaration. No automatic relation to a ProductSpec service is inferred.</p>${sourceButton(row.source.file,row.source.line,project,E)}</div></article>`).join('')||`<p>${section==='legacy'?'No literal legacy reason declarations in the selected sources.':'No contracts in this source scope. External service types are listed in Problems.'}</p>`}
      <div class="toolbar"><button data-doc-offset="${Math.max(0,offset-50)}" ${offset===0?'disabled':''}>Previous 50</button><button data-doc-offset="${page.nextOffset??offset}" ${page.nextOffset===null?'disabled':''}>Next 50</button></div>`}
    </div></section>`;
}
/** WHAT: Builds the selected entity's intent and evidence panel. WHY: Keeps declared associations separate from proof of runtime coverage. */
export function intentPanel(intent,project,E) {
  if(!intent)return '';
  const d=intent.declared;
  const ports=(items)=>items.map(p=>`<li><code>${E(p.id)}</code> · ${E(p.contract?.id??p.contract??'Unknown contract')} · ${E(p.purpose??'data')}</li>`).join('')||'<li>None declared.</li>';
  return `<section aria-label="Type intent"><div class="section-label">Type-owned intent</div><code>${E(intent.typeKey)}</code>${contractBody(intent.contract,project,E)}
    ${d?`<details><summary>Declared reality</summary><dl class="properties">${Object.entries(d.runtime??{}).map(([key,value])=>`<dt>${E(key)}</dt><dd>${E(Array.isArray(value)?value.join(', '):value)}</dd>`).join('')}</dl><h3>Consumes</h3><ul>${ports(d.inputs)}</ul><h3>Publishes</h3><ul>${ports(d.outputs)}</ul><h3>Used by</h3><ul>${d.consumers.map(c=>`<li>${E(c.id)}</li>`).join('')||'<li>No outgoing consumer binding in this model.</li>'}</ul></details>`:''}
    <div class="section-label">Behavior reports</div>${intent.tests.length?intent.tests.map(t=>`<p>${[t.proofKind??t.level,t.status,t.correlation==='unavailable'?null:t.correlation].filter(Boolean).map(E).join(' · ')}<br>${E(t.name)} ${t.file?sourceButton(t.file,t.line,project,E,'Open test'):''}${t.association?`<br><small>Association: ${E(t.association)} (not coverage)</small>`:''}</p>`).join(''):'<p>No test-body source associations available for this entity.</p>'}
    <p class="muted">${E(intent.notice)}</p>${intent.testTotal>intent.tests.length?`<p>${intent.testTotal} associated rows total; first ${intent.tests.length} shown.</p>`:''}<button data-exp="intent" data-doc-reports>Browse all reports</button>
    <div class="section-label">Observed reality</div><p>Recorded traces are inspected in Trace. No runtime pass is inferred from these test reports.</p></section>`;
}
