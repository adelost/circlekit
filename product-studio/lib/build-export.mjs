import ts from 'typescript';
import { writeFile, mkdtemp, rm, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeFile, requireThat, digest } from './util.mjs';
import { writeInspectionBundle } from './exporter.mjs';
import { graphProduct } from './graph-data.mjs';
import { loadProductKernel } from './product-kernel.mjs';

/**
 * WHAT: Exports selected product-owned declarations through that product's installed ProductSpec compiler.
 * WHY: Keeps trusted authoring execution outside the read-only viewer and avoids compiler substitution.
 * This explicit helper executes selected authoring source. It is not a sandbox or startup path.
 */
export async function exportAuthoring({root,packageRoot='.',files,entry,exportName,productId,output,kind='graph',evaluateContract}) {
  requireThat(Array.isArray(files)&&files.length>0&&files.length<=32&&new Set(files).size===files.length&&files.includes(entry),
    'export.inputs','Select one entry and at most 32 unique product-owned source files.');
  requireThat(typeof exportName==='string'&&exportName.length>0,'export.export','Select an existing authoring export.');
  requireThat(['graph','machine','decision-table'].includes(kind),'export.kind',
    'Select graph, machine or decision-table authoring output.');
  const base=await realpath(root),read=[];
  for(const file of files)read.push(await safeFile(base,file,1000000));
  const {entry:compilerUrl,version:compilerVersion}=await loadProductKernel(base,packageRoot);

  const staging=await mkdtemp(path.join(os.tmpdir(),'studio-build-'));
  try {
    const names=new Map(files.map((file,index)=>[file,`${index}.mjs`]));
    const resolveModule=(specifier,from)=>{
      if(specifier==='@v1d/product-spec')return compilerUrl;
      requireThat(specifier.startsWith('.'),'export.import',`Authoring import '${specifier}' is outside the selected source closure.`);
      const candidate=path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier));
      const selected=[candidate,candidate+'.ts',candidate+'.mjs',candidate+'.js',candidate.replace(/\.js$/,'.ts')].find(f=>names.has(f));
      requireThat(selected,'export.import',`Add the actual imported declaration '${specifier}' to the selected source files.`);
      return './'+names.get(selected);
    };
    for(const file of read) {
      const transformer=context=>node=>{
        const visit=n=>{
          if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteralLike(n.moduleSpecifier)) {
            if(n.importClause?.isTypeOnly||n.isTypeOnly)return undefined;
            const literal=ts.factory.createStringLiteral(resolveModule(n.moduleSpecifier.text,file.relative));
            return ts.isImportDeclaration(n)
              ?ts.factory.updateImportDeclaration(n,n.modifiers,n.importClause,literal,n.attributes)
              :ts.factory.updateExportDeclaration(n,n.modifiers,n.isTypeOnly,n.exportClause,literal,n.attributes);
          }
          requireThat(!(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword),'export.import','Dynamic authoring imports are unsupported.');
          return ts.visitEachChild(n,visit,context);
        };
        return ts.visitNode(node,visit);
      };
      const result=ts.transpileModule(file.text,{fileName:file.relative,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,transformers:{before:[transformer]}});
      requireThat(!(result.diagnostics??[]).some(d=>d.category===ts.DiagnosticCategory.Error),'export.syntax','Selected authoring source contains syntax errors.');
      await writeFile(path.join(staging,names.get(file.relative)),result.outputText,{flag:'wx',mode:0o600});
    }
    const module=await import(pathToFileURL(path.join(staging,names.get(entry))).href);
    requireThat(Object.hasOwn(module,exportName),'export.export',`The selected source does not export ${exportName}.`);
    const exported=module[exportName];
    const product=kind==='graph'?graphProduct(exported,productId):null;
    const facets=kind==='graph'?[]:[{kind,id:exported?.id,compiled:exported}];
    requireThat(kind==='graph'||typeof exported?.id==='string','export.facet','Finite authoring export needs a stable ID.');
    for(const file of read)requireThat(digest((await safeFile(base,file.relative)).text)===digest(file.text),'export.stale','Product source changed during compilation.');
    // The exact source digests identify this build. Git HEAD would make a committed bundle change on every bundle-only commit.
    return writeInspectionBundle({root:base,output,productId,product,facets,sourceFiles:files,sourceSnapshot:read,
      sourceRevision:null,evaluateContract,compiler:{name:'@v1d/product-spec',version:compilerVersion}});
  } finally { await rm(staging,{recursive:true,force:true}); }
}
