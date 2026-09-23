import path from 'node:path';
import { open, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { boundedJson, plain, requireThat, StudioError } from './util.mjs';

export const DEFAULT_STUDIO_PORT = 17317;
export const SEMANTIC_COMMANDS = new Set(['inspect', 'query', 'source', 'simulate', 'scenario', 'trace', 'plan']);
const COMMON = ['workspace', 'product', 'examples', 'pretty', 'expect-model', 'amux-root'];
const SPEC = {
  serve: ['workspace', 'port', 'data-dir', 'allow-git-drafts', 'amux-root', 'live'],
  doctor: ['workspace', 'product', 'examples', 'pretty', 'amux-root'],
  converge: ['workspace', 'product', 'pretty', 'tasks', 'amux-root'],
  review: ['workspace', 'product', 'changed', 'amux-root'],
  contracts: ['product', 'pretty', 'amux-root'],
  export: ['product', 'pretty', 'amux-root'],
  bundle: ['root', 'product', 'compiler-version', 'product-id', 'source-revision', 'facet', 'source', 'output', 'amux-root'],
  inspect: [...COMMON, 'entity', 'search', 'fields', 'max', 'offset'],
  query: [...COMMON, 'kind', 'from', 'to', 'purposes'],
  plan: [...COMMON, 'changed'],
  source: [...COMMON, 'entity'],
  simulate: [...COMMON, 'facet', 'input'],
  scenario: [...COMMON, 'facet', 'file'],
  trace: [...COMMON, 'file', 'cursor', 'entity', 'operation', 'search', 'max', 'offset'],
};
const BOOLEAN = new Set(['examples', 'pretty', 'tasks', 'live']);
const REQUIRED = { query: ['kind', 'from'], source: ['entity'], simulate: ['facet', 'input'], scenario: ['file'], trace: ['file'], bundle: ['compiler-version'] };

/** WHAT: Describes the available Studio commands. WHY: Keeps shell help aligned with its strict parser. */
export const HELP = `Product Studio

  v1d-studio [serve] [repository] [--workspace repository]...
  v1d-studio check [repository] [--product ID] [--pretty]
  v1d-studio contracts [repository] [--amux-root TRUSTED_AMUX]
  v1d-studio doctor [repository] [--product ID]
  v1d-studio converge [repository] [--product ID] [--tasks]
  v1d-studio review [repository] [--product ID] [--changed ENTITY_OR_SOURCE]...
  v1d-studio export [repository] [--product ID]
  v1d-studio record [repository] --product ID [-- TEST_COMMAND [ARGS...]]
  v1d-studio live run --product ID [--port 4317] -- node APP [ARGS...]
  v1d-studio inspect [repository] [--product ID] [--entity KEY | --search TEXT]
  v1d-studio query [repository] --kind upstream|downstream|consumers|owner|impact|path
                   --from KEY [--to KEY] [--purposes data,demand,context]
  v1d-studio plan [repository] [--product ID] --changed ENTITY_OR_SOURCE...
  v1d-studio source [repository] --entity KEY
  v1d-studio simulate [repository] --facet ID --input '{"facts":{...}}'
  v1d-studio simulate [repository] --facet ID --input @step.json
  v1d-studio scenario [repository] --file scenario.json [--facet ID]
  v1d-studio trace [repository] --file trace.json [--cursor N] [--operation ID]
  v1d-studio bundle --root repository --product generated/product.json
                   --compiler-version X.Y.Z [--facet compiled-machine.json]...
                   [--source src/app.ts]... [--output generated/product.studio.json]
  v1d-studio laws [repository] [--product ID] [--kernel-root PACKAGE_DIR] [--output FILE | --stdout]
  v1d-studio junit --input result.xml --source-root TEST_DIR --output test-results/bdd-run.json

Read/debug commands emit one JSON object, except plan and review emit Markdown. None starts HTTP or writes a product.
Repository defaults to the current directory. --examples explicitly loads samples;
use --product workflow-example or amux-fixture. It is never an implicit fallback.
Use --product with a manifest ID or an exact workspace key returned by doctor.
Use --expect-model SHA256 to pin an agent's request to an inspected model.
--pretty indents JSON; --max 1..1000 and --offset N page inspect/trace lists.
--fields key,id,kind selects inspect index fields, not a new graph or policy.
No path is ok:true with found:false; unsupported/needs-facts/failed assertions
are ok:false. A scenario with no assertions is ok:true but unasserted, not proven.
Exit: 0 successful operation; 1 failed/refused operation; 2 invalid command usage.
Converge exits 0 for Converged, 1 for Diverged and 2 for Unknown; --tasks adds one JSON task string per contradiction.
@input and --file paths are relative to the caller's current directory.

Wording validation uses the installed or sibling AMUX grammar. --amux-root
explicitly selects another trusted checkout. The check command refuses when
AMUX is unavailable; serve can still show intent without claiming validation.

Serve only: --port ${DEFAULT_STUDIO_PORT} --data-dir DIR --allow-git-drafts EXACT_REPOSITORY --live
--live enables only the local read-only runtime receiver. Ordinary serve has no runtime socket.
The explicit export command compiles only the selected workspace's authoring
closure and writes its named bundle. The bundle command writes only its named output. Read/debug
commands never build, call providers, create drafts, edit source or modify Git.
See CLI.md for complete examples, identity rules and error handling.
`;

/** Strict, command-specific parsing. Never silently discard misspelled flags. */
export function parseCli(args) {
  const tokens = [...args];
  if(tokens[0]==='check')tokens[0]='contracts';
  if (tokens.includes('--help') || tokens.includes('-h') || tokens[0] === 'help') return { help: true };
  const command = Object.hasOwn(SPEC, tokens[0]) ? tokens.shift() : 'serve';
  const values = Object.create(null), repeated = { workspace: [], facet: [], source: [], changed: [], 'allow-git-drafts': [] }, positional = [];
  const repeatable = new Set(['workspace', ...(command === 'bundle' ? ['facet', 'source'] : []), ...(['plan','review'].includes(command) ? ['changed'] : []), ...(command === 'serve' ? ['allow-git-drafts'] : [])]);
  let optionsEnded = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '--' && !optionsEnded) { optionsEnded = true; continue; }
    if (optionsEnded || !token.startsWith('-')) { positional.push(token); continue; }
    requireThat(token.startsWith('--'), 'cli.usage', `Unknown short option '${token}'. Use --help.`);
    const at = token.indexOf('='), name = token.slice(2, at < 0 ? undefined : at);
    requireThat(SPEC[command].includes(name), 'cli.usage', `Option --${name} is not supported by '${command}'.`);
    if (BOOLEAN.has(name)) {
      requireThat(at < 0 && !Object.hasOwn(values, name), 'cli.usage', `--${name} is a flag and may appear only once.`);
      values[name] = true; continue;
    }
    const value = at >= 0 ? token.slice(at + 1) : tokens[++i];
    requireThat(typeof value === 'string' && value.length > 0 && !value.startsWith('--') && value !== '-h',
      'cli.usage', `Missing value for --${name}.`);
    if (repeatable.has(name)) repeated[name].push(value);
    else { requireThat(!Object.hasOwn(values, name), 'cli.usage', `Duplicate option --${name}.`); values[name] = value; }
  }
  requireThat(positional.length <= 1, 'cli.usage', 'Use one positional repository and --workspace for additional roots.');
  requireThat(repeated.workspace.length <= 15 && repeated.facet.length <= 100 && repeated.source.length <= 256,
    'cli.usage', 'Too many repeated inputs.');
  if (command === 'plan') requireThat(repeated.changed.length >= 1 && repeated.changed.length <= 32,
    'cli.usage', 'Use --changed 1..32 times with exact entity keys or source files.');
  if (command === 'review') requireThat(repeated.changed.length <= 32,
    'cli.usage', 'Use --changed at most 32 times with exact entity keys or source files.');
  for (const key of REQUIRED[command] ?? []) requireThat(values[key] !== undefined, 'cli.usage', `Missing --${key} for ${command}.`);
  const integer = (name, min, max) => {
    if (values[name] === undefined) return;
    requireThat(/^-?\d+$/.test(values[name]), 'cli.usage', `--${name} requires an integer.`);
    const n = Number(values[name]);
    requireThat(Number.isSafeInteger(n) && n >= min && n <= max, 'cli.usage', `--${name} must be between ${min} and ${max}.`);
    values[name] = n;
  };
  integer('port', 0, 65535); integer('cursor', -1, 19999); integer('max', 1, 1000); integer('offset', 0, Number.MAX_SAFE_INTEGER);
  if (command === 'query') {
    requireThat(['upstream', 'downstream', 'consumers', 'owner', 'impact', 'path'].includes(values.kind), 'cli.usage', 'Unknown query kind.');
    requireThat(values.kind === 'path' ? !!values.to : values.to === undefined, 'cli.usage', '--to is required only for a path query.');
  }
  if (values.purposes !== undefined) {
    values.purposes = values.purposes.split(',');
    requireThat(values.purposes.length > 0 && values.purposes.every(v => ['data', 'demand', 'context'].includes(v))
      && new Set(values.purposes).size === values.purposes.length, 'cli.usage', 'Use unique data,demand,context purpose names.');
  }
  if (values.fields !== undefined) {
    values.fields = values.fields.split(',');
    requireThat(values.fields.every(v => ['key','id','kind','label','group','parent','owner'].includes(v))
      && new Set(values.fields).size === values.fields.length, 'cli.usage', 'Unknown or repeated --fields entry.');
  }
  if (command === 'inspect' && values.entity !== undefined) requireThat(['search', 'fields', 'max', 'offset'].every(k => values[k] === undefined),
    'cli.usage', '--entity returns one object; it cannot be combined with index search or pagination.');
  if (command === 'bundle') requireThat(!(values.root && positional.length), 'cli.usage', 'Choose --root or a positional root, not both.');
  return { command, values, repeated, positional };
}

