// Fills mnemonic-id/ for a release: the npm registry's own tarball of that version (MIT, no dependencies), checked against the registry's integrity
// and unpacked as it is, with SOURCE.json naming the tarball, its integrity and each file's SHA-256. Cutkit names a film it has no name for with it
// (its row 1492), and Cutkit's releases take a package from this address only (its release:row, releasableLock), so the package is served here.
// usage: node scripts/sync-mnemonic-id.mjs --version X.Y.Z      then scripts/publish-mnemonic-id.sh X.Y.Z [--prepare-only]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '../mnemonic-id');
const version = process.argv[process.argv.indexOf('--version') + 1] ?? '';
if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) throw new Error('usage: node scripts/sync-mnemonic-id.mjs --version X.Y.Z');
const dist = JSON.parse(execFileSync('npm', ['view', `mnemonic-id@${version}`, 'dist', '--json'], { encoding: 'utf8' }));
const bytes = Buffer.from(await (await fetch(dist.tarball)).arrayBuffer());
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
if (integrity !== dist.integrity) throw new Error(`${dist.tarball} is not the bytes the registry names (${dist.integrity})`);
const scratch = mkdtempSync(join(tmpdir(), 'mnemonic-id-'));
try {
  writeFileSync(join(scratch, 'package.tgz'), bytes);
  execFileSync('tar', ['-xzf', join(scratch, 'package.tgz'), '-C', scratch]);
  const unpacked = join(scratch, 'package'), manifest = JSON.parse(readFileSync(join(unpacked, 'package.json'), 'utf8'));
  if (manifest.name !== 'mnemonic-id' || manifest.version !== version) throw new Error(`the tarball holds ${manifest.name} ${manifest.version}`);
  if (Object.keys(manifest.dependencies ?? {}).length) throw new Error('mnemonic-id has dependencies now: each would need an address here too');
  const walk = dir => readdirSync(dir).flatMap(name => statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
  const files = walk(unpacked).map(file => relative(unpacked, file)).filter(file => file !== 'package.json').sort();
  for (const name of ['dist', 'LICENSE', 'README.md', 'SOURCE.json']) rmSync(join(here, name), { recursive: true, force: true });
  const sums = files.map(file => {
    cpSync(join(unpacked, file), join(here, file), { recursive: true });
    return { path: file, sha256: createHash('sha256').update(readFileSync(join(unpacked, file))).digest('hex') };
  });
  const published = { ...manifest, files: [...(manifest.files ?? []), 'SOURCE.json'], scripts: { check: 'node scripts/check-dist.mjs' } };
  delete published.devDependencies;
  writeFileSync(join(here, 'package.json'), JSON.stringify(published, null, 2) + '\n');
  writeFileSync(join(here, 'SOURCE.json'), JSON.stringify({ tarball: dist.tarball, integrity, version, files: sums }, null, 1) + '\n');
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: here, stdio: 'ignore' });   // publish-maven.sh runs npm ci before the gate
  console.log(`mnemonic-id ${version} from ${dist.tarball}: ${sums.length} files`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
