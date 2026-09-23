import { createHash } from 'node:crypto';
import { realpath, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export class StudioError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message); this.name = 'StudioError'; this.code = code;
    this.status = status; this.details = details;
  }
}
export function requireThat(condition, code, message, status = 400, details) {
  if (!condition) throw new StudioError(code, message, status, details);
}
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
/** Canonical ordering for request identity, never for generated product-byte hashes. */
export function canonicalJson(value) {
  const sorted = item => Array.isArray(item) ? item.map(sorted)
    : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(k => [k, sorted(item[k])])) : item;
  return JSON.stringify(sorted(value));
}

export const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
export const forbiddenKey = key => ['__proto__', 'prototype', 'constructor'].includes(String(key));

/** Bound untrusted JSON before it reaches any compiler or graph traversal. */
export function boundedJson(text, maxBytes = 8_000_000) {
  requireThat(typeof text === 'string' && Buffer.byteLength(text) <= maxBytes, 'input.size', 'Input exceeds the supported size.');
  let value;
  try { value = JSON.parse(text); } catch { throw new StudioError('input.json', 'Invalid JSON.'); }
  let count = 0;
  function walk(item, depth = 0) {
    requireThat(++count <= 150_000 && depth <= 48, 'input.depth', 'Input is too large or deeply nested.');
    if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
      requireThat(!forbiddenKey(key), 'input.key', `Reserved property '${key}' is not accepted.`);
      walk(child, depth + 1);
    }
  }
  walk(value); return value;
}

export async function safeFile(root, relative, maxBytes = 8_000_000) {
  requireThat(typeof relative === 'string' && relative.length <= 500 && !path.isAbsolute(relative)
    && !relative.includes('\\') && relative.split('/').every(p => p && p !== '..' && p !== '.' && !p.startsWith('.')),
  'path.invalid', 'Select a declared, repository-relative source or artifact path.');
  const base = await realpath(root);
  const candidate = await realpath(path.resolve(base, relative));
  requireThat(candidate.startsWith(base + path.sep), 'path.escape', 'The selected file is outside this workspace.');
  const info = await stat(candidate);
  requireThat(info.isFile() && info.size <= maxBytes, 'input.size', 'File is missing or exceeds the supported size.');
  return { relative, text: await readFile(candidate, 'utf8') };
}

export function semanticDiff(before, after, limit = 250) {
  const changes = [];
  function visit(a, b, at) {
    if (changes.length >= limit || JSON.stringify(a) === JSON.stringify(b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let index = 0; index < Math.max(a.length, b.length); index++) visit(a[index], b[index], [...at, index]);
    } else if (plain(a) && plain(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], [...at, key]);
    } else changes.push({ path: at, before: a ?? null, after: b ?? null });
  }
  visit(before, after, []);
  return { changes, truncated: changes.length >= limit };
}

/** Full-file unified patch; no shell command or temporary worktree is required. */
export function unifiedPatch(file, before, after) {
  requireThat(/^[A-Za-z0-9_./-]+$/.test(file) && !file.split('/').includes('..'), 'patch.path', 'This filename cannot be exported safely as a patch.');
  if (before === after) return '';
  const lines = text => text === '' ? [] : text.replace(/\n$/, '').split('\n');
  const a = lines(before), b = lines(after);
  const rows = [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`,
    `@@ -${a.length ? 1 : 0},${a.length} +${b.length ? 1 : 0},${b.length} @@`];
  a.forEach(line => rows.push('-' + line));
  if (a.length && !before.endsWith('\n')) rows.push('\\ No newline at end of file');
  b.forEach(line => rows.push('+' + line));
  if (b.length && !after.endsWith('\n')) rows.push('\\ No newline at end of file');
  return rows.join('\n') + '\n';
}

/** Stable public errors without a stack or dependency-loader dump. */
export function errorPayload(error) {
  const dependency = ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error?.code);
  return {
    code: dependency ? 'dependency.unavailable' : error?.code ?? 'operation.failed',
    message: dependency ? 'An installed dependency is unavailable. Run npm ci in product-studio, then retry.' : String(error?.message ?? error),
    ...(error?.details === undefined ? {} : { details: error.details }),
  };
}
