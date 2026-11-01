// The README names the calls that changed, in each version's line (row 1093 of Cutkit). A consumer that holds 0.36.0 and takes 0.38.1 reads the lines between them, so a line that says nothing of its calls, or says they
// did not change when they did, costs the consumer a page that draws less than before and says nothing (the API site's Beats result, 0.37.0). The gate asks for the words; whether they are true is the author's, and the types
// of the version are there to be read against them. Row 1096: where the types say the words are wrong, the gate says so: a line that says `Changed calls: none` while a .d.ts file of dist differs from the last published
// version's is refused, the file named. A type file is not every changed call (a drawing's look is in none, a comment is no call), so a line that lists calls passes whatever differs: the gate asks only where the types contradict "none".
import { gunzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REGISTRY = 'https://circlekit.pages.dev/npm/v1d/web-kit';   // the catalog (versions.json) and each version's tarball, the cumulative registry the consumers install from
const FROM = [0, 36, 0];   // the lines before this one were written before the rule

const numbers = (version) => version.split('.').map(Number);
const before = (a, b) => { const [x, y] = [numbers(a), numbers(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };

/** The README's lines of one version: `- X.Y.Z: ...`. */
const linesOf = (readme, version) => readme.split('\n').filter((line) => line.startsWith(`- ${version}:`));

/** The versions the README describes from `from` to `to`, both included, oldest first. */
export function versionsFrom(readme, from, to) {
  const all = [...readme.matchAll(/^- (\d+\.\d+\.\d+):/gm)].map((one) => one[1]);
  return [...new Set(all)].filter((one) => !before(one, from) && !before(to, one)).sort((a, b) => (before(a, b) ? -1 : before(b, a) ? 1 : 0));
}

/** What stops a release of `version`, in words that say the fix, or null: its README line ends in `Changed calls:` and then `none.` or each call that changed (the part, its call as it is now, what a caller does). */
export function problemWith(readme, version) {
  if (before(version, FROM.join('.'))) return null;
  const lines = linesOf(readme, version);
  if (lines.length === 0) return `README.md has no line "- ${version}:": write one for the version, ending in "Changed calls: none." or in the calls that changed`;
  if (lines.length > 1) return `README.md has ${lines.length} lines for ${version}: a version is one line`;
  const said = lines[0].split('Changed calls:').slice(1).join('Changed calls:').trim();
  if (!said) return `the README line of ${version} does not say "Changed calls:" and what they are: end it with "Changed calls: none." or with each call that changed (the part, its call as it is now, and what a caller does)`;
  return null;
}

/** Whether the version's line says that no call changed: what follows `Changed calls:` is `none` and punctuation, nothing else. "none, `selectField` is new." names a call and says no such thing. */
export function saysNone(readme, version) {
  const lines = linesOf(readme, version);
  if (lines.length !== 1) return false;
  return /^none\W*$/i.test(lines[0].split('Changed calls:').slice(1).join('Changed calls:').trim());
}

/** A type file as the gate compares it: its comments and the white space between its tokens left out (`{ a: 1 }` is `{a:1}`), so a change of words about a call is not a changed call; a string is kept whole, a `//` or a space in it counts. */
export function bareTypes(text) {
  const strings = [];
  let out = '';
  for (let at = 0; at < text.length;) {
    const here = text[at], two = text.slice(at, at + 2);
    if (here === '"' || here === "'" || here === '`') {
      let end = at + 1;
      while (end < text.length && text[end] !== here) end += text[end] === '\\' ? 2 : 1;
      out += `\u0000${strings.push(text.slice(at, end + 1)) - 1}\u0000`; at = end + 1;
    } else if (two === '//') { const end = text.indexOf('\n', at); at = end < 0 ? text.length : end; }
    else if (two === '/*') { const end = text.indexOf('*/', at + 2); at = end < 0 ? text.length : end + 2; out += ' '; }
    else { out += here; at += 1; }
  }
  return out.replace(/\s+/g, ' ').replace(/ ?([{}()[\]<>:;,=|&?.\u0000]) ?/g, '$1').trim().replace(/\u0000(\d+)\u0000/g, (_, n) => strings[n]);
}

/** The type files that differ between two versions' types (a Map of the path in the package to the text, each), by path, sorted. A file only one of them has counts as differing. */
export function typeFilesThatDiffer(now, was) {
  const paths = new Set([...now.keys(), ...was.keys()]);
  return [...paths].filter((path) => !now.has(path) || !was.has(path) || bareTypes(now.get(path)) !== bareTypes(was.get(path))).sort();
}

/** The .d.ts files of a package directory's dist, by their path in the package ("dist/index.d.ts"). */
export function typesOfDir(dist = 'dist') {
  const found = new Map();
  const walk = (dir, prefix) => { for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, `${prefix}${name}/`); else if (name.endsWith('.d.ts')) found.set(`${prefix}${name}`, readFileSync(path, 'utf8'));
  } };
  walk(dist, 'dist/');
  return found;
}

/** The .d.ts files of a published tarball (a gzipped tar: npm's `package/dist/...`), by their path in the package. Only the ustar header fields are read; a path of dist is short, so no extended header is needed. */
export function typesOfTarball(gz) {
  const tar = gunzipSync(gz), found = new Map();
  for (let at = 0; at + 512 <= tar.length;) {
    const header = tar.subarray(at, at + 512);
    if (header.every((byte) => byte === 0)) break;
    const field = (from, to) => header.toString('utf8', from, to).replace(/\0[\s\S]*$/, '');
    const size = parseInt(field(124, 136).trim() || '0', 8), kind = field(156, 157), prefix = field(345, 500);
    const name = `${prefix ? `${prefix}/` : ''}${field(0, 100)}`, body = at + 512;
    if ((kind === '0' || kind === '') && /^package\/dist\/.+\.d\.ts$/.test(name)) found.set(name.slice('package/'.length), tar.toString('utf8', body, body + size));
    at = body + Math.ceil(size / 512) * 512;
  }
  return found;
}

const readUrl = async (url) => {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`${answer.status} ${answer.statusText}`.trim());
  return Buffer.from(await answer.arrayBuffer());
};

