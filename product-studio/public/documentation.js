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
  if(!test)return `<article class="notice"><strong>${E(report.file)}</strong><p>${report.status==='unavailable'?'No BDD report is available. Tests are never started by Studio.':report.status==='invalid'?'Invalid report; see Problems.':'This report contains no collected tests.'}</p></article>`;
  return `<article class="panel" data-key="${E(report.reportDigest+':'+test.id)}"><div class="panel-body">
    <div class="report-title"><h3>${E(test.name)}</h3><small>${E(report.run?.framework??'Report')}</small></div><p><span class="badge">${E(test.status)}</span> ${E(test.proofKind??test.level??'Unspecified proof kind')}${test.flaky?' · Flaky after retry':''} · ${E(report.modelCorrelation??report.correlation)}</p>
    ${(test.scenarios??[]).map(s=>`<details><summary>${E(s.name)}</summary><dl class="properties">${['given','when','then'].filter(k=>s.phases[k]).map(k=>`<dt>${k.toUpperCase()}</dt><dd>${E(s.phases[k])}</dd>`).join('')}</dl></details>`).join('')||'<p>No structured scenario description in this report.</p>'}
    <details><summary>Evidence scope</summary><p>${E(report.notice)}</p></details>
    ${sourceButton(test.file,test.line,project,E,'Open test')} <small>${E(test.file)}${test.line?':'+test.line:''}</small>
    ${test.associations?.length?`<details><summary>${test.associations.length} exact ID references in the located test body</summary>${test.associations.map(a=>`<p><code>${E(a.entityKey)}</code> · ${E(a.kind)}</p>`).join('')}</details>`:''}
    </div></article>`;
}
export function documentationView(project,state,E) {
  const section=state.documentationSection??'contracts',offset=state.documentationOffset??0;
  const ticket=`${project.bundleDigest}:${section}:${offset}`;
  const page=state.documentationPage?.ticket===ticket?state.documentationPage.value:null;
  const error=state.documentationError?.ticket===ticket?state.documentationError.message:null;
  const scope=page?.scope??project.documentation?.scope;
  return `<section class="panel"><header class="panel-head"><h2>Intent & behavior</h2></header><div class="panel-body">
    <p>WHAT/WHY, declared structure and test reports remain separate.</p>
    ${section==='reports'?'<p class="muted">Results are producer-reported. Source references are not executed service coverage. Traces are separate.</p>':''}
    <div class="toolbar">${[['contracts','WHAT / WHY'],['legacy','Legacy reason'],['reports','Behavior reports']].map(([id,label])=>`<button data-doc-section="${id}" aria-pressed="${section===id}">${label}</button>`).join('')}</div>
    ${scope?`<p class="muted">${scope.services} local service declarations in ${scope.files} source files · ${scope.complete?'Static discovery complete for this scope':'Incomplete discovery; see Problems'}</p><details><summary>Selected source roots</summary><pre>${E((scope.sourceRoots??[]).join('\n'))}</pre></details>`:''}
    ${error?`<p class="notice">${E(error)} <button data-doc-retry>Retry</button></p>`:!page?'<p role="status">Loading selected documentation page…</p>':
      `<p role="status">${page.total} ${section==='reports'?'reported test rows':'records'} · showing ${page.rows.length} from offset ${page.offset}</p>
      ${page.rows.map(row=>section==='contracts'?`<article class="panel" data-key="${E(row.entityKey)}"><div class="panel-body"><h3>${E(row.id)}</h3>${contractBody(row,project,E)}</div></article>`:section==='legacy'?`<article class="panel"><div class="panel-body"><h3>${E(row.id)}</h3><div class="section-label">Legacy reason</div><p>${E(row.reason)}</p><p class="muted">Preserved legacy declaration. No automatic relation to a ProductSpec service is inferred.</p>${sourceButton(row.source.file,row.source.line,project,E)}</div></article>`:reportedTest(row,project,E)).join('')||`<p>${section==='reports'?'No BDD reports configured or produced. This is not a documentation error.':section==='legacy'?'No literal legacy reason declarations in the selected sources.':'No contracts in this source scope. External service types are listed in Problems.'}</p>`}
      <div class="toolbar"><button data-doc-offset="${Math.max(0,offset-50)}" ${offset===0?'disabled':''}>Previous 50</button><button data-doc-offset="${page.nextOffset??offset}" ${page.nextOffset===null?'disabled':''}>Next 50</button></div>`}
    </div></section>`;
}
export function intentPanel(intent,project,E) {
  if(!intent)return '';
  const d=intent.declared;
  const ports=(items)=>items.map(p=>`<li><code>${E(p.id)}</code> · ${E(p.contract?.id??p.contract??'Unknown contract')} · ${E(p.purpose??'data')}</li>`).join('')||'<li>None declared.</li>';
  return `<section aria-label="Type intent"><div class="section-label">Type-owned intent</div><code>${E(intent.typeKey)}</code>${contractBody(intent.contract,project,E)}
    ${d?`<details><summary>Declared reality</summary><dl class="properties">${Object.entries(d.runtime??{}).map(([key,value])=>`<dt>${E(key)}</dt><dd>${E(Array.isArray(value)?value.join(', '):value)}</dd>`).join('')}</dl><h3>Consumes</h3><ul>${ports(d.inputs)}</ul><h3>Publishes</h3><ul>${ports(d.outputs)}</ul><h3>Used by</h3><ul>${d.consumers.map(c=>`<li>${E(c.id)}</li>`).join('')||'<li>No outgoing consumer binding in this model.</li>'}</ul></details>`:''}
    <div class="section-label">Behavior reports</div>${intent.tests.length?intent.tests.map(t=>`<p>${E(t.proofKind??t.level??'Unspecified proof kind')} · ${E(t.status)} · ${E(t.correlation)}<br>${E(t.name)} ${sourceButton(t.file,t.line,project,E,'Open test')}</p>`).join(''):'<p>No test-body source associations available for this entity.</p>'}
    <p class="muted">${E(intent.notice)}</p>${intent.testTotal>intent.tests.length?`<p>${intent.testTotal} associated rows total; first ${intent.tests.length} shown.</p>`:''}<button data-exp="intent" data-doc-reports>Browse all reports</button>
    <div class="section-label">Observed reality</div><p>Recorded traces are inspected in Trace. No runtime pass is inferred from these test reports.</p></section>`;
}
