// report.mjs: code health's reading of one commit (Cut row 1877), which dash.v1d.io shows per repo: each rule's total and biggest entries in the
// baseline, the files within NEAR lines of a max-lines limit, the entries that grew since the commit a day older with the decision that allows each, and
// every decision's key with its until. It reads the commit from git, never the disk: what is pushed is what counts, and a cron needs no checkout.
import {execFileSync} from "node:child_process";
import {codeLineCount, lineCount, matcher} from "./rules.mjs";
import {SKIPPED} from "./repo-node.mjs";

/** A file this many lines under its max-lines limit, or closer, is near it: 148 to 150 under 150, as an editor numbers them (lineCount). The max-lines
 *  kind also counts the empty piece after the last newline, so a near file at the limit can be one over it and in the baseline (Cut's evidence.ts at
 *  b0a1514bc: 150 lines, K22 1). */
export const NEAR = 2;
const TOP = 10, DAY_MS = 24 * 3600e3;

/** The report of commit `rev` in the git repository at root, named `repo`. grew compares with `since`, by default the last commit on rev's first-parent
 *  line from a day before `now` (none: grew is empty, since null): an entry higher than there, or new, of a rule `since` had; a rule added since then has
 *  its first baseline, which dash shows as new. A total is the rule's sum in the baseline; a report rule has none. */
export function reportOf(root, {rev = "HEAD", since, repo = null, now = new Date()} = {}) {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], {encoding: "utf8", maxBuffer: 1 << 28}).trim();
  const sha = git("rev-parse", "--verify", `${rev}^{commit}`);
  const before = since ? git("rev-parse", "--verify", `${since}^{commit}`) : git("rev-list", "-1", "--first-parent", `--before=${new Date(now - DAY_MS).toISOString()}`, sha) || null;
  const [configText] = blobs(root, [`${sha}:arch.config.json`]);
  if (configText === undefined) throw new Error(`${repo ?? root} has no arch.config.json at ${sha.slice(0, 9)}`);
  const config = JSON.parse(configText), baselineFile = config.baseline ?? "arch.baseline.json";
  const [baselineText, decisionsText, beforeText, beforeConfig] = blobs(root, [`${sha}:${baselineFile}`, `${sha}:arch.decisions.json`,
    ...(before ? [`${before}:${baselineFile}`, `${before}:arch.config.json`] : [])]);
  const baseline = JSON.parse(baselineText ?? "{}"), decisions = JSON.parse(decisionsText ?? "[]"), then = before && JSON.parse(beforeText ?? "{}");
  const had = new Set(JSON.parse(beforeConfig ?? '{"rules": []}').rules.map(rule => rule.id));
  const files = git("ls-tree", "-r", "-z", sha).split("\0").filter(entry => entry.split(" ")[1] === "blob")
    .map(entry => entry.slice(entry.indexOf("\t") + 1)).filter(file => !file.split("/").some(part => SKIPPED.has(part)));
  const sized = config.rules.filter(rule => rule.kind === "max-lines").map(rule => [rule, files.filter(matcher(rule.files)).filter(file => !matcher(rule.exclude)(file))]);
  const read = [...new Set(sized.flatMap(([, covered]) => covered))], texts = new Map(blobs(root, read.map(file => `${sha}:${file}`)).map((text, i) => [read[i], text]));
  const granted = decisions.flatMap(d => Object.entries(d.ceilings ?? {}).map(([key, n]) => ({key, n, who: d.who ?? null, when: d.when ?? null, until: d.until ?? null})));
  return {repo, sha, at: now.toISOString(), since: before,
    rules: config.rules.map(rule => {
      const mine = Object.entries(baseline).filter(([key]) => key.startsWith(`${rule.id}:`)).sort(([, a], [, b]) => b - a);
      return {id: rule.id, name: rule.name ?? null, what: rule.what ?? null, why: rule.why ?? null, fix: rule.fix ?? null,
        total: rule.report ? null : mine.reduce((sum, [, n]) => sum + n, 0), top: mine.slice(0, TOP).map(([key, n]) => ({key, n}))};
    }),
    near: sized.flatMap(([rule, covered]) => covered.map(file => ({file,
      lines: rule.count === "code" ? codeLineCount(texts.get(file), file) : lineCount(texts.get(file)), limit: rule.max})))
      .filter(one => one.lines <= one.limit && one.lines >= one.limit - NEAR).sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file)),
    grew: !then ? [] : Object.entries(baseline).filter(([key, n]) => had.has(key.slice(0, key.indexOf(":"))) && n > (then[key] ?? 0)).map(([key, to]) => {
      const by = granted.findLast(one => one.key === key && one.n >= to);
      return {key, from: then[key] ?? 0, to, decision: by ? {who: by.who, when: by.when, until: by.until} : null};
    }),
    decisions: decisions.flatMap(d => [...Object.keys(d.ceilings ?? {}), ...Object.keys(d.allows ?? {})].map(key => ({key, until: d.until ?? null})))};
}

/** The text of each `rev:path` in one git cat-file run, undefined for one the commit does not have. */
function blobs(root, specs) {
  if (!specs.length) return [];
  const out = execFileSync("git", ["-C", root, "cat-file", "--batch"], {input: specs.join("\n") + "\n", maxBuffer: 1 << 30}), texts = [];
  for (let at = 0, i = 0; i < specs.length; i++) {
    const end = out.indexOf(10, at), head = out.toString("utf8", at, end);
    if (head.endsWith(" missing")) { texts.push(undefined); at = end + 1; continue; }
    const size = Number(head.split(" ")[2]);
    texts.push(out.toString("utf8", end + 1, end + 1 + size)); at = end + 2 + size;
  }
  return texts;
}
