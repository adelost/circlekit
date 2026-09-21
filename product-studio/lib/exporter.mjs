import { writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createInspectionBundle, relativeSourcePath } from './inspection.mjs';
import { architectureOf } from './architecture.mjs';
import { locateEntities } from './provenance.mjs';
import { digest, safeFile, requireThat } from './util.mjs';

/** Call from an already trusted product build, passing its actual compiled exports. */
export async function prepareInspection({ root, sourceFiles = [], origins = [], ...input }) {
  const sources = [];
  for (const file of sourceFiles) sources.push(await safeFile(root, file, 1000000));
  const refs = sources.map(s => ({ path: s.relative, text: s.text }));
  const architecture = architectureOf(input.product ?? null, input.facets ?? [], input);
  const located = locateEntities(architecture, refs, origins);
  // Automatically located positions are inspect-only; a position is not an inverse source lens.
  const mapped = located.origins.map(({ entityKey, file, sourceDigest, span, exportName, editing, fields }) => ({
    entityKey, file, sourceDigest, span, exportName: exportName ?? null, editing,
    ...(fields ? { fields } : {}),
  }));
  return createInspectionBundle({ ...input, sources: refs.map(s => ({ file: s.path, digest: digest(s.text) })), origins: mapped });
}

/** Writes one generated artifact in an existing, owner-selected directory. Never writes source. */
export async function writeInspectionBundle({ root, output, ...input }) {
  requireThat(relativeSourcePath(output) && output.endsWith('.studio.json'), 'export.path', 'Choose a generated .studio.json output path.');
  const bundle = await prepareInspection({ root, ...input });
  const target = path.resolve(root, output), directory = path.dirname(target);
  // Reject existing symlink parents, including those below the selected root.
  const { realpath } = await import('node:fs/promises');
  const base = await realpath(root);
  requireThat((await realpath(directory)).startsWith(base + path.sep) || await realpath(directory) === base,
    'export.escape', 'Generated output directory resolves outside the selected root.');
  const temporary = path.join(directory, `.studio-${randomBytes(12).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify(bundle, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
  return { output, modelDigest: bundle.modelDigest, bundleDigest: bundle.bundleDigest,
    origins: bundle.origins.length, facets: bundle.facets.length };
}
