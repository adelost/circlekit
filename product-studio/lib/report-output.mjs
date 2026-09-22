import { mkdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { decodeBehaviorReport } from './behavior-evidence.mjs';
import { relativeSourcePath } from './inspection.mjs';
import { digest, requireThat } from './util.mjs';

export const testIdentity=(framework,file,fullName,ordinal=0)=>
  'sha256:'+digest(JSON.stringify([framework,file,fullName,ordinal]));

export function behaviorReport({
  framework,frameworkVersion=null,project=null,repository=null,commitSha=null,branch=null,
  startedAt,finishedAt,status=null,tests,
}) {
  requireThat(Array.isArray(tests)&&tests.length<=10000,'evidence.tests','Expected at most 10000 collected tests.');
  const summary={total:tests.length,passed:0,failed:0,skipped:0,pending:0};
  for(const test of tests) {
    requireThat(Object.hasOwn(summary,test.status)&&test.status!=='total','evidence.status','Unknown collected test status.');
    summary[test.status]++;
  }
  const start=Number(startedAt),finish=Number(finishedAt);
  requireThat(Number.isFinite(start)&&Number.isFinite(finish)&&finish>=start,'evidence.time','Report execution times are invalid.');
  const runStatus=status??(summary.failed?'failed':summary.pending?'interrupted':'passed');
  const report={
    schemaVersion:'bdd.run.v1',
    run:{
      framework,frameworkVersion,project,repository,commitSha,branch,
      startedAt:new Date(start).toISOString(),
      finishedAt:new Date(finish).toISOString(),
      durationMs:finish-start,
      status:runStatus,
    },
    summary,tests,
  };
  decodeBehaviorReport(report);
  return report;
}

export async function writeBehaviorReport(root,output,report) {
  requireThat(relativeSourcePath(output)&&output.endsWith('.json'),'evidence.output',
    'Evidence output must be a repository-relative .json path.');
  decodeBehaviorReport(report);
  const base=await realpath(root);
  const target=path.resolve(base,output);
  requireThat(target.startsWith(base+path.sep),'evidence.output','Evidence output escapes the selected repository.');
  await mkdir(path.dirname(target),{recursive:true,mode:0o700});
  const parent=await realpath(path.dirname(target));
  requireThat(parent===base||parent.startsWith(base+path.sep),'evidence.output',
    'Evidence output directory resolves outside the repository.');
  const temporary=path.join(parent,'.studio-evidence-'+randomBytes(12).toString('hex')+'.tmp');
  try {
    await writeFile(temporary,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
    await rename(temporary,target);
  } finally {
    await rm(temporary,{force:true});
  }
  return {output:path.relative(base,target).split(path.sep).join('/'),tests:report.tests.length,status:report.run.status};
}
