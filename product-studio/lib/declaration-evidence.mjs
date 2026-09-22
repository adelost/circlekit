import { kernel as studioKernel, KERNEL_VERSION } from './kernel.mjs';
import { behaviorReport } from './report-output.mjs';
import { digest, requireThat } from './util.mjs';

const lawName=entity=>{
  if(entity.kind==='node-type')return 'node-type-structural-laws';
  if(entity.kind==='facet')return entity.data.kind+'-structural-laws';
  return null;
};
export const declarationLawId=(modelDigest,key,law)=>
  'sha256:'+digest(JSON.stringify(['product-spec-laws',modelDigest,key,law]));

function sourceFor(entity,origins,artifactFile) {
  return origins.get(entity.key)?.file??entity.data?.source?.file??artifactFile??null;
}
function validate(entity,evaluator) {
  if(entity.kind==='node-type') {
    evaluator.validateProductNodeType(structuredClone(entity.data));
    return;
  }
  const compiled=structuredClone(entity.data.compiled);
  if(Array.isArray(compiled.invariants)&&compiled.invariants.some(value=>typeof value==='string'))compiled.invariants=[];
  if(entity.data.kind==='machine')evaluator.defineMachine(compiled);
  else evaluator.defineDecisionTable(compiled);
}

export function generateDeclarationEvidence(view,{
  artifactFile=null,repository=null,evaluator=studioKernel,evaluatorVersion=KERNEL_VERSION,
}={}) {
  const startedAt=Date.now(),origins=new Map(view.sourceIndex.origins.map(origin=>[origin.entityKey,origin])),tests=[];
  const candidates=view.architecture.entities.filter(entity=>lawName(entity));
  requireThat(candidates.length>0,'evidence.law-scope','No ProductSpec node types or finite facets are available in this selection.');
  for(const entity of candidates) {
    const law=lawName(entity),file=sourceFor(entity,origins,artifactFile);
    requireThat(file,'evidence.law-source','Attach source or a generated artifact path before exporting declaration evidence.');
    let status='passed',then;
    const producer=view.compatibility?.producer??null;
    const incompatible=!producer||producer!==evaluatorVersion;
    if(incompatible) {
      status='skipped';
      then='Producer/evaluator identity is missing or mismatched, so no declaration law was re-evaluated.';
    } else {
      try {
        validate(entity,evaluator);
        then='The matching ProductSpec kernel accepted this structural declaration. Runtime behavior and product-source freshness are not proven.';
      } catch(error) {
        status='failed';
        then='The matching ProductSpec kernel refused this declaration: '+error.message;
      }
    }
    const name=entity.id+': '+law;
    tests.push({
      id:declarationLawId(view.modelDigest,entity.key,law),
      name,fullName:name,file,line:origins.get(entity.key)?.line??null,
      level:'unit',documentation:'scenario',
      scenarios:[{name,phases:{
        given:'Compiled model '+view.modelDigest+' and entity '+entity.key+'.',
        when:'ProductSpec '+evaluatorVersion+' evaluates '+law+'.',
        then,
      },documented:true}],
      status,durationMs:0,retryCount:0,flaky:false,
    });
  }
  const allSkipped=tests.every(test=>test.status==='skipped');
  return behaviorReport({
    framework:'product-spec-laws',frameworkVersion:evaluatorVersion,project:view.productId,repository,
    startedAt,finishedAt:Date.now(),status:allSkipped?'interrupted':null,tests,
  });
}

export function correlateDeclarationLaws(report,architecture,modelDigest) {
  const expected=new Map();
  for(const entity of architecture.entities) {
    const law=lawName(entity);
    if(law)expected.set(declarationLawId(modelDigest,entity.key,law),entity.key);
  }
  let matched=0;
  const tests=report.tests.map(test=>{
    const key=expected.get(test.id);
    if(key)matched++;
    return {
      ...test,
      proofKind:'generated-law',
      proofOrigin:'matching-product-spec-kernel',
      associations:key?[{entityKey:key,kind:'generated-model-law',modelDigest}]:[],
      associationStatus:key?'exact-model-declaration':'different-or-unknown-model',
    };
  });
  return {...report,tests,modelCorrelation:matched===tests.length&&tests.length?'same-model':'different-or-partial-model'};
}
