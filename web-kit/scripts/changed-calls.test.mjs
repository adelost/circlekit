// The gate of the release reads the README: each version's line ends in the calls that changed (row 1093 of Cutkit). The API site went from 0.36.0 to 0.38.1 on a message that said no call changed, and its Beats result lost its phrase
// lines, since 0.37.0 draws a moment by its shape and colour and no longer by its kind. Run: node --test scripts/changed-calls.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { problemWith, versionsFrom } from './changed-calls.mjs';

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
