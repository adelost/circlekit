import ts from 'typescript';
import { digest } from './util.mjs';

const JS = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const nativeMask = text => text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
  value => value.replace(/[^\n]/g, ' '));

function statementOf(node, source) {
  let current=node;
  while(current.parent && current.parent!==source) {
    if(ts.isExpressionStatement(current)||ts.isVariableStatement(current)||ts.isFunctionDeclaration(current)) break;
    current=current.parent;
  }
  return current;
}
function leadingComment(text,node) {
  const ranges=ts.getLeadingCommentRanges(text,node.getFullStart())??[];
  if(!ranges.length)return '';
  const last=ranges.at(-1);
  if(text.slice(last.end,node.getStart()).trim())return '';
  return text.slice(last.pos,last.end);
}
function literalText(node) {
  if(ts.isStringLiteralLike(node))return node.text;
  if(ts.isArrayLiteralExpression(node)&&node.elements.length&&ts.isStringLiteralLike(node.elements[0]))return node.elements[0].text;
  return null;
}
function callLevel(call, source) {
  const name=call.expression.getText(source).split('.').at(-1);
  return ['unit','component','integration','e2e'].includes(name)?name:null;
}
function jsIndex(text,file) {
  const kind=/\.tsx$/.test(file)?ts.ScriptKind.TSX:/\.jsx$/.test(file)?ts.ScriptKind.JSX:/\.[cm]?js$/.test(file)?ts.ScriptKind.JS:ts.ScriptKind.TS;
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,kind);
  if(source.parseDiagnostics.length)return [];
  const tests=[];
  const visit=node=>{
    if(ts.isCallExpression(node)) {
      const name=node.arguments.find(ts.isStringLiteralLike)?.text;
      const callback=node.arguments.find(arg=>ts.isArrowFunction(arg)||ts.isFunctionExpression(arg));
      const phaseObject=node.arguments.find(arg=>ts.isObjectLiteralExpression(arg)
        &&arg.properties.some(p=>p.name&&p.name.getText(source)==='then'));
      const body=callback?.body??phaseObject;
      if(name&&body) {
        const phases={};
        for(const property of phaseObject?.properties??[]) {
          if(!ts.isPropertyAssignment(property))continue;
          const phase=property.name.getText(source);
          if(!['given','when','then'].includes(phase))continue;
          const value=literalText(property.initializer);
          if(value)phases[phase]=value;
        }
        const literals=[];
        const collect=child=>{
          if(ts.isStringLiteralLike(child))literals.push(child.text);
          ts.forEachChild(child,collect);
        };
        collect(body);
        const statement=statementOf(node,source);
        tests.push({
          name,
          line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,
          comments:leadingComment(text,statement),
          literals,
          phases,
          level:callLevel(node,source),
          sourceDigest:digest(text),
          language:'js',
        });
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(source);
  return tests;
}

function nativeLeadingComment(text,index) {
  const before=text.slice(0,index);
  const lines=before.split(/\r?\n/);
  let cursor=lines.length-1;
  while(cursor>=0&&(!lines[cursor].trim()||lines[cursor].trim().startsWith('@')))cursor--;
  if(cursor<0)return '';
  if(lines[cursor].trim().endsWith('*/')) {
    const out=[];
    for(;cursor>=0;cursor--) {
      out.unshift(lines[cursor]);
      if(lines[cursor].includes('/*'))break;
    }
    return out.join('\n');
  }
  const out=[];
  while(cursor>=0&&lines[cursor].trim().startsWith('//'))out.unshift(lines[cursor--]);
  return out.join('\n');
}
function kotlinIndex(text,file) {
  const masked=nativeMask(text),tests=[];
  const re=/\bfun\s+(`[^`\n]+`|[A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g;
  for(const match of masked.matchAll(re)) {
    const open=masked.indexOf('{',match.index+match[0].length-1);
    let depth=1,end=open+1;
    for(;end<masked.length&&depth;end++) {
      if(masked[end]==='{')depth++;
      else if(masked[end]==='}')depth--;
    }
    if(depth)continue;
    const body=text.slice(open+1,end-1),literals=[];
    for(const string of body.matchAll(/"(?:\\.|[^"\\\n])*"/g)) {
      try{literals.push(JSON.parse(string[0]));}catch{}
    }
    tests.push({
      name:match[1].replace(/^`|`$/g,''),
      line:text.slice(0,match.index).split(/\r?\n/).length,
      comments:nativeLeadingComment(text,match.index),
      literals,
      phases:{},
      level:null,
      sourceDigest:digest(text),
      language:'kotlin',
      body,
    });
  }
  return tests;
}

export function testSourceIndex(text,file) {
  if(JS.test(file))return jsIndex(text,file);
  if(/\.kt$/.test(file))return kotlinIndex(text,file);
  return [];
}

function resolution(token,knownKeys,byId) {
  if(knownKeys.has(token))return {keys:[token]};
  const matches=byId.get(token)??[];
  if(matches.length===1)return {keys:matches};
  return {keys:[],error:matches.length>1
    ?'Ambiguous @covers target '+token+'; use an exact entity key.'
    :'Unknown @covers target '+token+'.'};
}

export function testAnnotations(located,{knownKeys,byId}) {
  const associations=[],diagnostics=[];
  for(const match of (located.comments??'').matchAll(/@covers\s+([^@\n*]+)/g)) {
    for(const token of match[1].trim().split(/[\s,]+/).filter(Boolean)) {
      const resolved=resolution(token,knownKeys,byId);
      if(resolved.error)diagnostics.push(resolved.error);
      for(const entityKey of resolved.keys)associations.push({
        entityKey,kind:'author-declared',sourceDigest:located.sourceDigest,
      });
    }
  }
  const proof=(located.comments??'').match(/@proof\s+(host|unit|component|integration|e2e)\b/i)?.[1]?.toLowerCase()??null;
  return {associations,diagnostics,proofKind:proof};
}

export function scenarioDescriptions(name,located) {
  const phases={};
  const title=name.match(/^Given\s+([\s\S]+?)\s+When\s+([\s\S]+?)\s+Then\s+([\s\S]+)$/i);
  if(title) {
    phases.given=title[1].trim();phases.when=title[2].trim();phases.then=title[3].trim();
  } else if(located?.phases?.then) Object.assign(phases,located.phases);
  return phases.then?[{name,phases,documented:true}]:[];
}

function generatedKotlinIds(source) {
  const values=new Map();
  const rootObject=source.match(/\bobject\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/)?.[1]??null;
  for(const match of source.matchAll(/\b(?:const\s+)?val\s+([A-Za-z_][A-Za-z0-9_]*)[^=\n]*=\s*("(?:\\.|[^"\\\n])*")/g)) {
    if(!rootObject)continue;
    try{values.set(rootObject+'.'+match[1],JSON.parse(match[2]));}catch{}
  }
  const objectValues=new Map();
  for(const match of source.matchAll(/\bdata\s+object\s+([A-Za-z_][A-Za-z0-9_]*)[\s\S]*?override\s+val\s+value\s*=\s*("(?:\\.|[^"\\\n])*")\s*\}/g)) {
    try {
      const value=JSON.parse(match[2]);
      objectValues.set(match[1],value);
      if(rootObject) {
        values.set(rootObject+'.'+match[1],value);
        values.set(rootObject+'.PortIds.'+match[1],value);
      }
      values.set('PortIds.'+match[1],value);
    } catch {}
  }
  for(const match of source.matchAll(/\bval\s+([A-Za-z_][A-Za-z0-9_]*)[^=\n]*=\s*([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
    const value=objectValues.get(match[2]);
    if(value!==undefined&&rootObject)values.set(rootObject+'.'+match[1],value);
  }
  return values;
}

export function kotlinIdReferences(located,idSources,byId) {
  if(located.language!=='kotlin')return [];
  const refs=new Set();
  for(const source of idSources) {
    const ids=generatedKotlinIds(source.text);
    for(const [token,id] of ids) {
      const escaped=token.replace(/[.*+?^$()|[\]\\{}]/g,'\\$&');
      if(!new RegExp('\\b'+escaped+'\\b').test(located.body??''))continue;
      for(const key of byId.get(id)??[])refs.add(key);
    }
  }
  return [...refs];
}
