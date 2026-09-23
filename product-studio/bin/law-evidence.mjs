#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openHeadlessStudio, selectProject } from '../lib/semantic.mjs';
import { generateDeclarationEvidence } from '../lib/declaration-evidence.mjs';
import { writeBehaviorReport } from '../lib/report-output.mjs';
import { requireThat } from '../lib/util.mjs';
import { loadProductSpecKernel } from '../lib/product-kernel.mjs';

function parse(args) {
  const options={};
  for(let index=0;index<args.length;index++) {
    const key=args[index];
    if(key==='--stdout') {
      requireThat(options[key]===undefined,'cli.usage','Repeated option --stdout.');
      options[key]=true;continue;
    }
    requireThat(['--root','--product','--output','--repository','--kernel-root'].includes(key),'cli.usage','Unknown law-evidence option '+key+'.');
    const value=args[++index];
    requireThat(value&&!value.startsWith('--'),'cli.usage','Missing value for '+key+'.');
    requireThat(options[key]===undefined,'cli.usage','Repeated option '+key+'.');
    options[key]=value;
  }
  requireThat(options['--root'],'cli.usage',
    'Use --root ROOT [--product ID] [--kernel-root PACKAGE_ROOT] [--output FILE | --stdout].');
  requireThat(!(options['--stdout']&&options['--output']),'cli.usage','Choose --output or --stdout, not both.');
  return options;
}
export async function main(args=process.argv.slice(2),{stdout=process.stdout}={}) {
  try {
    const options=parse(args),root=path.resolve(options['--root']);
    const session=await openHeadlessStudio({roots:[root]});
    const selected=selectProject(session.projects,options['--product']);
    const owner=session.workbench.require(selected.key),view=session.workbench.view(owner);
    const kernelRoot=options['--kernel-root']??owner.config.kernelRoot;
    const selectedKernel=kernelRoot!==undefined
      ?await loadProductSpecKernel(root,kernelRoot)
      :null;
    const report=generateDeclarationEvidence(view,{
      artifactFile:owner.config.bundle??owner.config.artifact??owner.config.sources?.[0]??null,
      repository:options['--repository']??owner.config.documentation?.repository??null,
      ...(selectedKernel?{evaluator:selectedKernel.kernel,evaluatorVersion:selectedKernel.version}:{}),
    });
    if(options['--stdout']) stdout.write(JSON.stringify(report)+'\n');
    else {
      const output=options['--output']??`test-results/${owner.config.id}-laws.json`;
      const receipt=await writeBehaviorReport(root,output,report);
      stdout.write(JSON.stringify({...receipt,summary:report.summary,modelDigest:view.modelDigest,
        producer:view.compatibility?.producer??null,evaluator:report.run.frameworkVersion})+'\n');
    }
    return report.summary.failed||report.summary.passed===0?1:0;
  } catch(error) {
    stdout.write(JSON.stringify({ok:false,error:{code:error.code??'evidence.laws',message:error.message}})+'\n');
    return error.code==='cli.usage'?2:1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().then(code=>{process.exitCode=code;});
