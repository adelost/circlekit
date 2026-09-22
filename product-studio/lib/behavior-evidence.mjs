import ts from 'typescript';
import { boundedJson, digest, plain, requireThat } from './util.mjs';

const statusValues=['passed','failed','skipped','pending'];
const text=(v,nullable=false)=>nullable&&v===null || typeof v==='string'&&v.trim().length>0&&v.length<=8000;
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const relativeFile=v=>text(v)&&!v.includes('\\')&&!/^(?:\/|[A-Za-z]:)/.test(v)&&v.split('/').every(p=>p&&p!=='.'&&p!=='..'&&!p.startsWith('.'));
function shape(value, keys, required=keys) {
  return plain(value)&&required.every(k=>Object.hasOwn(value,k))&&Object.keys(value).every(k=>keys.includes(k));
}

/**
 * WHAT: Validates canonical BDD run reports and retains their original evidence level.
 * WHY: Keeps reported outcomes distinct from current-model proof and observed runtime traces.
 * Format owner: adelost/bdd-vitest, schema/bdd.run.v1.schema.json at 2c8eb91.
 */
export function decodeBehaviorReport(input, {repository=null,revision=null}={}) {
  const report=typeof input==='string'?boundedJson(input,4000000):boundedJson(JSON.stringify(input),4000000);
  const valid=(ok,message)=>requireThat(ok,'evidence.report',message);
  valid(shape(report,['schemaVersion','run','summary','tests'])&&report.schemaVersion==='bdd.run.v1','Use the existing bdd.run.v1 report; unknown versions are not inferred.');
  const r=report.run;
  valid(shape(r,['framework','frameworkVersion','project','repository','commitSha','branch','startedAt','finishedAt','durationMs','status']), 'BDD run metadata is incomplete.');
  valid(text(r.framework)&&['frameworkVersion','project','repository','commitSha','branch'].every(k=>text(r[k],true)), 'BDD run identities must be strings or explicit null.');
  valid(['passed','failed','interrupted'].includes(r.status)&&number(r.durationMs)&&
    /^\d{4}-\d{2}-\d{2}T/.test(r.startedAt)&&/^\d{4}-\d{2}-\d{2}T/.test(r.finishedAt)&&
    Number.isFinite(Date.parse(r.startedAt))&&Date.parse(r.finishedAt)>=Date.parse(r.startedAt), 'BDD run status or timing is invalid.');
  valid(shape(report.summary,['total',...statusValues])&&Object.values(report.summary).every(integer),'BDD summary counts must be nonnegative integers.');
  valid(Array.isArray(report.tests)&&report.tests.length<=10000,'Select a report with at most 10000 tests.');
  const counts={total:report.tests.length,passed:0,failed:0,skipped:0,pending:0}, ids=new Set();
  for(const t of report.tests) {
    valid(shape(t,['id','name','fullName','file','line','level','documentation','scenarios','status','durationMs','retryCount','flaky']), 'BDD test metadata is incomplete or contains unknown fields.');
    valid(/^sha256:[a-f0-9]{64}$/.test(t.id)&&!ids.has(t.id),'BDD test IDs must be unique sha256 identities.');ids.add(t.id);
    valid(text(t.name)&&text(t.fullName)&&relativeFile(t.file)&&(t.line===null||integer(t.line)&&t.line>=1),'BDD test locations must be repository-relative.');
    valid([null,'unit','component','integration','e2e'].includes(t.level)&&['scenario','docstring','missing'].includes(t.documentation),'BDD test level or documentation source is unknown.');
    valid(statusValues.includes(t.status)&&number(t.durationMs)&&integer(t.retryCount)&&typeof t.flaky==='boolean'&&t.flaky===(t.retryCount>0&&t.status==='passed'),'BDD test status/retry metadata is inconsistent.');
    valid(Array.isArray(t.scenarios)&&t.scenarios.length<=100,'BDD scenarios must be a bounded list.');
    for(const s of t.scenarios) {
      valid(shape(s,['name','phases','documented','outline'],['name','phases','documented'])&&text(s.name)&&typeof s.documented==='boolean','BDD scenario metadata is invalid.');
      valid(shape(s.phases,['given','when','then'],['then'])&&Object.values(s.phases).every(v=>text(v)),'BDD scenarios need a nonempty Then and valid optional Given/When.');
      if(s.outline)valid(shape(s.outline,['name','row'])&&text(s.outline.name)&&text(s.outline.row),'BDD outline identity is invalid.');
    }
    counts[t.status]++;
  }
  valid(Object.keys(counts).every(k=>counts[k]===report.summary[k]),'BDD summary does not match its test records.');
  valid(r.status!=='passed'||counts.failed===0&&counts.pending===0,'A passed run cannot contain failed or pending tests.');
  const correlation=!repository||!revision||!r.repository||!r.commitSha?'unavailable':repository!==r.repository?'foreign-repository':revision!==r.commitSha?'different-revision':'same-reported-commit';
  return {...report,reportDigest:digest(report),correlation,
    notice:'Results are producer-reported. Even a matching commit does not prove a clean tree, current model, binding coverage or running device.'};
}

/**
 * WHAT: Finds exact ProductSpec ID literals inside a located JavaScript or TypeScript test.
 * WHY: Keeps source references useful without relabelling names or mentions as exercised coverage.
 */
export function associateBehaviorReferences(report, sources, architecture) {
  const byId=new Map(),indexes=new Map();
  for(const entity of architecture.entities) {const list=byId.get(entity.id)??[];list.push(entity.key);byId.set(entity.id,list);}
  const sourceByFile=new Map(sources.map(s=>[s.path??s.file,s]));
  const tests=report.tests.map(test=>{
    const s=sourceByFile.get(test.file);
    if(!s||!test.line||!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(test.file))return {...test,associations:[],associationStatus:'unavailable'};
    if(!indexes.has(test.file)) {
      const file=ts.createSourceFile(test.file,s.text,ts.ScriptTarget.Latest,true),candidates=[];
      const visit=n=>{
        if(ts.isCallExpression(n)&&n.arguments.some(a=>ts.isArrowFunction(a)||ts.isFunctionExpression(a))) {
          const line=file.getLineAndCharacterOfPosition(n.getStart(file)).line+1;
          const literalName=n.arguments.find(a=>ts.isStringLiteralLike(a))?.text;
          if(literalName)candidates.push({node:n,line,name:literalName});
        }
        ts.forEachChild(n,visit);
      };visit(file);indexes.set(test.file,{file,candidates});
    }
    const {file,candidates}=indexes.get(test.file);
    const matches=candidates.filter(c=>c.line===test.line&&c.name===test.name);
    if(matches.length!==1)return {...test,associations:[],associationStatus:'unavailable'};
    const refs=new Set();
    const walk=n=>{if(ts.isStringLiteralLike(n))for(const key of byId.get(n.text)??[])refs.add(key);ts.forEachChild(n,walk);};
    // Exclude test title and suite labels. Only callback code contributes source references.
    for(const a of matches[0].node.arguments)if(ts.isArrowFunction(a)||ts.isFunctionExpression(a))walk(a.body);
    return {...test,associations:[...refs].sort().map(entityKey=>({entityKey,kind:'source-reference',sourceDigest:digest(s.text)})),
      associationStatus:refs.size?'source-reference-only':'unavailable'};
  });
  return {...report,tests};
}