/** The last published version below `version`, with its types: the highest in the catalog under it, read from the registry through `fetcher` (a url to its bytes; the default is the network), or null when there is none.
 *  What cannot be read stops the gate: a version is never passed because the registry did not answer. */
export async function publishedTypesBefore(version, { fetcher = readUrl } = {}) {
  const read = async (url, what) => {
    try { return await fetcher(url); }
    catch (error) { throw new Error(`${what} cannot be read (${url}: ${error.message}): the release is compared with the last published version's types and does not pass without them, so run it with the network`); }
  };
  const catalog = JSON.parse((await read(`${REGISTRY}/versions.json`, 'the catalog of published versions')).toString('utf8'));
  const below = (catalog.versions ?? []).filter((one) => before(one, version)).sort((a, b) => (before(a, b) ? -1 : before(b, a) ? 1 : 0));
  const was = below.at(-1);
  if (!was) return null;
  return { version: was, types: typesOfTarball(await read(`${REGISTRY}/${was}/v1d-web-kit-${was}.tgz`, `the tarball of ${was}`)) };
}

/** What stops a release of `version` where its types contradict its line, or null: the line says only `Changed calls: none` while a type file of `types` (typesOfDir) differs from the last published version's. The registry is asked
 *  only for such a line; one that lists calls passes whatever differs, and so does a version before the rule (0.36.0). */
export async function typeProblemWith(readme, version, types, { fetcher } = {}) {
  if (before(version, FROM.join('.')) || !saysNone(readme, version)) return null;
  const was = await publishedTypesBefore(version, { fetcher });
  if (!was) return null;
  const differing = typeFilesThatDiffer(types, was.types);
  return differing.length
    ? `the README line of ${version} says "Changed calls: none", but the types differ from ${was.version}, the last published version, in ${differing.join(', ')}: list in the line each call that changed (the part, its call as it is now, and what a caller does), or put the types back`
    : null;
}
