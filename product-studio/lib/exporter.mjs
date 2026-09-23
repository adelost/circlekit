import { scanSourceContracts } from './service-contracts.mjs';
import { writeFile, rename, rm, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createInspectionBundle, relativeSourcePath } from './inspection.mjs';
import { architectureOf } from './architecture.mjs';
import { locateEntities } from './provenance.mjs';
import { digest, safeFile, requireThat } from './util.mjs';

/** Call from an already trusted product build, passing its actual compiled exports. */
export async function prepareInspection({ root, sourceFiles = [], sourceSnapshot, origins = [], evaluateContract, ...input }) {
  const sources = [];
  if (sourceSnapshot !== undefined) {
    requireThat(Array.isArray(sourceSnapshot) && sourceSnapshot.length === sourceFiles.length
      && sourceSnapshot.every((source, index) => source.relative === sourceFiles[index] && typeof source.text === 'string'),
      'export.snapshot', 'The compile owner must supply the exact selected source snapshot.');
    sources.push(...sourceSnapshot);
  } else {
    for (const file of sourceFiles) sources.push(await safeFile(root, file, 1000000));
  }
  const refs = sources.map(s => ({ path: s.relative, text: s.text }));
  const architecture = architectureOf(input.product ?? null, input.facets ?? [], input);
  const located = locateEntities(architecture, refs, origins);
  // Automatically located positions are inspect-only; a position is not an inverse source lens.
  const mapped = located.origins.map(({ entityKey, file, sourceDigest, span, exportName, editing, fields }) => ({
    entityKey, file, sourceDigest, span, exportName: exportName ?? null, editing,
    ...(fields ? { fields } : {}),
  }));
  const scan = scanSourceContracts(refs, { evaluateContract });
  const counts = new Map();
  for (const c of scan.contracts) if (c.entityKey) counts.set(c.entityKey, (counts.get(c.entityKey) ?? 0) + 1);
  return createInspectionBundle({ ...input,
    sources: refs.map(s => ({ file: s.path, digest: digest(s.text) })), origins: mapped,
    contracts: scan.contracts.filter(c => c.entityKey && counts.get(c.entityKey) === 1),
    contractDiagnostics: scan.diagnostics });
}

/** Writes one generated artifact below the selected repository. Never writes source. */
export async function writeInspectionBundle({ root, output, ...input }) {
  requireThat(relativeSourcePath(output) && output.endsWith('.studio.json'), 'export.path', 'Choose a generated .studio.json output path.');
  const bundle = await prepareInspection({ root, ...input });
  const base = await realpath(root);
  let directory=base;
  for(const segment of path.dirname(output).split(path.sep).filter(part=>part!=='.')) {
    const next=path.join(directory,segment);
    try { await mkdir(next); } catch(error) { if(error.code!=='EEXIST')throw error; }
    directory=await realpath(next);
    requireThat(directory===base||directory.startsWith(base+path.sep),
      'export.escape','Generated output directory resolves outside the selected root.');
  }
  const target=path.join(directory,path.basename(output));
  const temporary = path.join(directory, `.studio-${randomBytes(12).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(bundle, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
  return { output, modelDigest: bundle.modelDigest, bundleDigest: bundle.bundleDigest,
    origins: bundle.origins.length, facets: bundle.facets.length };
}
