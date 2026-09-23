import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { Workbench } from './lib/workspaces.mjs';
import { StudioError, boundedJson, requireThat } from './lib/util.mjs';
import { KERNEL_VERSION } from './lib/kernel.mjs';
import { LiveSessionHub } from './lib/live.mjs';
import { DEFAULT_STUDIO_PORT } from './lib/cli.mjs';

const publicRoot = fileURLToPath(new URL('./public/', import.meta.url));
export async function createServer({ roots = [], gitDraftRoots = [], dataDir = path.join(os.homedir(), '.local/state/product-studio'), port = DEFAULT_STUDIO_PORT, evaluateContract, liveEnabled = false, liveNow } = {}) {
  const authorized = await Promise.all(gitDraftRoots.map(root => realpath(root)));
  const app = new Workbench({ dataDir, gitDraftRoots: authorized, evaluateContract }); await app.initialize(roots, { includeFixtures: roots.length === 0 });
  const live = liveEnabled ? new LiveSessionHub(app, { now: liveNow }) : null;
  const token = randomBytes(32).toString('hex');
  let origin = '', inFlight = 0;
  const server = http.createServer(async (req, res) => {
    const headers = {
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    };
    const send = (status, value) => { const text = JSON.stringify(value);
      requireThat(Buffer.byteLength(text) <= 40_000_000, 'output.size', 'Response exceeds the transport budget. Narrow the selection.', 413);
      res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' }); res.end(text); };
    let acquired = false;
    try {
      requireThat(req.headers.host === new URL(origin).host, 'http.host', 'Unrecognized local host.', 403);
      if (req.headers.origin) requireThat(req.headers.origin === origin, 'http.origin', 'Cross-origin requests are disabled.', 403);
      requireThat(req.headers['sec-fetch-site'] !== 'cross-site', 'http.origin', 'Cross-site requests are disabled.', 403);
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/bootstrap' && req.method === 'GET') return send(200, { token, kernelVersion: KERNEL_VERSION, projects: app.list(), sourceWrites: false, externalCalls: false });
      if (url.pathname.startsWith('/api/')) {
        requireThat(req.headers['x-studio-token'] === token, 'http.token', 'A current local Studio session is required.', 403);
        requireThat(inFlight < 4, 'http.busy', 'The workbench is busy. Retry this operation.', 429);
        inFlight++; acquired = true;
        if (req.method === 'GET') {
          if (url.pathname === '/api/projects') return send(200, app.list());
          if (url.pathname === '/api/project') return send(200, url.searchParams.get('mode') === 'summary' ? app.summary(app.require(url.searchParams.get('id'))) : app.view(app.require(url.searchParams.get('id'))));
          if (url.pathname === '/api/live-status' && live) { const project = url.searchParams.get('project'); app.require(project); return send(200, live.status(project)); }
          if (url.pathname === '/api/scenarios') return send(200, await app.scenarios());
          if (url.pathname === '/api/drafts') return send(200, await app.savedDrafts());
          if (url.pathname === '/api/draft') return send(200, await app.savedDraft(url.searchParams.get('id')));
          throw new StudioError('http.route', 'Unknown read operation.', 404);
        }
        requireThat(req.method === 'POST' && req.headers['content-type']?.startsWith('application/json'), 'http.method', 'Use an explicit JSON operation.', 405);
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; requireThat(size <= 10_000_000, 'input.size', 'Request body is too large.', 413); chunks.push(chunk); }
        const body = boundedJson(Buffer.concat(chunks).toString('utf8'), 10_000_000);
        let value;
        switch (url.pathname) {
          case '/api/live-ticket': requireThat(live, 'live.disabled', 'Start Studio with --live to enable the local receiver.', 404);
            value = live.issueTicket(body); break;
          case '/api/documentation': value = app.documentation(body); break;
          case '/api/source': value = app.sourceText(body); break;
          case '/api/entity': value = app.entityDetails(body); break;
          case '/api/interface': value = app.interfaceDetails(body); break;
          case '/api/search': value = app.search(body); break;
          case '/api/changes': value = await app.changes(body); break;
          case '/api/compare': value = app.compare(body); break;
          case '/api/trace-page': value = app.tracePage(body); break;
          case '/api/trace-export': { const {p} = app.checkedView(body); requireThat(p.trace && p.trace.traceDigest === body.traceDigest, 'trace.identity', 'Select the exact loaded trace.'); value = p.trace; break; }

          case '/api/save-scenario': value = await app.saveScenario(body); break;
          case '/api/open-scenario': value = await app.openScenario(body); break;
          case '/api/query': value = app.query(body); break;
          case '/api/trace': value = app.importTrace(body); break;
          case '/api/trace-frame': value = app.traceFrame(body); break;
          case '/api/reload': { app.checkedView(body); const v = await app.refresh(body.project, { automatic: body.automatic === true }); value = body.summary ? app.summary(app.require(v.key)) : v; break; }
          case '/api/import': value = await app.importArtifact(body); break;
          case '/api/import-source': value = await app.importSource(body); break;
          case '/api/evaluate': value = app.evaluate(body); break;
          case '/api/table': value = app.table(body); break;
          case '/api/scenario': value = app.scenario(body); break;
          case '/api/mocks': value = app.mocks(body); break;
          case '/api/propose': value = await app.propose(body); break;
          case '/api/save-git-draft': value = await app.saveGitDraft(body.id); break;
          case '/api/save-draft': value = await app.saveDraft(body.id); break;
          case '/api/snapshot': value = app.snapshot(body); break;
          default: throw new StudioError('http.route', 'Unknown operation.', 404);
        }
        if (body.summary && ['/api/import','/api/import-source','/api/trace','/api/snapshot'].includes(url.pathname) && value?.key) value = app.summary(app.require(value.key));
        return send(200, value);
      }
      requireThat(req.method === 'GET', 'http.method', 'Method not allowed.', 405);
      const routes = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/graph.js': ['graph.js', 'text/javascript'], '/studio-tools.js': ['studio-tools.js', 'text/javascript'], '/dom.js': ['dom.js', 'text/javascript'], '/experience.js': ['experience.js', 'text/javascript'], '/documentation.js': ['documentation.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
      requireThat(routes[url.pathname], 'http.route', 'Not found.', 404);
      const [file, mime] = routes[url.pathname];
      res.writeHead(200, { ...headers, 'Content-Type': mime + '; charset=utf-8' }); res.end(await readFile(path.join(publicRoot, file)));
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      const known = error instanceof StudioError;
      send(known ? error.status : 400, { error: { code: error.code ?? 'operation.failed', message: known || !error.code ? error.message : 'Local operation failed. Check the terminal for details.', details: error.details } });
      if (!known && error.code) console.error(error);
    } finally { if (acquired) inFlight--; }
  });
  server.requestTimeout = 15_000; server.headersTimeout = 10_000; server.maxHeadersCount = 40;
  if (live) server.on('upgrade', (request, socket, head) => live.upgrade(request, socket, head));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  server.on('close', () => live?.close());
  return { server, origin, token, app, live };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const roots = [], gitDraftRoots = []; let port = DEFAULT_STUDIO_PORT, dataDir, liveEnabled = false;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--workspace') { requireThat(args[i + 1], 'cli.argument', '--workspace requires a path.'); roots.push(path.resolve(args[++i])); }
    else if (args[i] === '--allow-git-drafts') { requireThat(args[i + 1], 'cli.argument', '--allow-git-drafts requires an exact repository path.'); gitDraftRoots.push(path.resolve(args[++i])); }
    else if (args[i] === '--port') port = Number(args[++i]);
    else if (args[i] === '--data-dir') dataDir = path.resolve(args[++i]);
    else if (args[i] === '--live') liveEnabled = true;
    else if (args[i] === '--help') { console.log(`npm start -- [--workspace /path/to/repo]... [--port ${DEFAULT_STUDIO_PORT}] [--data-dir /path] [--allow-git-drafts /exact/repo] [--live]\nLoopback only. Sources are read-only; drafts are stored separately. --live enables the optional observation receiver.`); process.exit(0); }
    else throw new StudioError('cli.argument', `Unknown option: ${args[i]}`);
  }
  requireThat(Number.isInteger(port) && port >= 0 && port <= 65535, 'cli.port', 'Invalid port.');
  const { origin } = await createServer({ roots, port, dataDir, gitDraftRoots, liveEnabled });
  console.log(`Product Studio: ${origin}\nProductSpec ${KERNEL_VERSION}; source inspection + pure logic simulation.\nWorking-tree writes: disabled. Git draft branches: ${gitDraftRoots.length ? 'explicitly enabled for selected roots' : 'disabled'}. External requests: disabled.\nAdd repositories with --workspace. Ctrl+C stops the workbench.`);
}
