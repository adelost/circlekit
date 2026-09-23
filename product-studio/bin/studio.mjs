#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { readFile, realpath, access } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { parseCli, executeSemanticCli, formatJson, HELP, SEMANTIC_COMMANDS } from '../lib/cli.mjs';
import { boundedJson, safeFile, requireThat, errorPayload } from '../lib/util.mjs';

async function installedAmuxRoot(cwd) {
  const candidates=[path.resolve(cwd,'../agentmux')];
  for(const directory of (process.env.PATH??'').split(path.delimiter)) {
    if(!directory)continue;
    try {
      const binary=await realpath(path.join(directory,'amux'));
      candidates.push(path.dirname(path.dirname(binary)));
    } catch {}
  }
  for(const candidate of new Set(candidates))try {
    const manifest=JSON.parse(await readFile(path.join(candidate,'package.json'),'utf8'));
    if(manifest.name!=='agentmux')continue;
    await access(path.join(candidate,'core/contract-lint.mjs'));
    return candidate;
  } catch {}
  return null;
}

/** Import-safe entrypoint. Only serve starts HTTP; read commands emit one JSON result. */
export async function main(args = process.argv.slice(2), { cwd = process.cwd(), stdout = process.stdout } = {}) {
  let parsed;
  try {
    if(args[0]==='laws'||args[0]==='junit') {
      const {main:run}=await import(args[0]==='laws'?'./law-evidence.mjs':'./junit-evidence.mjs');
      const options=args.slice(1);
      if(!options.includes('--root'))options.unshift('--root',cwd);
      return run(options,{stdout});
    }
    parsed = parseCli(args);
    if (parsed.help) { stdout.write(HELP); return 0; }
    const { command, values: v, repeated, positional } = parsed;
    v['amux-root']??=await installedAmuxRoot(cwd);
    if (SEMANTIC_COMMANDS.has(command)) {
      const response = await executeSemanticCli(parsed, { cwd });
      stdout.write(formatJson(response, v.pretty));
      return response.ok ? 0 : 1;
    }
    const evaluateContract = v['amux-root'] ? await (await import('../lib/documentation.mjs')).loadContractEvaluator(path.resolve(cwd,v['amux-root'])) : undefined;
    if (command === 'contracts') {
      requireThat(v['amux-root'],'contract.unavailable',
        'AMUX contract grammar is unavailable. Install AMUX or pass --amux-root; no unchecked contract result is returned.');
      const { checkWorkspaceContracts } = await import('../lib/documentation.mjs');
      const report = await checkWorkspaceContracts(path.resolve(cwd,positional[0]??'.'), {product:v.product,evaluateContract});
      stdout.write(formatJson(report,v.pretty)); return report.ok ? 0 : 1;
    }
    if (command === 'export') {
      requireThat(v['amux-root'],'contract.unavailable',
        'AMUX contract grammar is unavailable. Install AMUX or pass --amux-root before exporting service intent.');
      const root=path.resolve(cwd,positional[0]??'.');
      const manifest=boundedJson((await safeFile(root,'studio.workspace.json',64000)).text);
      requireThat([1,2].includes(manifest.version)&&Array.isArray(manifest.projects)&&manifest.projects.length>0,
        'workspace.config','Select a valid studio.workspace.json.');
      const selected=v.product===undefined
        ?manifest.projects.length===1?manifest.projects[0]:null
        :manifest.projects.find(project=>project.id===v.product);
      requireThat(selected,'workspace.selection','Select exactly one workspace project with --product.');
      const authoring=selected.authoring;
      requireThat(authoring&&typeof authoring==='object'&&typeof selected.bundle==='string',
        'export.config','Declare authoring.entry, authoring.exportName, authoring.files and bundle in studio.workspace.json.');
      const {exportAuthoring}=await import('../lib/build-export.mjs');
      const receipt=await exportAuthoring({root,packageRoot:selected.kernelRoot??'.',
        files:authoring.files,entry:authoring.entry,exportName:authoring.exportName,
        kind:authoring.kind??'graph',productId:selected.id,output:selected.bundle,evaluateContract});
      stdout.write(formatJson({schemaVersion:1,ok:true,command,product:selected.id,...receipt},v.pretty));
      return 0;
    }
    if (command === 'bundle') {
      const { writeInspectionBundle } = await import('../lib/exporter.mjs');
      const { relativeSourcePath } = await import('../lib/inspection.mjs');
      const root = path.resolve(cwd, v.root ?? positional[0] ?? '.');
      const product = v.product ? boundedJson((await safeFile(root, v.product)).text) : null;
      const facets = [];
      for (const file of repeated.facet) {
        const compiled = boundedJson((await safeFile(root, file)).text);
        const kind = compiled?.states && compiled?.inputs ? 'machine' : compiled?.axes && compiled?.columns ? 'decision-table' : null;
        requireThat(kind, 'cli.facet', `Unsupported compiled facet: ${file}`);
        facets.push({ kind, id: compiled.id, compiled });
      }
      const productId = v['product-id'] ?? product?.id;
      requireThat(typeof productId === 'string' && productId.length > 0, 'cli.usage', 'A table-only bundle needs --product-id.');
      const output = v.output ?? 'product.studio.json';
      requireThat(relativeSourcePath(output) && output.endsWith('.studio.json'), 'cli.output', 'Select a relative .studio.json output path.');
      // Build the envelope once: do not re-read source twice and discard the first identity.
      const receipt = await writeInspectionBundle({ root, output, productId, product, facets,
        sourceFiles: repeated.source, evaluateContract, sourceRevision: v['source-revision'] ?? null,
        compiler: { name: '@v1d/product-spec', version: v['compiler-version'] } });
      stdout.write(formatJson({ ...receipt, workspaceConfiguration: {
        version: 2, projects: [{ id: productId, label: productId, bundle: output }],
      } }, true));
      return 0;
    }
    const roots = [...positional, ...repeated.workspace].map(r => path.resolve(cwd, r));
    if (command === 'doctor') {
      const { openHeadlessStudio, selectProject } = await import('../lib/semantic.mjs');
      if (!roots.length && !v.examples) roots.push(cwd);
      const { workbench, projects } = await openHeadlessStudio({ roots, examples: !!v.examples, evaluateContract });
      const selected = v.product === undefined ? projects : [selectProject(projects, v.product)];
      const reports = selected.map(p => {
        const view = workbench.view(workbench.require(p.key));
        return { key: p.key, id: p.id, productId: view.productId, product: view.label,
          modelDigest: view.modelDigest, bundleDigest: view.bundleDigest,
          sourceIdentity: view.sourceIdentity?.kind ?? 'not-exported',
          compiler: view.compatibility ?? { evaluator: view.toolVersions.productSpec, producer: null },
          owners: view.architecture.coverage.owners, facets: view.facets.length,
          contracts: {scope:view.documentation.scope,problems:view.documentation.diagnostics},
          sourceLocations: view.sourceIndex.origins.length, supported: view.capabilities, diagnostics: view.diagnostics };
      });
      const ok = reports.length > 0 && !reports.some(p => p.diagnostics.some(d => d.severity !== 'warning' && d.severity !== 'info')
        || ['stale', 'unavailable'].includes(p.sourceIdentity));
      stdout.write(formatJson({ schemaVersion: 1, ok, command, projects: reports,
        notice: 'Read-only attachment report, not a full build or runtime health check. Inspect capability details before simulation.' }, v.pretty));
      return ok ? 0 : 1;
    }
    if (!roots.length) {
      try { await readFile(path.resolve(cwd, 'studio.workspace.json')); roots.push(cwd); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const { createServer } = await import('../server.mjs');
    const { origin } = await createServer({ roots, evaluateContract, port: v.port ?? 4317,
      dataDir: path.resolve(cwd, v['data-dir'] ?? path.join(os.homedir(), '.local/state/product-studio')),
      gitDraftRoots: repeated['allow-git-drafts'].map(r => path.resolve(cwd, r)) });
    stdout.write(`Product Studio: ${origin}\nRead-only product attachment. Scenario execution is synthetic; no generators or providers are started.\n`);
    return 0;
  } catch (error) {
    const response = { schemaVersion: 1, ok: false, command: parsed?.command ?? null, error: errorPayload(error) };
    // Error output is JSON even for option parsing and missing dependencies.
    stdout.write(JSON.stringify(response) + '\n');
    return error.code === 'cli.usage' ? 2 : 1;
  }
}
if (process.argv[1] && await realpath(process.argv[1]).catch(() => null) === fileURLToPath(import.meta.url)) {
  process.stdout.on('error', error => {
    if (error.code === 'EPIPE') process.exit(0);
    process.stderr.write(String(error.message) + '\n'); process.exit(1);
  });
  main().then(code => { process.exitCode = code; }).catch(error => {
    // stdout may have closed (for example a pipe to head). Do not print a second JSON result.
    if (error.code !== 'EPIPE') process.stderr.write(String(error.message) + '\n');
    process.exitCode = error.code === 'EPIPE' ? 0 : 1;
  });
}
