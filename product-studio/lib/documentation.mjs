import { readdir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { entityKey } from './architecture.mjs';
import { scanSourceContracts } from './service-contracts.mjs';
import { decodeBehaviorReport, associateBehaviorReferences } from './behavior-evidence.mjs';
import { boundedJson, digest, requireThat, safeFile } from './util.mjs';

const ignored=new Set(['node_modules','dist','build','generated','coverage','test','tests','__tests__','fixtures','target','out','vendor']);
const sourceFile=f=>/\.(?:[cm]?js|jsx|ts|tsx)$/.test(f)&&!/(?:\.d\.ts|\.(?:test|spec)\.[^.]+)$/.test(f);
const issue=(rule,message,file,severity='error')=>({rule,message,file,severity});

/**
 * WHAT: Reads bounded documentation inputs selected by the product workspace.
 * WHY: Keeps source scanning away from generated output, private paths and product execution.
 */
export async function readDocumentationInputs(root, config={}, fallback=[]) {
  requireThat(config&&typeof config==='object'&&!Array.isArray(config),'contract.config','documentation must be an object.');
  const roots=config.sourceRoots??fallback;
  requireThat(Array.isArray(roots)&&roots.length<=32&&roots.every(v=>typeof v==='string'&&v.length>0),'contract.config','Select up to 32 documentation source roots.');
  const base=await realpath(root),sources=[],diagnostics=[],seen=new Set();let bytes=0,visited=0;
  async function visit(relative, explicit=false) {
    requireThat(++visited<=10000,'contract.budget','Documentation walk exceeds 10000 entries; select narrower source roots.');
    requireThat(relative==='.'||!path.isAbsolute(relative)&&!relative.includes('\\')&&relative.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.')),
      'contract.path','Documentation source roots must stay inside the selected repository.');
    const full=path.resolve(base,relative),resolved=await realpath(full),stat=await lstat(full);
    requireThat(resolved===base||resolved.startsWith(base+path.sep),'contract.path','Documentation source path escapes the repository.');
    requireThat(!stat.isSymbolicLink(),'contract.symlink','Select the source owner directly; symbolic-link documentation roots are unsupported.');
    if(stat.isDirectory()) {
      for(const entry of (await readdir(full,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
        if(entry.name.startsWith('.')||ignored.has(entry.name))continue;
        if(entry.isSymbolicLink()){diagnostics.push(issue('contract.symlink','Source symlink skipped; coverage is incomplete.',relative==='.'?entry.name:relative+'/'+entry.name));continue;}
        if(entry.isDirectory()||sourceFile(entry.name))await visit(relative==='.'?entry.name:relative+'/'+entry.name);
      }
    } else if(stat.isFile() && (sourceFile(relative)||explicit&&/\.(?:[cm]?js|jsx|ts|tsx)$/.test(relative))) {
      if(seen.has(relative))return;seen.add(relative);
      requireThat(sources.length<1000,'contract.budget','Select at most 1000 documentation source files.');
      const file=await safeFile(base,relative,1000000);bytes+=Buffer.byteLength(file.text);
      requireThat(bytes<=32000000,'contract.budget','Documentation sources exceed 32 MB.');
      sources.push({path:relative,text:file.text});
    }
  }
  for(const r of roots)try{await visit(r,true);}catch(e){diagnostics.push(issue(e.code??'contract.source',e.message,r));}
  if(roots.length&&!sources.length)diagnostics.push(issue('contract.scope.empty','No readable source files in the selected documentation scope. Check sourceRoots.','studio.workspace.json'));
  const reports=[];
  const reportPaths=config.bddReports??[];
  requireThat(Array.isArray(reportPaths)&&reportPaths.length<=10&&reportPaths.every(p=>typeof p==='string'),'contract.config','Select at most ten BDD report paths.');
  for(const file of reportPaths)try{reports.push({file,text:(await safeFile(root,file,4000000)).text});}
  catch(e){reports.push({file,unavailable:true});diagnostics.push(issue(e.code==='ENOENT'?'evidence.missing':'evidence.unavailable',e.code==='ENOENT'?'No BDD report has been produced. Opening Studio never runs tests.':e.message,file,'info'));}
  const evidenceSources=[], evidencePaths=new Set(); let evidenceBytes=0;
  for (const input of reports.filter(r=>!r.unavailable)) {
    // Report paths are data, not code to import. Invalid reports remain optional and visible in the viewer.
    let report; try { report=decodeBehaviorReport(input.text); } catch { continue; }
    if (!config.repository || report.run.repository!==config.repository) continue;
    for (const file of new Set(report.tests.map(t=>t.file))) {
      if(evidencePaths.has(file)||!/[.](?:ts|tsx|js|jsx|mjs|cjs)$/.test(file))continue;
      if(evidencePaths.size>=256){diagnostics.push(issue('evidence.scope','Only 256 test source files are associated; other references remain unavailable.',input.file,'info'));break;}
      evidencePaths.add(file);
      try {
        const source=await safeFile(root,file,1000000);evidenceBytes+=Buffer.byteLength(source.text);
        if(evidenceBytes>8000000){diagnostics.push(issue('evidence.scope','Test-source association exceeds 8 MB; remaining references are unavailable.',input.file,'info'));break;}
        evidenceSources.push({path:file,text:source.text});
      } catch { /* A collected report can remain useful when its test source is unavailable. */ }
    }
  }
  return {sources,evidenceSources,reports,diagnostics,roots,repository:config.repository??null,
    readSet:[...sources.map(s=>({file:s.path,digest:digest(s.text)})),...reports.filter(r=>!r.unavailable).map(r=>({file:r.file,digest:digest(r.text)})),...evidenceSources.map(s=>({file:s.path,digest:digest(s.text)}))]};
}

/**
 * WHAT: Loads the existing AMUX evaluator from an explicitly trusted checkout.
 * WHY: Keeps one grammar authority without executing module paths supplied by workspace data.
 */
export async function loadContractEvaluator(root) {
  requireThat(typeof root==='string'&&root.length>0,'contract.grammar','Pass --amux-root to the trusted AMUX checkout for wording validation.');
  const module=await import(pathToFileURL(path.resolve(root,'core/contract-lint.mjs')).href);
  requireThat(typeof module.evaluateContract==='function','contract.grammar','The selected AMUX checkout does not export evaluateContract.');
  return module.evaluateContract;
}

/**
 * WHAT: Checks every selected local service through the caller's AMUX evaluator.
 * WHY: Keeps missing intent on the explicit authoring path rather than production startup.
 */
export async function checkWorkspaceContracts(root, {product,evaluateContract}={}) {
  requireThat(typeof evaluateContract==='function','contract.grammar','The authoring check requires the existing AMUX evaluateContract function.');
  const manifest=boundedJson((await safeFile(root,'studio.workspace.json',64000)).text);
  requireThat([1,2].includes(manifest.version)&&Array.isArray(manifest.projects)&&manifest.projects.length>0&&manifest.projects.length<=20,'workspace.config','Expected a version 1 or 2 Studio workspace with projects.');
  const ids=new Set();for(const p of manifest.projects){requireThat(p&&typeof p.id==='string'&&p.id.trim()&&!ids.has(p.id),'workspace.duplicate','Workspace projects need unique nonempty IDs.');ids.add(p.id);}
  const selected=product===undefined?manifest.projects:manifest.projects.filter(p=>p.id===product);
  requireThat(selected.length>0,'workspace.selection','The requested product is not in studio.workspace.json.');
  const projects=[];
  for(const config of selected) {
    const inputs=await readDocumentationInputs(root,config.documentation??{},config.sources??[]);
    const scan=scanSourceContracts(inputs.sources,{evaluateContract});
    const diagnostics=[...inputs.diagnostics,...scan.diagnostics];
    if(!inputs.roots.length)diagnostics.push(issue('contract.scope.missing','Declare documentation.sourceRoots; an empty selection is not a repository-wide check.','studio.workspace.json'));
    projects.push({id:config.id,...scan,sourceRoots:inputs.roots,diagnostics,ok:scan.complete&&!diagnostics.some(d=>['error','warning'].includes(d.severity))});
  }
  return {schemaVersion:1,ok:projects.every(p=>p.ok),projects,scope:'Selected local service declarations, not external package or runtime coverage.'};
}

/**
 * WHAT: Correlates source intent and optional test reports with a loaded inspection.
 * WHY: Keeps same-name source candidates separate from exact exported model provenance.
 */
export function documentationFor(inputs, architecture, {inspection=null,revision=null,evaluateContract}={}) {
  const scan=scanSourceContracts(inputs.sources,{evaluateContract}),diagnostics=[...inputs.diagnostics,...(inspection?.contractDiagnostics??[]),...scan.diagnostics];
  const origins=new Map((inspection?.origins??[]).map(o=>[o.entityKey,o]));
  const sourceDigests=new Map(inputs.sources.map(s=>[s.path,digest(s.text)]));
  const byKey=new Map(architecture.entities.map(e=>[e.key,e]));
  const exported=inspection?.contracts??[];
  const records=[...scan.contracts];
  // Exported metadata remains inspectable without its sources; it is never substituted for changed local intent.
  for(const c of exported)if(!records.some(r=>r.entityKey===c.entityKey))records.push(c);
  const contracts=records.map(c=>{
    const o=origins.get(c.entityKey),hasEntity=byKey.has(c.entityKey);
    const exact=hasEntity&&o?.file===c.source.file&&o.sourceDigest===c.source.digest&&
      sourceDigests.get(c.source.file)===c.source.digest&&(!o.span||o.span.start>=c.source.span.start&&o.span.end<=c.source.span.end);
    return {...c,correlation:exact?'matched-source':hasEntity?'source-only':'not-in-model',
      validation:scan.contracts.includes(c)&&evaluateContract?'local-amux':c.contract.status==='validated'?'producer-reported':'presence-only'};
  });
  const unresolved=architecture.entities.filter(e=>e.kind==='node-type'&&e.data.kind==='service'&&!contracts.some(c=>c.entityKey===e.key))
    .map(e=>({entityKey:e.key,id:e.id,status:'external-or-unmapped'}));
  for(const u of unresolved)diagnostics.push(issue('contract.external',`Service ${u.id} has no contract in this source scope. Attach its exact owning package; no cross-version match was guessed.`,null,'info'));
  const reports=[];
  for(const input of inputs.reports) {
    if(input.unavailable){reports.push({file:input.file,status:'unavailable'});continue;}
    try {
      const report=decodeBehaviorReport(input.text,{repository:inputs.repository,revision});
      reports.push({file:input.file,status:'loaded',...associateBehaviorReferences(report,inputs.evidenceSources??[],architecture)});
    } catch(e){reports.push({file:input.file,status:'invalid'});diagnostics.push(issue(e.code??'evidence.report',e.message,input.file,'warning'));}
  }
  for(const legacy of scan.legacy)diagnostics.push(issue('contract.legacy',`${legacy.id} retains Legacy reason. No relation to a ProductSpec type is guessed.`,legacy.source.file,'info'));
  return {contracts,legacy:scan.legacy,unresolved,reports,diagnostics,scope:{files:scan.files,services:scan.serviceCount,sourceRoots:inputs.roots,complete:scan.complete},
    notice:'Intent belongs to source types. Structure comes from ProductSpec. Test results are reported evidence; traces remain a separate observation.'};
}

/** Returns one type-owned contract plus declared facts for an exact selected entity. */
export function intentForEntity(documentation, architecture, key) {
  const entities=new Map(architecture.entities.map(e=>[e.key,e]));
  let owner=entities.get(key);if(owner?.kind==='port')owner=entities.get(owner.owner);
  const type=owner?.kind==='node-type'?owner.data:owner?.data?.type;
  const typeKey=owner?.kind==='facet'?owner.key:type?.id?entityKey('node-type',type.id):null;
  if(!typeKey)return null;
  const contract=documentation.contracts.find(c=>c.entityKey===typeKey)??null;
  const instances=architecture.entities.filter(e=>e.kind==='node'&&e.data?.type?.id===type?.id);
  const selectedOwners=new Set(owner.kind==='node'? [owner.key]:instances.map(e=>e.key));
  const consumers=new Set();
  for(const edge of architecture.edges)if(edge.kind==='binding'&&selectedOwners.has(entities.get(edge.from)?.owner)) {
    const target=entities.get(edge.to)?.owner;if(target&&!selectedOwners.has(target))consumers.add(target);
  }
  const related=new Set([key,typeKey,...selectedOwners]);
  for(const e of architecture.entities)if(e.kind==='port'&&selectedOwners.has(e.owner))related.add(e.key);
  const tests=documentation.reports.flatMap(r=>(r.tests??[]).filter(t=>t.associations.some(a=>related.has(a.entityKey)))
    .map(t=>({id:t.id,name:t.name,level:t.level,status:t.status,file:t.file,line:t.line,correlation:r.correlation,association:'source-reference'})));
  return {typeKey,contract,declared:type?{kind:type.kind,inputs:type.inputs??[],outputs:type.outputs??[],runtime:type.runtime??null,
    instances:instances.map(e=>({key:e.key,id:e.id})),consumers:[...consumers].map(key=>({key,id:entities.get(key)?.id??key}))}:null,
    tests:tests.slice(0,50),testTotal:tests.length,notice:'Test associations are source references, not demonstrated service coverage. Structural facts are compiler declarations.'};
}

/** Keep reports out of the initial browser payload and page them independently. */
export function documentationPage(documentation, {section='contracts',offset=0,limit=50}={}) {
  requireThat(['contracts','legacy','reports'].includes(section)&&Number.isSafeInteger(offset)&&offset>=0&&Number.isSafeInteger(limit)&&limit>0&&limit<=200,
    'documentation.page','Select contracts, legacy or reports with a 1..200 limit and a nonnegative offset.');
  const rows=section==='reports'?documentation.reports.flatMap(report=>{
    const {tests,...metadata}=report;
    return tests?.length?tests.map(test=>({report:metadata,test})):[{report:metadata,test:null}];
  }):documentation[section];
  return {section,rows:rows.slice(offset,offset+limit),total:rows.length,offset,nextOffset:offset+limit<rows.length?offset+limit:null,
    scope:documentation.scope,unresolved:documentation.unresolved.length,notice:documentation.notice};
}

/** A diagram caption is presentation; uncorrelated same-ID prose stays in the inspector. */
export function withIntentCaptions(canvas, documentation, architecture) {
  const byKey=new Map(architecture.entities.map(e=>[e.key,e]));
  const byType=new Map(documentation.contracts.filter(c=>c.correlation==='matched-source').map(c=>[c.entityKey,c]));
  return {...canvas,nodes:canvas.nodes.map(node=>{
    const type=byKey.get(node.id)?.data?.type;
    const c=type?byType.get(entityKey('node-type',type.id)):null;
    return c?.contract.what?{...node,subtitle:c.contract.what,description:c.contract.what}:node;
  })};
}
