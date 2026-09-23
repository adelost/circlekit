#!/usr/bin/env node
import path from 'node:path';
import { readdir, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { SaxesParser } from 'saxes';
import { safeFile, requireThat } from '../lib/util.mjs';
import { scenarioDescriptions, testSourceIndex } from '../lib/test-source.mjs';
import { behaviorReport, testIdentity, writeBehaviorReport } from '../lib/report-output.mjs';

export function decodeJUnitXml(text) {
  requireThat(Buffer.byteLength(text)<=4_000_000&&!/<!DOCTYPE|<!ENTITY/iu.test(text),
    'evidence.junit-xml','JUnit input is oversized or contains unsupported entity declarations.');
  const suites=[],stack=[],suiteStack=[];
  const failedCases=new WeakSet(),errorCases=new WeakSet();
  let currentCase=null,caseCount=0;
  const parser=new SaxesParser();
  parser.on('doctype',()=>{throw new Error('JUnit DTDs are unsupported.');});
  parser.on('opentag',({name,attributes:a})=>{
    const parent=stack.at(-1);
    if(!stack.length)requireThat(name==='testsuite'||name==='testsuites','evidence.junit-xml','Expected JUnit testsuite or testsuites.');
    if(name==='testsuite'){
      const suite={name:a.name??null,timestamp:a.timestamp??null,seconds:a.time??null,
        tests:a.tests??null,failures:a.failures??null,errors:a.errors??null,skipped:a.skipped??null,cases:[]};
      suites.push(suite);suiteStack.push(suite);
    } else if(name==='testcase'){
      requireThat(parent==='testsuite'&&suiteStack.length>0,'evidence.junit-xml','A JUnit testcase needs a testsuite.');
      currentCase={name:a.name??null,className:a.classname??null,file:a.file??null,line:a.line??null,
        seconds:a.time??null,status:'passed'};
      suiteStack.at(-1).cases.push(currentCase);
      requireThat(++caseCount<=10_000,
        'evidence.junit-xml','JUnit input contains more than 10000 cases.');
    } else if(currentCase&&parent==='testcase'&&(name==='failure'||name==='error')) {
      currentCase.status='failed';
      (name==='failure'?failedCases:errorCases).add(currentCase);
    } else if(currentCase&&parent==='testcase'&&name==='skipped'&&currentCase.status!=='failed')currentCase.status='skipped';
    stack.push(name);
  });
  parser.on('closetag',tag=>{
    const name=typeof tag==='string'?tag:tag.name;
    requireThat(stack.pop()===name,'evidence.junit-xml','Malformed JUnit XML.');
    if(name==='testcase')currentCase=null;
    if(name==='testsuite') {
      const suite=suiteStack.pop();
      const counts={tests:suite.cases.length,
        failures:suite.cases.filter(test=>failedCases.has(test)).length,
        errors:suite.cases.filter(test=>errorCases.has(test)).length,
        skipped:suite.cases.filter(test=>test.status==='skipped').length};
      for(const [field,count] of Object.entries(counts))if(suite[field]!==null) {
        requireThat(/^\d+$/.test(suite[field])&&Number.isSafeInteger(Number(suite[field]))&&Number(suite[field])===count,
          'evidence.count','JUnit suite '+field+' count does not match its cases.');
      }
    }
  });
  parser.on('error',error=>{throw error;});
  parser.write(text).close();
  return {suites};
}
async function collectSources(root,roots) {
  const base=await realpath(root),files=[];let visited=0;
  async function walk(relative) {
    requireThat(++visited<=10000,'evidence.source-budget','Select narrower native test roots.');
    const full=path.resolve(base,relative),resolved=await realpath(full);
    requireThat(resolved===base||resolved.startsWith(base+path.sep),'evidence.source','Native test source escapes the repository.');
    for(const entry of await readdir(full,{withFileTypes:true})) {
      if(entry.name.startsWith('.')||entry.isSymbolicLink()||['build','dist','node_modules'].includes(entry.name))continue;
      const file=path.posix.join(relative,entry.name);
      if(entry.isDirectory())await walk(file);
      else if(entry.isFile()&&file.endsWith('.kt')) {
        requireThat(files.length<1000,'evidence.source-budget','Select at most 1000 Kotlin test files.');
        const source=(await safeFile(base,file,1000000)).text;
        files.push({
          file,text:source,
          packageName:source.match(/^\s*package\s+([\w.]+)/m)?.[1]??'',
          classes:[...source.matchAll(/\bclass\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map(match=>match[1]),
          index:testSourceIndex(source,file),
        });
      }
    }
  }
  for(const rootPath of roots)await walk(rootPath);
  return files;
}
function resolveSource(test,sources) {
  if(test.file) {
    const normalized=String(test.file).replaceAll('\\','/');
    const matches=sources.filter(source=>source.file===normalized||source.file.endsWith('/'+normalized));
    if(matches.length===1)return matches[0];
  }
  const className=String(test.className??'').split('$')[0];
  const short=className.split('.').at(-1);
  const pkg=className.split('.').slice(0,-1).join('.');
  const matches=sources.filter(source=>source.packageName===pkg&&source.classes.includes(short));
  requireThat(matches.length===1,'evidence.junit-source',
    'No unique Kotlin source for '+String(test.className)+'. Select its actual --source-root.');
  return matches[0];
}
function timestamp(value,zone) {
  requireThat(typeof value==='string'&&value.length>0,'evidence.timestamp',
    'JUnit suite has no timestamp. Do not relabel an old result with the current time.');
  let text=value;
  if(!/(?:Z|[+-]\d\d:\d\d)$/.test(text)) {
    requireThat(zone==='UTC','evidence.timestamp',
      'JUnit timestamp has no timezone. Pass --timestamp-zone UTC only if the original runner used UTC.');
    text+='Z';
  }
  const ms=Date.parse(text);
  requireThat(Number.isFinite(ms),'evidence.timestamp','Invalid JUnit timestamp.');
  return ms;
}
function seconds(value,code,message) {
  const duration=typeof value==='string'&&value.trim()!==''?Number(value):NaN;
  requireThat(Number.isFinite(duration)&&duration>=0,code,message);
  return duration;
}

export async function importJUnit({
  root,input,sourceRoots,repository=null,commitSha=null,branch=null,project=null,timestampZone=null,
}) {
  requireThat(Array.isArray(sourceRoots)&&sourceRoots.length>0&&sourceRoots.length<=16,
    'evidence.source','Supply 1-16 actual --source-root paths.');
  const xml=(await safeFile(root,input,4000000)).text;
  const {suites}=decodeJUnitXml(xml);
  const sources=await collectSources(root,sourceRoots);
  const times=[],tests=[],ordinals=new Map();
  for(const suite of suites) {
    const start=timestamp(suite.timestamp,timestampZone);
    const duration=seconds(suite.seconds,'evidence.timestamp','JUnit suite duration is missing or invalid.');
    times.push([start,start+duration*1000]);
    for(const test of suite.cases) {
      requireThat(typeof test.name==='string'&&test.name.length>0&&typeof test.className==='string'&&test.className.length>0,
        'evidence.junit','JUnit testcase identity is missing.');
      const source=resolveSource(test,sources);
      const candidates=source.index.filter(candidate=>candidate.name===test.name);
      const requestedLine=Number(test.line);
      const exact=Number.isSafeInteger(requestedLine)&&requestedLine>0
        ?candidates.filter(candidate=>candidate.line===requestedLine):[];
      const located=exact.length===1?exact[0]:candidates.length===1?candidates[0]:null;
      const scenarios=scenarioDescriptions(test.name,located);
      const durationMs=test.seconds===null&&test.status==='skipped'?0:
        seconds(test.seconds,'evidence.junit-duration','Executed JUnit testcase is missing a valid duration.')*1000;
      requireThat(Number.isFinite(durationMs),'evidence.junit-duration','JUnit testcase duration exceeds the supported range.');
      const fullName=test.className+'.'+test.name;
      const ordinal=ordinals.get(source.file+'\0'+fullName)??0;
      ordinals.set(source.file+'\0'+fullName,ordinal+1);
      tests.push({
        id:testIdentity('junit',source.file,fullName,ordinal),
        name:test.name,fullName,file:source.file,line:located?.line??null,
        level:null,documentation:scenarios.length?'scenario':'missing',scenarios,
        status:test.status,durationMs,retryCount:0,flaky:false,
      });
    }
  }
  requireThat(tests.length>0,'evidence.junit-empty','The JUnit XML contains no collected tests.');
  return behaviorReport({
    framework:'junit',frameworkVersion:null,project,repository,commitSha,branch,
    startedAt:Math.min(...times.map(value=>value[0])),
    finishedAt:Math.max(...times.map(value=>value[1])),
    tests,
  });
}

function parse(args) {
  const options={},sourceRoots=[];
  for(let index=0;index<args.length;index++) {
    const key=args[index];
    requireThat(['--root','--input','--source-root','--output','--repository','--commit-sha','--branch','--project','--timestamp-zone'].includes(key),
      'cli.usage','Unknown JUnit evidence option '+key+'.');
    const value=args[++index];
    requireThat(value&&!value.startsWith('--'),'cli.usage','Missing value for '+key+'.');
    if(key==='--source-root')sourceRoots.push(value);
    else {requireThat(options[key]===undefined,'cli.usage','Repeated option '+key+'.');options[key]=value;}
  }
  requireThat(options['--root']&&options['--input']&&options['--output'],'cli.usage',
    'Use --root ROOT --input result.xml --source-root path --output test-results/bdd-run.json.');
  return {options,sourceRoots};
}
export async function main(args=process.argv.slice(2),{stdout=process.stdout}={}) {
  try {
    const {options,sourceRoots}=parse(args),root=path.resolve(options['--root']);
    const report=await importJUnit({
      root,input:options['--input'],sourceRoots,
      repository:options['--repository']??null,commitSha:options['--commit-sha']??null,
      branch:options['--branch']??null,project:options['--project']??null,
      timestampZone:options['--timestamp-zone']??null,
    });
    const receipt=await writeBehaviorReport(root,options['--output'],report);
    stdout.write(JSON.stringify({...receipt,summary:report.summary})+'\n');
    return report.run.status==='failed'?1:0;
  } catch(error) {
    stdout.write(JSON.stringify({ok:false,error:{code:error.code??'evidence.junit',message:error.message}})+'\n');
    return error.code==='cli.usage'?2:1;
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  main().then(code=>{process.exitCode=code;});
