// The README names the calls that changed, in each version's line (row 1093 of Cutkit). A consumer that holds 0.36.0 and takes 0.38.1 reads the lines between them, so a line that says nothing of its calls, or says they
// did not change when they did, costs the consumer a page that draws less than before and says nothing (the API site's Beats result, 0.37.0). The gate asks for the words; whether they are true is the author's, and the types
// of the version are there to be read against them.
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
