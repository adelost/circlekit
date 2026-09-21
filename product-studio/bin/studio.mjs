#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseCli, executeSemanticCli, formatJson, HELP, SEMANTIC_COMMANDS } from '../lib/cli.mjs';
import { boundedJson, safeFile, requireThat, errorPayload } from '../lib/util.mjs';

/** Import-safe entrypoint. Only serve starts HTTP; read commands emit one JSON result. */
export async function main(args = process.argv.slice(2), { cwd = process.cwd(), stdout = process.stdout } = {}) {
  let parsed;
  try {
    parsed = parseCli(args);
    if (parsed.help) { stdout.write(HELP); return 0; }
    const { command, values: v, repeated, positional } = parsed;
    if (SEMANTIC_COMMANDS.has(command)) {
      const response = await executeSemanticCli(parsed, { cwd });
      stdout.write(formatJson(response, v.pretty));
      return response.ok ? 0 : 1;
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
        sourceFiles: repeated.source, sourceRevision: v['source-revision'] ?? null,
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
      const { workbench, projects } = await openHeadlessStudio({ roots, examples: !!v.examples });
      const selected = v.product === undefined ? projects : [selectProject(projects, v.product)];
      const reports = selected.map(p => {
        const view = workbench.view(workbench.require(p.key));
        return { key: p.key, id: p.id, productId: view.productId, product: view.label,
          modelDigest: view.modelDigest, bundleDigest: view.bundleDigest,
          sourceIdentity: view.sourceIdentity?.kind ?? 'not-exported',
          compiler: view.compatibility ?? { evaluator: view.toolVersions.productSpec, producer: null },
          owners: view.architecture.coverage.owners, facets: view.facets.length,
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
    const { origin } = await createServer({ roots, port: v.port ?? 4317,
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
