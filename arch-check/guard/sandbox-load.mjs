// Loads one sandbox in this bare node, with no page stubbed (no document, no window), and writes on stdout what it loaded: every file:
// URL the loader took, those a throw stopped at included, since a module's imports are all loaded before any of it runs, and the
// throw's first line. Run by sandbox.mjs as `node sandbox-load.mjs <file>`; it exits as soon as it has written, so a timer the
// sandbox leaves cannot hold it.
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const loaded = new Set();
registerHooks({ load(url, context, next) { if (url.startsWith('file:')) loaded.add(url); return next(url, context); } });
let thrown = null;
try { await import(pathToFileURL(process.argv[2]).href); } catch (error) { thrown = String(error?.message ?? error).split('\n')[0].slice(0, 300); }
process.stdout.write(JSON.stringify({ loaded: [...loaded], thrown }), () => process.exit(0));
