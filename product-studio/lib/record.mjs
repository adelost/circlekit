import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eventFor } from './observation.mjs';
import { decodeTrace } from './trace.mjs';
import { openHeadlessStudio, selectProject } from './semantic.mjs';
import { boundedJson, requireThat } from './util.mjs';

/** WHAT: Parses one product test command after `--`. WHY: Keeps test execution separate from Studio's read-only commands. */
export function parseRecordArgs(args) {
  const end = args.indexOf('--');
  requireThat(end < 0 || end < args.length - 1, 'record.command', 'Use -- TEST_COMMAND or omit -- for the workspace recordCommand.');
  const options = end < 0 ? args : args.slice(0, end), command = end < 0 ? [] : args.slice(end + 1);
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
  requireThat(product !== null, 'record.product', 'Choose one workspace product with --product ID.');
  return { root, product, command };
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

/** WHAT: Builds one model-bound Studio trace from a focused test. WHY: Keeps envelope, identity and path ownership in Studio. */
export async function recordTestTrace(args, { cwd = process.cwd(), evaluateContract, stdout = process.stdout } = {}) {
  const input = parseRecordArgs(args);
  const root = path.resolve(cwd, input.root);
  let command = input.command;
  if (!command.length) {
    const { workbench, projects } = await openHeadlessStudio({ roots: [root], evaluateContract });
    const selected = selectProject(projects, input.product);
    command = workbench.require(selected.key).config.recordCommand;
    requireThat(command, 'record.command', `No recordCommand for ${selected.id}. Add it to studio.workspace.json or pass -- test command.`);
  }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'v1d-studio-record-'));
  try {
    const existingNodeOptions = process.env.NODE_OPTIONS ?? '';
    const nodeOptions = [existingNodeOptions, '--conditions=studio-trace'].filter(Boolean).join(' ');
    const status = await new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
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
