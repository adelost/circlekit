import ts from 'typescript';
import path from 'node:path';
import { digest, requireThat } from './util.mjs';
import { entityKey } from './architecture.mjs';

const library = '@v1d/product-spec';
const constructors = new Set(['service', 'derive', 'present', 'defineMachine', 'defineDecisionTable']);
const unwrap = n => {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n))) n = n.expression;
  return n;
};
const property = (node, name) => ts.isObjectLiteralExpression(node)
  ? node.properties.find(p => ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) && p.name.text === name) : null;
const constBinding = d => ts.isVariableDeclaration(d) && !!(d.parent.flags & ts.NodeFlags.Const);

/**
 * WHAT: Extracts adjacent intent from ProductSpec calls without executing product code.
 * WHY: Keeps source discovery separate from AMUX wording rules and compiler semantics.
 */
export function scanSourceContracts(sources, { evaluateContract } = {}) {
  requireThat(Array.isArray(sources) && sources.length <= 1000, 'contract.budget', 'Select at most 1000 source files.');
  const files = new Map();
  for (const s of sources) {
    requireThat(typeof s.text === 'string' && Buffer.byteLength(s.text) <= 1000000, 'contract.budget', 'Each contract source must be at most 1 MB.');
    const file = s.path ?? s.file;
    requireThat(typeof file === 'string' && !files.has(file), 'contract.source', 'Every source needs one unique path.');
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file)) continue;
    files.set(file, ts.createSourceFile(file, s.text, ts.ScriptTarget.Latest, true,
      /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS));
  }
  const facadeName='__studio_contract_kernel__.d.ts';
  requireThat(!files.has(facadeName),'contract.source','Reserved source-index facade path.');
  const facade=ts.createSourceFile(facadeName,
    `declare module '${library}' { ${[...constructors].map(n=>`export const ${n}: unknown;`).join(' ')} }`,
    ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const lookup=new Map([...files,[facadeName,facade]]);
  const host = {
    getSourceFile: f => lookup.get(f), fileExists: f => lookup.has(f), readFile: f => lookup.get(f)?.text,
    getDefaultLibFileName: () => '', getCurrentDirectory: () => '', getCanonicalFileName: f => f,
    useCaseSensitiveFileNames: () => true, getNewLine: () => '\n', writeFile() {},
    resolveModuleNames: (names, containing) => names.map(name => {
      if (!name.startsWith('.')) return undefined;
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(containing), name));
      const target = [base, base.replace(/\.[cm]?js$/, '.ts'), base+'.ts', base+'.mjs', base+'.js', base+'/index.ts'].find(f => files.has(f));
      return target ? {resolvedFileName:target, extension:/\.[cm]?js$/.test(target)?ts.Extension.Js:ts.Extension.Ts} : undefined;
    }),
  };
  const program = ts.createProgram([...lookup.keys()], { noLib:true, allowJs:true, target:ts.ScriptTarget.Latest }, host);
  const checker = program.getTypeChecker(), contracts = [], legacy = [], diagnostics = [];
  const moduleSymbol=checker.getSymbolAtLocation(facade.statements[0].name);
  const canonical=new Map(checker.getExportsOfModule(moduleSymbol).map(s=>[s,s.name]));
  let complete = true;
  const incomplete = new Set(['contract.syntax', 'contract.service.escape', 'contract.duplicate']);
  function finding(rule, message, source, severity='error') {
    diagnostics.push({rule, message, severity, file:source.file, line:source.line});
    if (incomplete.has(rule)) complete = false;
  }
  function imported(d) {
    let parent=d;
    while(parent && !ts.isImportDeclaration(parent) && !ts.isExportDeclaration(parent)) parent=parent.parent;
    return parent?.moduleSpecifier?.text;
  }
  function namespaceOf(expression, seen=new Set()) {
    const n=unwrap(expression);if(!n||!ts.isIdentifier(n)||seen.has(n))return false;seen.add(n);
    for(const d of checker.getSymbolAtLocation(n)?.declarations??[]) {
      if(ts.isNamespaceImport(d)&&imported(d)===library)return true;
      if(constBinding(d)&&namespaceOf(d.initializer,seen))return true;
    }
    return false;
  }
  function constructorOf(expression, seen = new Set()) {
    const n=unwrap(expression); if (!n || seen.has(n)) return null; seen.add(n);
    if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
      const name=ts.isPropertyAccessExpression(n)?n.name.text:n.argumentExpression&&ts.isStringLiteralLike(n.argumentExpression)?n.argumentExpression.text:null;
      if (namespaceOf(n.expression)) return constructors.has(name)?name:null;
      return null;
    }
    if (!ts.isIdentifier(n)) return null;
    const symbol=checker.getSymbolAtLocation(n);
    const target=symbol&&(symbol.flags&ts.SymbolFlags.Alias)?checker.getAliasedSymbol(symbol):symbol;
    if(canonical.has(target))return canonical.get(target);
    for (const d of symbol?.declarations ?? []) {
      if ((ts.isImportSpecifier(d)||ts.isExportSpecifier(d)) && imported(d)===library) {
        const name=(d.propertyName??d.name).text;
        return constructors.has(name)?name:null;
      }
      if (constBinding(d) && d.initializer) {const result=constructorOf(d.initializer, seen);if(result)return result;}
      if(ts.isBindingElement(d)&&ts.isObjectBindingPattern(d.parent)&&constBinding(d.parent.parent)
        && !d.dotDotDotToken && namespaceOf(d.parent.parent.initializer)) {
        const field=d.propertyName??d.name,name=ts.isIdentifier(field)||ts.isStringLiteralLike(field)?field.text:null;
        if(constructors.has(name))return name;
      }
    }
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias)) {
      const resolved=checker.getAliasedSymbol(symbol);
      for(const d of resolved.declarations??[]) {
        if(ts.isExportSpecifier(d) && imported(d)===library) {const name=(d.propertyName??d.name).text;if(constructors.has(name))return name;}
        if(constBinding(d) && d.initializer) {const result=constructorOf(d.initializer,seen);if(result)return result;}
      }
    }
    return null;
  }
  function literal(n, seen=new Set()) {
    n=unwrap(n); if(!n||seen.has(n))return null;seen.add(n);
    if(ts.isStringLiteralLike(n))return n.text;
    if(ts.isIdentifier(n))for(const d of checker.getSymbolAtLocation(n)?.declarations??[])if(constBinding(d))return literal(d.initializer,seen);
    return null;
  }
  function objectLiteral(expression, seen=new Set()) {
    const n=unwrap(expression);if(!n||seen.has(n))return null;seen.add(n);
    if(ts.isObjectLiteralExpression(n))return n;
    if(ts.isIdentifier(n))for(const d of checker.getSymbolAtLocation(n)?.declarations??[])
      if(constBinding(d)&&d.initializer)return objectLiteral(d.initializer,seen);
    return null;
  }
  function callId(call) {
    const object=objectLiteral(call.arguments[0]); if(!object)return null;
    const p=property(object,'id');if(!p)return null;
    const index=object.properties.indexOf(p);
    if(object.properties.slice(index+1).some(p=>ts.isSpreadAssignment(p)||p.name&&ts.isComputedPropertyName(p.name)))return null;
    if(object.properties.filter(p=>p.name&&(ts.isIdentifier(p.name)||ts.isStringLiteralLike(p.name))&&p.name.text==='id').length!==1)return null;
    return literal(p.initializer);
  }
  function cleanComment(raw) {
    return raw.replace(/^\/\*\*?/, '').replace(/\*\/$/, '').split(/\r?\n/)
      .map(l=>l.replace(/^\s*(?:\*|\/\/\/?)\s?/, '').trim()).join('\n').trim();
  }
  function preceding(n, file) {
    const ranges=ts.getLeadingCommentRanges(file.text,n.getFullStart())??[];
    if(!ranges.length)return '';
    const last=ranges.at(-1);
    if(file.text.slice(last.end,n.getStart(file)).trim())return '';
    const selected=last.kind===ts.SyntaxKind.SingleLineCommentTrivia
      ? ranges.slice(ranges.findLastIndex(r=>r.kind!==ts.SyntaxKind.SingleLineCommentTrivia)+1) : [last];
    return selected.map(r=>cleanComment(file.text.slice(r.pos,r.end))).join('\n');
  }
  function ownerOf(call, file) {
    let n=call, symbol=null;
    for (let p=call.parent; p && p!==file; p=p.parent) {
      if (ts.isVariableStatement(p)) {
        if (p.declarationList.declarations.length!==1) return {doc:'',symbol:null};
        break;
      }
    }
    while(n && n!==file) {
      if(ts.isVariableDeclaration(n))symbol=ts.isIdentifier(n.name)?n.name.text:symbol;
      if(ts.isFunctionDeclaration(n))symbol=n.name?.text??symbol;
      if(ts.isVariableStatement(n)) {
        if(n.declarationList.declarations.length!==1)return {doc:'',symbol};
        let calls=0;const count=child=>{if(ts.isCallExpression(child)&&constructorOf(child.expression)==='service')calls++;ts.forEachChild(child,count);};count(n);
        if(calls>1)return {doc:'',symbol};
      }
      if(ts.isVariableStatement(n)||ts.isExportAssignment(n)||ts.isFunctionDeclaration(n)||ts.isPropertyAssignment(n))return {doc:preceding(n,file),symbol};
      const inline=ts.isVariableDeclarationList(n)||ts.isVariableDeclaration(n)?'':preceding(n,file);if(inline)return {doc:inline,symbol};
      n=n.parent;
    }
    return {doc:'',symbol};
  }
  function tags(doc) {
    const found={}, matches=[...doc.matchAll(/\b(WHAT|WHY|DTO|REMOVE|REFACTOR|MERGE|DEPRECATED|DEBT):\s*/gi)];
    for(let i=0;i<matches.length;i++) {
      const m=matches[i],value=doc.slice(m.index+m[0].length,matches[i+1]?.index??doc.length).replace(/\s+/g,' ').trim();
      (found[m[1].toUpperCase()]??=[]).push(value);
    }
    return found;
  }
  for(const [fileName,file] of files) {
    const sourceDigest=digest(file.text);
    const source=n=>{const pos=file.getLineAndCharacterOfPosition(n.getStart(file));return {file:fileName,line:pos.line+1,column:pos.character+1,digest:sourceDigest,span:{start:n.getStart(file),end:n.end}};};
    for(const d of file.parseDiagnostics)finding('contract.syntax',ts.flattenDiagnosticMessageText(d.messageText,' '),{file:fileName,line:file.getLineAndCharacterOfPosition(d.start??0).line+1});
    const callCallees=new Set(), aliasExpressions=new Set();
    const mark=n=>{if(ts.isCallExpression(n))callCallees.add(unwrap(n.expression));if(constBinding(n)&&n.initializer&&(ts.isIdentifier(n.name)||ts.isObjectBindingPattern(n.name)&&n.name.elements.every(e=>!e.dotDotDotToken&&(!e.propertyName||!ts.isComputedPropertyName(e.propertyName)))))aliasExpressions.add(unwrap(n.initializer));ts.forEachChild(n,mark);};mark(file);
    let count=0;
    function visit(node) {
      requireThat(++count<=100000,'contract.budget','Source syntax tree exceeds 100000 nodes.');
      if(ts.isCallExpression(node)) {
        const callee=unwrap(node.expression);
        if(ts.isElementAccessExpression(callee)&&namespaceOf(callee.expression)&&!ts.isStringLiteralLike(callee.argumentExpression))
          finding('contract.service.escape','Computed ProductSpec namespace access cannot establish complete service discovery. Use a named constructor.',source(node));
        const constructor=constructorOf(node.expression);
        if(constructor) {
          const origin=source(node), owner=ownerOf(node,file), parsed=tags(owner.doc);
          const required=constructor==='service';
          if(required || parsed.WHAT || parsed.WHY) {
            const id=callId(node);
            if(!id && required)finding('contract.service.id',
              'The service call is checked here; its computed type ID needs an explicit exported origin for model linkage. No factory is executed.',origin,'info');
            const diagnostic=(rule,message,severity='error')=>finding(rule,message,origin,required?severity:'info');
            const what=parsed.WHAT?.[0]?.trim()??'', why=parsed.WHY?.[0]?.trim()??'';
            const start=diagnostics.length;
            if(!what||!why)diagnostic('contract.missing',required?'Service intent needs adjacent WHAT: <responsibility> and WHY: <boundary or failure mode>.':'Optional intent is incomplete. The existing general contract linter owns non-service obligations.');
            if(Object.values(parsed).some(v=>v.length!==1)||Object.keys(parsed).some(k=>!['WHAT','WHY'].includes(k)))diagnostic('contract.tags','Use exactly one WHAT and one WHY for intent, not DTO/debt or repeated tags.');
            if(evaluateContract && what && why) {
              for(const f of evaluateContract(`WHAT: ${what}\nWHY: ${why}`,{name:owner.symbol??id??'',kind:constructor}))
                diagnostic(f.code,f.msg,f.sev==='error'?'error':'warning');
            }
            const errors=diagnostics.slice(start);
            contracts.push({entityKey:id?entityKey(constructor==='defineMachine'||constructor==='defineDecisionTable'?'facet':'node-type',id,
              constructor==='defineMachine'?'machine':constructor==='defineDecisionTable'?'decision-table':''):null,
              id,kind:constructor,symbol:owner.symbol,source:origin,
              contract:{what,why,status:!what||!why?'missing':errors.length?'invalid':evaluateContract?'validated':'present'}});
          }
        }
      }
      if((ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node))&&constructorOf(node.expression)==='service')
        finding('contract.service.escape','Indirect service construction through call/apply/bind or a function property is unsupported. Use a direct constructor call.',source(node));
      if(ts.isIdentifier(node)||ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
        const parent=node.parent;
        const declarationName=(ts.isImportSpecifier(parent)||ts.isNamespaceImport(parent)||ts.isExportSpecifier(parent)) || parent.name===node;
        const propertyPart=(ts.isPropertyAccessExpression(parent)||ts.isElementAccessExpression(parent)) && parent.expression===node;
        if(!declarationName&&!propertyPart&&(constructorOf(node)==='service'||namespaceOf(node))&&!callCallees.has(node)&&!aliasExpressions.has(node)) {
          if(!(ts.isParenthesizedExpression(parent)||ts.isAsExpression(parent)||ts.isSatisfiesExpression(parent)))
            finding('contract.service.escape','ProductSpec service escapes into unsupported construction. Call a statically identified constructor; callback/factory coverage is unknown.',source(node));
        }
      }
      if(ts.isObjectLiteralExpression(node)) {
        const reason=property(node,'reason'),id=property(node,'id');
        if(reason&&id&&property(node,'runs')) {
          const value=literal(reason.initializer),identity=literal(id.initializer);
          if(value&&identity)legacy.push({id:identity,reason:value,source:source(node),status:'legacy-reason'});
        }
      }
      ts.forEachChild(node,visit);
    }
    visit(file);
  }
  const groups=new Map();
  for(const c of contracts)if(c.entityKey){const list=groups.get(c.entityKey)??[];list.push(c);groups.set(c.entityKey,list);}
  for(const [key,list] of groups)if(list.length>1)for(const c of list){c.contract.status='invalid';finding('contract.duplicate',`Several declarations own ${key}; export one exact origin instead of choosing a comment.`,c.source);}
  return {contracts,legacy,diagnostics,complete,identityComplete:contracts.filter(c=>c.kind==='service').every(c=>c.id!==null),files:files.size,serviceCount:contracts.filter(c=>c.kind==='service').length,
    notice:'Coverage is limited to the selected source files. External types and arbitrary factories are not inferred. Presence is not proof that prose is true.'};
}

export function bindContractOrigins(records, origins, entities) {
  const byKey=new Map(entities.map(e=>[e.key,e]));
  return records.flatMap(record=>{
    if(record.entityKey||record.kind!=='service')return [record];
    const matches=origins.filter(o=>{
      const entity=byKey.get(o.entityKey);
      return entity?.kind==='node-type'&&entity.data?.kind==='service'
        &&o.file===record.source.file&&o.sourceDigest===record.source.digest
        &&o.span&&o.span.start>=record.source.span.start&&o.span.end<=record.source.span.end;
    });
    return matches.length?matches.map(o=>({...record,id:byKey.get(o.entityKey).id,entityKey:o.entityKey,identityOrigin:'explicit-source-map'})):[record];
  });
}
