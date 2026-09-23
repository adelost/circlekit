import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const roots = ['server.mjs', 'lib', 'public', 'scripts', 'test', 'bin', 'reporters', 'adapter.mjs'];
let count = 0;
async function check(file) {
  if (/\.(mjs|js)$/.test(file)) { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); count++; return; }
  if (file.includes('.')) return;
  for (const entry of await readdir(file, { withFileTypes: true })) await check(path.join(file, entry.name));
}
for (const root of roots) await check(root);
console.log(`Syntax checked: ${count} JavaScript modules.`);