/** User-selected JSON file. Bound the descriptor read, including files growing during the read. */
export async function readJsonInputFile(file, cwd = process.cwd()) {
  requireThat(typeof file === 'string' && file.length > 0 && !file.includes('\0'), 'input.path', 'Select a JSON file.');
  const full = path.resolve(cwd, file), limit = 8_000_000;
  // Refuse pipes/devices before opening them; do not wait forever on a FIFO.
  requireThat((await stat(full)).isFile(), 'input.file', 'Input must be an ordinary JSON file.');
  const handle = await open(full, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    const info = await handle.stat();
    requireThat(info.isFile() && info.size <= limit, 'input.size', 'JSON input exceeds the 8 MB limit.');
    const bytes = Buffer.alloc(limit + 1); let used = 0;
    while (used < bytes.length) {
      const { bytesRead } = await handle.read(bytes, used, bytes.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    requireThat(used <= limit, 'input.size', 'JSON input exceeds the 8 MB limit.');
    return boundedJson(bytes.subarray(0, used).toString('utf8'));
  } finally { await handle.close(); }
}

export async function executeSemanticCli(parsed, { cwd = process.cwd() } = {}) {
  const { command, values: v, repeated, positional } = parsed;
  const { openHeadlessStudio, selectProject, SemanticStudio } = await import('./semantic.mjs');
  const roots = [...positional, ...repeated.workspace].map(r => path.resolve(cwd, r));
  if (!roots.length && !v.examples) roots.push(cwd);
  const evaluateContract = v['amux-root'] ? await (await import('./documentation.mjs')).loadContractEvaluator(path.resolve(cwd,v['amux-root'])) : undefined;
  const session = await openHeadlessStudio({ roots, examples: !!v.examples, evaluateContract });
  const chosen = selectProject(session.projects, v.product);
  const service = new SemanticStudio(session.workbench, chosen.key, { expectModel: v['expect-model'] });
  const options = { entity: v.entity, search: v.search, fields: v.fields, max: v.max, offset: v.offset,
    kind: v.kind, from: v.from, to: v.to, purposes: v.purposes, facetId: v.facet,
    cursor: v.cursor, operationId: v.operation, changed: repeated.changed };
  if (command === 'simulate') {
    options.input = v.input.startsWith('@') ? await readJsonInputFile(v.input.slice(1), cwd) : boundedJson(v.input);
    requireThat(plain(options.input), 'input.shape', 'Simulation input must be a JSON object.');
  }
  if (command === 'scenario') options.document = await readJsonInputFile(v.file, cwd);
  if (command === 'trace') { options.text = JSON.stringify(await readJsonInputFile(v.file, cwd)); options.fileName = v.file; }
  return service.execute(command, options);
}

/** Output budget never silently trims a path, diagnostic or outcome. */
export function formatJson(value, pretty = false) {
  const text = JSON.stringify(value, null, pretty ? 2 : undefined);
  requireThat(typeof text === 'string' && Buffer.byteLength(text) <= 8_000_000,
    'output.size', 'Result exceeds 8 MB. Narrow the selection or page the inspect/trace list.');
  return text + '\n';
}
