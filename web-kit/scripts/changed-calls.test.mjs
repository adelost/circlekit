// The gate of the release reads the README: each version's line ends in the calls that changed (row 1093 of Cutkit). The API site went from 0.36.0 to 0.38.1 on a message that said no call changed, and its Beats result lost its phrase
// lines, since 0.37.0 draws a moment by its shape and colour and no longer by its kind. Run: node --test scripts/changed-calls.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bareTypes, problemWith, publishedTypesBefore, saysNone, typeFilesThatDiffer, typeProblemWith, typesOfTarball, versionsFrom } from './changed-calls.mjs';

const readme = (...lines) => ['# @v1d/web-kit', '', '## Versions', '', ...lines, ''].join('\n');

test('a line that ends in Changed calls: none, or in the calls, passes', () => {
  assert.equal(problemWith(readme('- 0.39.0: a guard. Changed calls: none.'), '0.39.0'), null);
  assert.equal(problemWith(readme('- 0.39.0: a guard. Changed calls: a medium moment with no shape is refused by name in a test and reported once in a page.'), '0.39.0'), null);
});

test('a line with no Changed calls: is refused by its version, and the error says how to write it', () => {
  const problem = problemWith(readme('- 0.38.0: `button` takes a variant.'), '0.38.0');
  assert.match(problem, /0\.38\.0/);
  assert.match(problem, /Changed calls:/);
  assert.match(problem, /none/);
});

test('Changed calls: with nothing after it is refused: the word alone names no call', () => {
  assert.match(problemWith(readme('- 0.39.0: a guard. Changed calls:'), '0.39.0'), /Changed calls:/);
  assert.match(problemWith(readme('- 0.39.0: a guard. Changed calls:   '), '0.39.0'), /Changed calls:/);
});

test('a version with no line, or with two, is refused', () => {
  assert.match(problemWith(readme('- 0.38.1: x. Changed calls: none.'), '0.39.0'), /no line/);
  assert.match(problemWith(readme('- 0.39.0: x. Changed calls: none.', '- 0.39.0: y. Changed calls: none.'), '0.39.0'), /two lines|2 lines/);
});

test('a line of another version does not answer for this one, and 0.3.1 is not 0.39.1', () => {
  assert.match(problemWith(readme('- 0.39.1: x. Changed calls: none.'), '0.39.0'), /no line/);
  assert.match(problemWith(readme('- 0.39.0: x. Changed calls: none.'), '0.39.00'), /no line/);
});

test('a version before 0.36.0 is not asked: its line was written before the rule', () => {
  assert.equal(problemWith(readme('- 0.35.1: no change to the parts.'), '0.35.1'), null);
  assert.equal(problemWith(readme(), '0.9.0'), null);
});

