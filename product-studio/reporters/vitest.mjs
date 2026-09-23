import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { behaviorReport, testIdentity, writeBehaviorReport } from '../lib/report-output.mjs';
import { scenarioDescriptions, testSourceIndex } from '../lib/test-source.mjs';
import { safeFile, requireThat } from '../lib/util.mjs';

function git(root,args) {
  try{return execFileSync('git',['-C',root,...args],{encoding:'utf8',timeout:3000,maxBuffer:1000000,stdio:['ignore','pipe','ignore']}).trim();}
  catch{return null;}
}
function cleanCommit(root) {
  return git(root,['status','--porcelain'])===''?git(root,['rev-parse','HEAD']):null;
}
function state(value) {
  const normalized={pass:'passed',passed:'passed',fail:'failed',failed:'failed',skip:'skipped',skipped:'skipped',todo:'pending',pending:'pending'}[value];
  requireThat(normalized,'evidence.vitest-state','Unknown Vitest result state '+String(value)+'.');
  return normalized;
}
function moduleFile(root,id) {
  const raw=String(id);
  const file=raw.startsWith('file:')?fileURLToPath(raw):raw;
  const relative=path.relative(root,file).split(path.sep).join('/');
  requireThat(relative&&!relative.startsWith('../')&&!path.isAbsolute(relative),'evidence.source',
    'A Vitest module is outside STUDIO_REPOSITORY_ROOT.');
  return relative;
}

/**
 * Optional Vitest reporter. It observes a test run selected by the product owner
 * and emits bdd.run.v1; Product Studio never starts Vitest itself.
 */
export default class StudioEvidenceReporter {
  constructor(options={}) {this.options=options;}
  onInit(context) {
    this.context=context;
    this.root=path.resolve(this.options.root??process.env.STUDIO_REPOSITORY_ROOT??context.config.root);
    this.output=this.options.outputFile??process.env.STUDIO_BDD_REPORT??'test-results/bdd-run.json';
    this.repository=this.options.repository??process.env.STUDIO_REPOSITORY??null;
  }
  onTestRunStart() {
    this.startedAt=Date.now();
    this.before=cleanCommit(this.root);
  }
  async onTestRunEnd(modules,unhandledErrors,reason) {
    requireThat(Array.isArray(modules),'evidence.vitest-version',
      'Expected the Vitest 4 public TestModule list. Verify the reporter against the installed runner.');
    const tests=[],ordinals=new Map();
    for(const module of modules) {
      requireThat(typeof module.children?.allTests==='function','evidence.vitest-version',
        'This reporter requires Vitest TestModule.children.allTests().');
      const file=moduleFile(this.root,module.moduleId);
      let index=[];
      try{index=testSourceIndex((await safeFile(this.root,file,1000000)).text,file);}catch{}
      for(const test of module.children.allTests()) {
        requireThat(tests.length<10000,'evidence.budget','Vitest evidence exceeds 10000 tests.');
        const result=test.result(),diagnostic=typeof test.diagnostic==='function'?test.diagnostic():null;
        const candidates=index.filter(candidate=>candidate.name===test.name);
        const line=Number(test.location?.line);
        const exact=Number.isSafeInteger(line)&&line>0?candidates.filter(candidate=>candidate.line===line):[];
        const located=exact.length===1?exact[0]:candidates.length===1?candidates[0]:null;
        const scenarios=scenarioDescriptions(test.name,located);
        const fullName=test.fullName??test.name;
        const ordinal=ordinals.get(file+'\0'+fullName)??0;
        ordinals.set(file+'\0'+fullName,ordinal+1);
        const status=state(result?.state);
        const retryCount=Number.isSafeInteger(diagnostic?.retryCount)?diagnostic.retryCount:0;
        tests.push({
          id:testIdentity('vitest',file,fullName,ordinal),
          name:test.name,fullName,file,line:located?.line??(Number.isSafeInteger(line)&&line>0?line:null),
          level:located?.level??null,documentation:scenarios.length?'scenario':'missing',scenarios,
          status,durationMs:Number.isFinite(diagnostic?.duration)?Math.max(0,diagnostic.duration):0,
          retryCount,flaky:retryCount>0&&status==='passed',
        });
      }
    }
    const after=cleanCommit(this.root);
    const failed=unhandledErrors?.length>0||modules.some(module=>typeof module.ok==='function'&&!module.ok());
    const report=behaviorReport({
      framework:'vitest',frameworkVersion:this.context.version??null,
      project:this.context.config.name||null,repository:this.repository,
      commitSha:this.before&&this.before===after?after:null,
      branch:git(this.root,['branch','--show-current'])||null,
      startedAt:this.startedAt??Date.now(),finishedAt:Date.now(),
      status:reason==='interrupted'?'interrupted':failed?'failed':null,
      tests,
    });
    const receipt=await writeBehaviorReport(this.root,this.output,report);
    this.context.logger.log('Product Studio evidence: '+receipt.output+' ('+receipt.tests+' tests, '+receipt.status+').');
  }
}
