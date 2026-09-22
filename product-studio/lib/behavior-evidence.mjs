import { boundedJson, digest, plain, requireThat } from './util.mjs';
import { kotlinIdReferences, testAnnotations, testSourceIndex } from './test-source.mjs';

const statusValues=['passed','failed','skipped','pending'];
const text=(value,nullable=false)=>nullable&&value===null || typeof value==='string'&&value.trim().length>0&&value.length<=8000;
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const relativeFile=value=>text(value)&&!value.includes('\\')&&!/^(?:\/|[A-Za-z]:)/.test(value)
  &&value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!part.startsWith('.'));
function shape(value,keys,required=keys) {
  return plain(value)&&required.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>keys.includes(key));
}

export function decodeBehaviorReport(input,{repository=null,revision=null}={}) {
  const report=typeof input==='string'?boundedJson(input,4000000):boundedJson(JSON.stringify(input),4000000);
  const valid=(condition,message)=>requireThat(condition,'evidence.report',message);
  valid(shape(report,['schemaVersion','run','summary','tests'])&&report.schemaVersion==='bdd.run.v1',
    'Use the existing bdd.run.v1 report; unknown versions are not inferred.');
  const run=report.run;
  valid(shape(run,['framework','frameworkVersion','project','repository','commitSha','branch','startedAt','finishedAt','durationMs','status']),
    'BDD run metadata is incomplete.');
  valid(text(run.framework)&&['frameworkVersion','project','repository','commitSha','branch'].every(key=>text(run[key],true)),
    'BDD run identities must be strings or explicit null.');
  valid(['passed','failed','interrupted'].includes(run.status)&&number(run.durationMs)
    &&/^\d{4}-\d{2}-\d{2}T/.test(run.startedAt)&&/^\d{4}-\d{2}-\d{2}T/.test(run.finishedAt)
    &&Number.isFinite(Date.parse(run.startedAt))&&Date.parse(run.finishedAt)>=Date.parse(run.startedAt),
    'BDD run status or timing is invalid.');
  valid(shape(report.summary,['total',...statusValues])&&Object.values(report.summary).every(integer),
    'BDD summary counts must be nonnegative integers.');
  valid(Array.isArray(report.tests)&&report.tests.length<=10000,'Select a report with at most 10000 tests.');
  const counts={total:report.tests.length,passed:0,failed:0,skipped:0,pending:0},ids=new Set();
  for(const test of report.tests) {
    valid(shape(test,['id','name','fullName','file','line','level','documentation','scenarios','status','durationMs','retryCount','flaky']),
      'BDD test metadata is incomplete or contains unknown fields.');
    valid(/^sha256:[a-f0-9]{64}$/.test(test.id)&&!ids.has(test.id),'BDD test IDs must be unique sha256 identities.');
    ids.add(test.id);
    valid(text(test.name)&&text(test.fullName)&&relativeFile(test.file)
      &&(test.line===null||integer(test.line)&&test.line>=1),'BDD test locations must be repository-relative.');
    valid([null,'unit','component','integration','e2e'].includes(test.level)
      &&['scenario','docstring','missing'].includes(test.documentation),'BDD test level or documentation source is unknown.');
    valid(statusValues.includes(test.status)&&number(test.durationMs)&&integer(test.retryCount)
      &&typeof test.flaky==='boolean'&&test.flaky===(test.retryCount>0&&test.status==='passed'),
      'BDD test status/retry metadata is inconsistent.');
    valid(Array.isArray(test.scenarios)&&test.scenarios.length<=100,'BDD scenarios must be a bounded list.');
    for(const scenario of test.scenarios) {
      valid(shape(scenario,['name','phases','documented','outline'],['name','phases','documented'])
        &&text(scenario.name)&&typeof scenario.documented==='boolean','BDD scenario metadata is invalid.');
      valid(shape(scenario.phases,['given','when','then'],['then'])
        &&Object.values(scenario.phases).every(value=>text(value)),
        'BDD scenarios need a nonempty Then and valid optional Given/When.');
      if(scenario.outline)valid(shape(scenario.outline,['name','row'])&&text(scenario.outline.name)&&text(scenario.outline.row),
        'BDD outline identity is invalid.');
    }
    counts[test.status]++;
  }
  valid(Object.keys(counts).every(key=>counts[key]===report.summary[key]),'BDD summary does not match its test records.');
  valid(run.status!=='passed'||counts.failed===0&&counts.pending===0,'A passed run cannot contain failed or pending tests.');
  const correlation=!repository||!revision||!run.repository||!run.commitSha?'unavailable'
    :repository!==run.repository?'foreign-repository'
    :revision!==run.commitSha?'different-revision':'same-reported-commit';
  return {...report,reportDigest:digest(report),correlation,
    notice:'Results are producer-reported. Even a matching commit does not prove a clean tree, current model, binding coverage or running device.'};
}

export function associateBehaviorReferences(report,sources,architecture,idSources=[]) {
  const byId=new Map(),knownKeys=new Set(architecture.entities.map(entity=>entity.key));
  for(const entity of architecture.entities) {
    const values=byId.get(entity.id)??[];
    values.push(entity.key);byId.set(entity.id,values);
  }
  const sourceByFile=new Map(sources.map(source=>[source.path??source.file,source]));
  const indexes=new Map();
  const tests=report.tests.map(test=>{
    const source=sourceByFile.get(test.file);
    if(!source||!test.line)return {...test,proofKind:test.level??'unspecified',proofOrigin:'producer-reported',
      associations:[],associationStatus:'unavailable',associationDiagnostics:[]};
    if(!indexes.has(test.file))indexes.set(test.file,testSourceIndex(source.text,test.file));
    const candidates=indexes.get(test.file).filter(candidate=>candidate.name===test.name);
    const exact=candidates.filter(candidate=>candidate.line===test.line);
    const located=exact.length===1?exact[0]:candidates.length===1?candidates[0]:null;
    if(!located)return {...test,proofKind:test.level??'unspecified',proofOrigin:'producer-reported',
      associations:[],associationStatus:'unavailable',associationDiagnostics:[]};

    const refs=new Set();
    for(const id of located.literals)for(const key of byId.get(id)??[])refs.add(key);
    for(const key of kotlinIdReferences(located,idSources,byId))refs.add(key);
    const associations=[...refs].sort().map(entityKey=>({
      entityKey,kind:'source-reference',sourceDigest:located.sourceDigest,
    }));
    const annotations=testAnnotations(located,{knownKeys,byId});
    for(const association of annotations.associations) {
      if(!associations.some(existing=>existing.entityKey===association.entityKey&&existing.kind===association.kind))
        associations.push(association);
    }
    return {
      ...test,
      proofKind:annotations.proofKind??test.level??'unspecified',
      proofOrigin:annotations.proofKind?'source-declared':'producer-reported',
      associations,
      associationStatus:associations.some(item=>item.kind==='author-declared')?'author-declared'
        :associations.length?'source-reference-only':'unavailable',
      associationDiagnostics:annotations.diagnostics,
    };
  });
  return {...report,tests};
}