test('the README of the package names the changed calls of every version from 0.36.0 to the version in package.json', () => {
  const text = readFileSync(new URL('../README.md', import.meta.url), 'utf8'), { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const unnamed = versionsFrom(text, '0.36.0', version).map((one) => problemWith(text, one)).filter(Boolean);
  assert.deepEqual(unnamed, []);
  assert.ok(versionsFrom(text, '0.36.0', version).length >= 6, '0.36.0, 0.36.1, 0.36.2, 0.37.0, 0.38.0 and 0.38.1 have a line each');
});

test('versionsFrom lists the versions the README describes between two, oldest first', () => {
  const text = readme('- 0.37.0: a. Changed calls: one.', '- 0.38.0: b. Changed calls: two.', '- 0.38.1: c. Changed calls: none.', '- 0.39.0: d. Changed calls: three.');
  assert.deepEqual(versionsFrom(text, '0.37.0', '0.38.1'), ['0.37.0', '0.38.0', '0.38.1']);
  assert.deepEqual(versionsFrom(text, '0.38.1', '0.39.0'), ['0.38.1', '0.39.0']);
});

// ---- row 1096 of Cutkit: the line is also read against the types. A version whose README line says `Changed calls: none` while its .d.ts files differ from the last published version's is refused,
// the differing files named; a line that lists calls passes whatever differs (a type file is not every changed call, a drawing's look is in none, so the gate asks only where the types say the line is wrong).
// The fixtures are the real .d.ts files of 0.36.2 and 0.37.0 (their published tarballs, the six files that matter), where the Moment type and fullSha changed, served by a fetcher that stands for circlekit.pages.dev.
const REGISTRY = 'https://circlekit.pages.dev/npm/v1d/web-kit';
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const TARBALLS = { '0.36.2': fixture('v1d-web-kit-0.36.2-types.tgz'), '0.37.0': fixture('v1d-web-kit-0.37.0-types.tgz') };
const registry = (versions) => {
  const asked = [];
  const fetcher = async (url) => {
    asked.push(url);
    if (url === `${REGISTRY}/versions.json`) return Buffer.from(JSON.stringify({ latest: versions.at(-1), versions }));
    const hit = /\/([\d.]+)\/v1d-web-kit-\1\.tgz$/.exec(url);
    if (hit && TARBALLS[hit[1]]) return TARBALLS[hit[1]];
    throw new Error(`404 ${url}`);
  };
  return { fetcher, asked };
};
const types = (version) => typesOfTarball(TARBALLS[version]);
const NONE = readme('- 0.37.0: a moment is drawn by its shape. Changed calls: none.');

test('a line that says only none is none, and one that names something is not', () => {
  assert.equal(saysNone(readme('- 0.42.0: a card clips. Changed calls: none.'), '0.42.0'), true);
  assert.equal(saysNone(readme('- 0.42.0: a card clips. Changed calls: None'), '0.42.0'), true);
  assert.equal(saysNone(readme('- 0.36.0: a field. Changed calls: none, `selectField` is new.'), '0.36.0'), false);
  assert.equal(saysNone(readme('- 0.38.0: a wave. Changed calls: no call is removed or renamed. `drawHalfWave` draws bars.'), '0.38.0'), false);
  assert.equal(saysNone(readme('- 0.37.0: a moment. Changed calls: against 0.36.2, (1) a medium moment is drawn by its shape.'), '0.37.0'), false);
  assert.equal(saysNone(readme('- 0.42.0: a card. Changed calls:'), '0.42.0'), false);
  assert.equal(saysNone(readme('- 0.41.0: x. Changed calls: none.'), '0.42.0'), false, 'a line of another version says nothing for this one');
});

test('types differ by what they declare: a comment or the white space is not a changed call, a new or gone file is', () => {
  const was = new Map([['dist/a.d.ts', '/** A card. */\nexport function card(options: { title: string }): HTMLElement;\n'], ['dist/b.d.ts', 'export const tokens: string;\n']]);
  const same = new Map([['dist/a.d.ts', '// the card, as the page draws it\nexport function card(options: {title: string}): HTMLElement;'], ['dist/b.d.ts', 'export   const tokens: string;']]);
  assert.deepEqual(typeFilesThatDiffer(same, was), []);
  assert.equal(bareTypes('export const url = "http://x"; // a comment\n'), 'export const url="http://x";', 'a string that holds // is kept whole');
  assert.notEqual(bareTypes('export const a: "x : y";'), bareTypes('export const a: "x:y";'), 'a space inside a string is part of the type');
  const changed = new Map(was); changed.set('dist/a.d.ts', 'export function card(options: { title: string; footer?: string }): HTMLElement;');
  assert.deepEqual(typeFilesThatDiffer(changed, was), ['dist/a.d.ts']);
  const more = new Map(was); more.set('dist/c.d.ts', 'export const c: 1;');
  assert.deepEqual(typeFilesThatDiffer(more, was), ['dist/c.d.ts'], 'a new file counts');
  const less = new Map(was); less.delete('dist/b.d.ts');
  assert.deepEqual(typeFilesThatDiffer(less, was), ['dist/b.d.ts'], 'a gone file counts');
  assert.deepEqual(typeFilesThatDiffer(new Map([['dist/z.d.ts', 'a'], ['dist/y.d.ts', 'b']]), new Map()), ['dist/y.d.ts', 'dist/z.d.ts'], 'by path');
});

test('the types of a tarball are its dist .d.ts files by their path in the package', () => {
  assert.deepEqual([...types('0.37.0').keys()].sort(), ['dist/index.d.ts', 'dist/kit/file_identity.d.ts', 'dist/mark.d.ts', 'dist/songrow.d.ts', 'dist/songwave.d.ts', 'dist/tokens.d.ts']);
  assert.match(types('0.37.0').get('dist/kit/file_identity.d.ts'), /fullSha/);
});

test('the version before is the highest below it in the catalog, and the catalog or a tarball that cannot be read stops the gate, never passes it', async () => {
  const { fetcher, asked } = registry(['0.36.0', '0.36.1', '0.36.2', '0.37.0']);
  const was = await publishedTypesBefore('0.37.0', { fetcher });
  assert.equal(was.version, '0.36.2');
  assert.deepEqual(asked, [`${REGISTRY}/versions.json`, `${REGISTRY}/0.36.2/v1d-web-kit-0.36.2.tgz`]);
  assert.equal(await publishedTypesBefore('0.36.0', { fetcher: registry(['0.36.0']).fetcher }), null, 'the first version has none before it');
  await assert.rejects(publishedTypesBefore('0.36.1', { fetcher }), /0\.36\.0.*cannot be read|cannot be read.*0\.36\.0/s);
  await assert.rejects(publishedTypesBefore('0.37.0', { fetcher: async () => { throw new Error('ECONNREFUSED'); } }), /versions\.json.*cannot be read|cannot be read.*versions\.json/s);
});

test('a line that says none while the types differ from the last published version is refused, the differing files named', async () => {
  const { fetcher } = registry(['0.36.0', '0.36.1', '0.36.2']);
  const problem = await typeProblemWith(NONE, '0.37.0', types('0.37.0'), { fetcher });
  assert.ok(problem, 'refused');
  for (const file of ['dist/index.d.ts', 'dist/kit/file_identity.d.ts', 'dist/songrow.d.ts', 'dist/songwave.d.ts']) assert.match(problem, new RegExp(file.replace(/[./]/g, '\\$&')));
  assert.doesNotMatch(problem, /dist\/mark\.d\.ts|dist\/tokens\.d\.ts/, 'a file that did not change is not named');
  assert.match(problem, /0\.36\.2/);
  assert.match(problem, /Changed calls:/);
});

test('a line that lists calls passes whatever differs, and asks the registry for nothing', async () => {
  const { fetcher, asked } = registry(['0.36.2']);
  assert.equal(await typeProblemWith(readme('- 0.37.0: a moment. Changed calls: against 0.36.2, a medium moment is drawn by its shape.'), '0.37.0', types('0.37.0'), { fetcher }), null);
  assert.deepEqual(asked, []);
});

test('a line that says none passes when the types are the last published version\'s, and a version before 0.36.0 is not asked', async () => {
  const { fetcher } = registry(['0.36.1', '0.36.2']);
  assert.equal(await typeProblemWith(readme('- 0.36.3: x. Changed calls: none.'), '0.36.3', types('0.36.2'), { fetcher }), null);
  assert.equal(await typeProblemWith(readme('- 0.35.1: no change to the parts.'), '0.35.1', types('0.37.0'), { fetcher: registry([]).fetcher }), null);
});
