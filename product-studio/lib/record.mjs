import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { entityKey } from './architecture.mjs';
import { decodeTrace } from './trace.mjs';
import { openHeadlessStudio, selectProject } from './semantic.mjs';
import { boundedJson, requireThat } from './util.mjs';

/** WHAT: Parses one product test command after `--`. WHY: Keeps test execution separate from Studio's read-only commands. */
export function parseRecordArgs(args) {
  const end = args.indexOf('--');
  requireThat(end >= 0 && end < args.length - 1, 'record.command', 'Use record [repository] --product ID -- test command.');
  const options = args.slice(0, end), command = args.slice(end + 1);
  let root = '.', rootSet = false, product = null;
  for (let i = 0; i < options.length; i++) {
    const token = options[i];
    if (token === '--product') {
      requireThat(product === null && options[i + 1] && !options[i + 1].startsWith('-'),
        'record.product', 'Choose exactly one Product Studio workspace ID with --product.');
      product = options[++i];
    } else if (!token.startsWith('-') && !rootSet) { root = token; rootSet = true; }
    else requireThat(false, 'record.option', `Unsupported record option: ${token}`);
  }
  requireThat(product !== null && command[0], 'record.product', 'Choose a workspace product and one test command.');
  return { root, product, command };
}

function eventFor(raw, view) {
  requireThat(raw && typeof raw === 'object' && ['decision', 'transition', 'port'].includes(raw.kind),
    'record.event', 'A test trace contains an unsupported event.');
  if (raw.kind === 'port') {
    const key = entityKey('port', raw.portRef);
    requireThat(view.architecture.entities.some(entity => entity.key === key),
      'record.port', `Recorded port '${raw.portRef}' is absent from the compiled product.`);
    return { kind: 'port', entityKey: key, summary: `Port ${raw.portRef}` };
  }
  const kind = raw.kind === 'decision' ? 'decision-table' : 'machine';
  const facet = view.facets.find(item => item.kind === kind && item.id === raw.facetId);
  requireThat(facet, 'record.facet', `Recorded ${kind} '${raw.facetId}' is absent from the compiled model.`);
  const cell = raw.cellId === null ? null : facet.compiled.cells.find(item => item.id === raw.cellId);
  requireThat(raw.cellId === null || cell, 'record.cell', `Recorded cell '${raw.cellId}' is absent from ${raw.facetId}.`);
  requireThat(raw.kind !== 'decision' || cell, 'record.cell', `Decision '${raw.facetId}' must name its cell.`);
  const logic = raw.kind === 'decision'
    ? { facetId: raw.facetId, cellId: raw.cellId, facts: raw.facts, values: raw.values }
    : { facetId: raw.facetId, cellId: raw.cellId, from: raw.from, to: raw.to, input: raw.input, guards: raw.guards };
  return { kind: raw.kind, entityKey: cell
    ? entityKey('cell', cell.id, `${kind}/${raw.facetId}`) : entityKey('facet', raw.facetId, kind),
  summary: raw.kind === 'decision' ? `${raw.facetId}: ${raw.cellId}` : `${raw.from} → ${raw.to} via ${raw.input}`,
  logic };
}

async function rawEvents(directory) {
  const names = (await readdir(directory)).filter(name => /^(node|kotlin)-[A-Za-z0-9-]+\.jsonl$/u.test(name)).sort();
  const result = [];
  for (const name of names) {
    const text = await readFile(path.join(directory, name), 'utf8');
    requireThat(Buffer.byteLength(text) <= 8_000_000, 'record.size', `Raw test trace ${name} exceeds 8 MB.`);
    for (const line of text.split('\n').filter(Boolean)) result.push(boundedJson(line, 100_000));
  }
  requireThat(result.length > 0, 'record.empty', 'The test command emitted no ProductSpec decisions, transitions or ports.');
  requireThat(result.length <= 20_000, 'record.size', 'The test command emitted more than 20000 trace events.');
  return result;
}

/** WHAT: Runs a focused test and writes one model-bound Studio trace. WHY: Keeps envelope, identity and path ownership in Studio. */
export async function recordTestTrace(args, { cwd = process.cwd(), evaluateContract, stdout = process.stdout } = {}) {
  const input = parseRecordArgs(args);
  const root = path.resolve(cwd, input.root);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'v1d-studio-record-'));
  try {
    const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
    const nodeOptions = [existingNodeOptions, '--conditions=studio-trace'].filter(Boolean).join(' ');
    const status = await new Promise((resolve, reject) => {
      const child = spawn(input.command[0], input.command.slice(1), {
        cwd: root, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions, V1D_STUDIO_TRACE_DIR: directory },
      });
      child.once('error', reject);
      child.once('close', code => resolve(code));
    });
    requireThat(status === 0, 'record.test', `Test command failed with exit ${status}; previous trace was preserved.`);
    const events = await rawEvents(directory);
    const { workbench, projects } = await openHeadlessStudio({ roots: [root], evaluateContract });
    const chosen = selectProject(projects, input.product);
    const view = workbench.view(workbench.require(chosen.key));
    const slug = chosen.id;
    requireThat(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(slug), 'record.product', 'Workspace ID cannot name a conventional trace file.');
    const file = `test-results/${slug}-studio-trace.json`;
    const trace = { kind: 'product-studio-trace', version: 1,
      ...(view.artifactSha256 ? { artifactSha256: view.artifactSha256 } : { modelDigest: view.modelDigest }),
      events: events.map(raw => eventFor(raw, view)) };
    const serialized = JSON.stringify(trace, null, 2) + '\n';
    decodeTrace(serialized, view, { fileName: file });
    const output = path.join(root, file);
    await mkdir(path.dirname(output), { recursive: true });
    const pending = `${output}.${process.pid}.tmp`;
    try { await writeFile(pending, serialized); await rename(pending, output); }
    finally { await rm(pending, { force: true }); }
    stdout.write(JSON.stringify({ ok: true, command: 'record', product: chosen.id, file, events: events.length }) + '\n');
    return 0;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
