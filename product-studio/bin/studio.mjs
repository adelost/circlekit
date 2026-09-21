#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const help = `Product Studio

  v1d-studio [serve] [repository] [--workspace repository]...
  v1d-studio doctor [repository]
  v1d-studio bundle --product generated/product.json --compiler-version X.Y.Z
                    [--facet generated/machine.json] [--source src/app.ts]...
                    [--output generated/product.studio.json] [--root repository]

Serve options:
  --port 4317                    Loopback only
  --data-dir directory           Private local drafts/scenarios
  --allow-git-drafts repository   Explicitly permit new draft refs for this root

The viewer never imports repository code or runs a generator. The bundle command
packages existing compiled JSON and indexes source locations. For exact semantic
source maps, call the export adapter from the product's normal trusted build.
No project, provider, model, emulator or production process is started.
`;

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) { console.log(help); return; }
  const command = ['serve','doctor','bundle'].includes(args[0]) ? args.shift() : 'serve';
  const values = {}, repeated = { workspace: [], facet: [], source: [], 'allow-git-drafts': [] }, positional = [];
  const options = new Set(['port','data-dir','root','product','output','compiler-version','product-id','source-revision', ...Object.keys(repeated)]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const name = arg.slice(2);
    if (!options.has(name) || !args[i+1] || args[i+1].startsWith('--')) throw new Error(`Unknown option or missing value: ${arg}`);
    const value = args[++i];
    if (Object.hasOwn(repeated,name)) repeated[name].push(value); else values[name] = value;
  }
  if (positional.length > 1) throw new Error('Choose one positional repository; use --workspace for additional repositories.');
  if (command === 'bundle') {
    const { prepareInspection } = await import('../lib/exporter.mjs');
    const { safeFile, boundedJson, requireThat } = await import('../lib/util.mjs');
    const root = path.resolve(values.root ?? positional[0] ?? '.');
    const product = values.product ? boundedJson((await safeFile(root, values.product)).text) : null;
    const facets = [];
    for (const file of repeated.facet) {
      const compiled = boundedJson((await safeFile(root,file)).text);
      const kind = compiled.states && compiled.inputs ? 'machine' : compiled.axes && compiled.columns ? 'decision-table' : null;
      requireThat(kind, 'cli.facet', `Unsupported compiled facet: ${file}`);
      facets.push({ kind, id: compiled.id, compiled });
    }
    const bundle = await prepareInspection({ root, sourceFiles: repeated.source, product, facets,
      productId: values['product-id'] ?? product?.id, sourceRevision: values['source-revision'] ?? null,
      compiler: { name:'@v1d/product-spec', version: values['compiler-version'] } });
    const output = values.output ?? 'product.studio.json';
    const { relativeSourcePath } = await import('../lib/inspection.mjs');
    requireThat(relativeSourcePath(output) && output.endsWith('.studio.json'), 'cli.output', 'Select a relative .studio.json output path.');
    // Write through the same safe generated-output owner; existing output directory is required.
    const { writeInspectionBundle } = await import('../lib/exporter.mjs');
    const receipt = await writeInspectionBundle({ root, output, ...bundle, sourceFiles: repeated.source });
    console.log(JSON.stringify({ ...receipt, workspaceConfiguration: { version:2, projects:[{id:bundle.productId,label:bundle.productId,bundle:output}] } },null,2));
    return;
  }
  const roots = [...(positional[0] ? [path.resolve(positional[0])] : []), ...repeated.workspace.map(r => path.resolve(r))];
  // With no arguments, opening from a product directory is sufficient when a manifest exists.
  if (!roots.length) { try { await readFile(path.resolve('studio.workspace.json')); roots.push(path.resolve('.')); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const dataDir = path.resolve(values['data-dir'] ?? path.join(os.homedir(), '.local/state/product-studio'));
  if (command === 'doctor') {
    const { Workbench } = await import('../lib/workspaces.mjs');
    const app = new Workbench({ dataDir }); await app.initialize(roots);
    const result = app.list().filter(p => !p.fixture).map(p => {
      const v = app.view(app.require(p.key));
      return { product:v.label, modelDigest:v.modelDigest, sourceIdentity:v.sourceIdentity?.kind ?? 'not-exported',
        compiler:v.compatibility ?? { evaluator:v.toolVersions.productSpec, producer:'not recorded' },
        owners:v.architecture.coverage.owners, facets:v.facets.length, sourceLocations:v.sourceIndex.origins.length,
        supported:v.capabilities, diagnostics:v.diagnostics };
    });
    console.log(JSON.stringify({ projects:result, notice:'Read-only attachment report; no build, runtime or external effects executed.' },null,2));
    if (!result.length || result.some(p => p.diagnostics.length || p.sourceIdentity === 'stale')) process.exitCode=1;
    return;
  }
  const port = Number(values.port ?? 4317);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port.');
  const { createServer } = await import('../server.mjs');
  const { origin } = await createServer({ roots, dataDir, port, gitDraftRoots: repeated['allow-git-drafts'].map(r=>path.resolve(r)) });
  console.log(`Product Studio: ${origin}\nRead-only product attachment. Scenario execution is synthetic; no generators or providers are started.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(`${error.code ?? 'studio'}: ${error.message}`); process.exitCode = 1; });
