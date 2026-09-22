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
    if (!/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file)) continue; // Native source provenance is retained by the exporter, not interpreted as TypeScript.
    files.set(file, ts.createSourceFile(file, s.text, ts.ScriptTarget.Latest, true,
      /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS));
  }
  // The checker binds names and shadowing only. No source evaluation, emit, library or filesystem reads.
  const host = {
    getSourceFile: f => files.get(f), fileExists: f => files.has(f), readFile: f => files.get(f)?.text,
    getDefaultLibFileName: () => '', getCurrentDirectory: () => '', getCanonicalFileName: f => f,
    useCaseSensitiveFileNames: () => true, getNewLine: () => '\n', writeFile() {},
    resolveModuleNames: (names, containing) => names.map(name => {
      if (!name.startsWith('.')) return undefined;
      const base = path.posix.normalize(path.posix.join(path.posix.dirname(containing), name));
      const target = [base, base.replace(/\.[cm]?js$/, '.ts'), base+'.ts', base+'.mjs', base+'.js', base+'/index.ts'].find(f => files.has(f));
      return target ? {resolvedFileName:target, extension:/\.[cm]?js$/.test(target)?ts.Extension.Js:ts.Extension.Ts} : undefined;
    }),
  };
  const program = ts.createProgram([...files.keys()], { noLib:true, allowJs:true, target:ts.ScriptTarget.Latest }, host);
  const checker = program.getTypeChecker(), contracts = [], legacy = [], diagnostics = [];
  let complete = true;
  const incomplete = new Set(['contract.syntax', 'contract.service.id', 'contract.service.escape', 'contract.duplicate']);
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
    for (const d of symbol?.declarations ?? []) {
      if ((ts.isImportSpecifier(d)||ts.isExportSpecifier(d)) && imported(d)===library) {
        const name=(d.propertyName??d.name).text;
        return constructors.has(name)?name:null;
      }
      if (constBinding(d) && d.initializer) {const result=constructorOf(d.initializer, seen);if(result)return result;}
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
  function callId(call) {
    const object=unwrap(call.arguments[0]); if(!object||!ts.isObjectLiteralExpression(object))return null;
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
    // Contiguous line comments form one contract; separate block comments do not merge.
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
    const found={};let active=null;
    for(const line of doc.split('\n')) {
      const match=line.match(/^(WHAT|WHY|DTO|REMOVE|REFACTOR|MERGE|DEPRECATED|DEBT):\s*(.*)$/i);
      if(match){active=match[1].toUpperCase();(found[active]??=[]).push(match[2]);}
      else if(active && line.trim())found[active][found[active].length-1]+=' '+line.trim();
    }
    return found;
  }
  for(const [fileName,file] of files) {
    const sourceDigest=digest(file.text);
    const source=n=>{const pos=file.getLineAndCharacterOfPosition(n.getStart(file));return {file:fileName,line:pos.line+1,column:pos.character+1,digest:sourceDigest,span:{start:n.getStart(file),end:n.end}};};
    for(const d of file.parseDiagnostics)finding('contract.syntax',ts.flattenDiagnosticMessageText(d.messageText,' '),{file:fileName,line:file.getLineAndCharacterOfPosition(d.start??0).line+1});
    const callCallees=new Set(), aliasExpressions=new Set();
    const mark=n=>{if(ts.isCallExpression(n))callCallees.add(unwrap(n.expression));if(constBinding(n)&&n.initializer)aliasExpressions.add(unwrap(n.initializer));ts.forEachChild(n,mark);};mark(file);
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
            if(!id && required)finding('contract.service.id','Service identity is computed or ambiguous. Export an explicit source map or use a literal service type ID; no factory is executed.',origin);
            const what=parsed.WHAT?.[0]?.trim()??'', why=parsed.WHY?.[0]?.trim()??'';
            const start=diagnostics.length;
            if(!what||!why)finding('contract.missing','Service intent needs adjacent WHAT: <responsibility> and WHY: <boundary or failure mode>.',origin);
            if(Object.values(parsed).some(v=>v.length!==1)||Object.keys(parsed).some(k=>!['WHAT','WHY'].includes(k)))finding('contract.tags','Use exactly one WHAT and one WHY for a service, not DTO/debt or repeated tags.',origin);
            if(evaluateContract && what && why) {
              for(const f of evaluateContract(`WHAT: ${what}\nWHY: ${why}`,{name:owner.symbol??id??'',kind:constructor}))
                finding(f.code,f.msg,origin,f.sev==='error'?'error':'warning');
            }
            const errors=diagnostics.slice(start);
            contracts.push({entityKey:id?entityKey(constructor==='defineMachine'||constructor==='defineDecisionTable'?'facet':'node-type',id,
              constructor==='defineMachine'?'machine':constructor==='defineDecisionTable'?'decision-table':''):null,
              id,kind:constructor,symbol:owner.symbol,source:origin,
              contract:{what,why,status:!what||!why?'missing':!id||errors.length?'invalid':evaluateContract?'validated':'present'}});
          }
        }
      }
      if(ts.isIdentifier(node)||ts.isPropertyAccessExpression(node)||ts.isElementAccessExpression(node)) {
        const parent=node.parent;
        const declarationName=(ts.isImportSpecifier(parent)||ts.isNamespaceImport(parent)||ts.isExportSpecifier(parent)) || parent.name===node;
        const propertyPart=(ts.isPropertyAccessExpression(parent)||ts.isElementAccessExpression(parent)) && parent.expression===node;
        if(!declarationName&&!propertyPart&&constructorOf(node)==='service'&&!callCallees.has(node)&&!aliasExpressions.has(node)) {
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
  return {contracts,legacy,diagnostics,complete,files:files.size,serviceCount:contracts.filter(c=>c.kind==='service').length,
    notice:'Coverage is limited to the selected source files. External types and arbitrary factories are not inferred. Presence is not proof that prose is true.'};
}
