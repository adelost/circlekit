// web.mjs: @v1d/arch-check in a browser (Cut row 1880, lint in api.v1d.io's Compare): files given as text, judged by a rule set with the same kinds as
// the node run (rules.mjs, story.mjs) and no node API. TypeScript 5 and ESLint come from the caller, as the node run takes them from the repository's install.
import {judge, matcher, textKinds} from "./rules.mjs";
import {CODE, eslintConfig, eslintRules, readable, storyKinds} from "./story.mjs";

/** The kinds that read files as text; a kind that reads a repository's layout or runs its code (folders, modules, count, contract) needs the node run. */
const kinds = {...textKinds, ...storyKinds};

/** Judges `files` ({path: text}) by `rules` (rule objects as arch.config.json holds them): every hit {rule, file, line, message, weight}, the counts per
 *  rule and file, and the red lines against `baseline` ({}: every hit is red). `ts` is TypeScript 5's compiler API, for the story kinds; `eslint` is
 *  {Linter, parser, plugins} (eslint/universal, @typescript-eslint/parser, plugins by prefix), for eslint rules; `decisions` is arch.decisions.json's list. */
export async function lint({files, rules, ts, eslint, decisions = [], baseline = {}}) {
  const other = rules.filter(rule => !kinds[rule.kind]);
  if (other.length) throw new Error(`the browser reads files as text; ${other.map(rule => `rule ${rule.id} (${rule.kind})`).join(", ")} needs the node run`);
  const names = Object.keys(files).sort(), repo = {root: "/", files: names, config: {rules}, read: file => files[file],
    covered: rule => names.filter(matcher(rule.files)).filter(file => !matcher(rule.exclude)(file)),
    ts: () => ts ?? needs("TypeScript 5's compiler API as ts, for the story kinds"),
    eslint: () => (repo.eslintRun ??= Promise.resolve().then(() => linted(repo, eslint ?? needs("{Linter, parser, plugins} as eslint, for eslint rules")))),
    python: found => found.length ? needs(`python3 for ${found[0]}, which a browser does not have; give Python files to the node run`) : [],
    decisions: () => decisions};
  return judge(kinds, repo, baseline);
}

const needs = what => { throw new Error(`arch-check in the browser needs ${what}`); };

/** One ESLint pass over every file an eslint rule covers, with the config the node run gives ESLint. */
function linted(repo, {Linter, parser, plugins = {}}) {
  const rules = eslintRules(repo.config.rules), files = [...new Set(rules.flatMap(rule => repo.covered(rule)))].filter(file => CODE.test(file));
  const absent = rules.map(rule => rule.rule.includes("/") ? rule.rule.slice(0, rule.rule.lastIndexOf("/")) : null).find(prefix => prefix && !plugins[prefix]);
  if (absent) needs(`the ESLint plugin ${absent} in eslint.plugins`);
  const linter = new Linter({cwd: "/"}), config = [eslintConfig(rules, parser, plugins)];
  return readable(files.map(file => [file, linter.verify(repo.read(file), config, {filename: `/${file}`})]));
}
