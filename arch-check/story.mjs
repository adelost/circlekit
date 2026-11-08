// story.mjs: the kinds that keep code reading as a story (Cut row 1873, Mattias 8 Nov via sandman:0): short functions with the main steps on top,
// the helpers below. `eslint` counts one ESLint rule per file; `first-line` asks each file's first line to say what the file is for; `story-order`
// asks a file that exports inline to put its exports above its private helpers. ESLint, its TypeScript parser and the plugins come from the
// repository, as TypeScript does for the guard's reader: this package keeps no dependency.
import {createRequire, Module} from "node:module";
import {join, relative, sep} from "node:path";

const CODE = /\.(js|mjs|cjs|ts|tsx|mts|cts)$/;
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "do", "else", "try", "with", "function", "new", "await", "typeof"]);
const PLUGINS = {"@typescript-eslint": load => load("typescript-eslint").plugin, sonarjs: load => load("eslint-plugin-sonarjs")};

export const storyKinds = {
  /** {rule, options?}: the ESLint rule's breaches per file, each with the function it names; every eslint rule of the config runs in one ESLint pass. */
  eslint: async (rule, repo) => {
    const byFile = await linted(repo), mine = new Set(repo.covered(rule));
    return [...byFile].filter(([file]) => mine.has(file)).flatMap(([file, messages]) => messages.filter(m => m.ruleId === rule.rule)
      .map(m => ({file, line: m.line, message: `${m.message.replace(/\.$/, "")}${functionAt(repo.read(file), m.line, m.message)}`})));
  },
  /** The first line (after a shebang) is a one-line comment on what the file is for. */
  "first-line": (rule, repo) => repo.covered(rule).flatMap(file => oneLineComment(repo.read(file)) ? []
    : [{file, line: 1, message: "the first line is not a one-line comment on what the file is for"}]),
  /** A file that exports inline (export function, export const) keeps its exports above its private helpers; a file that exports by a list is
   *  left alone, the list being its table of contents. Each helper above the last export is one hit, named. */
  "story-order": (rule, repo) => {
    const ts = typescriptOf(repo.root);
    return repo.covered(rule).filter(file => CODE.test(file)).flatMap(file => helpersAbove(ts, file, repo.read(file))
      .map(({name, line, last}) => ({file, line, message: `private helper ${name} stands above the last export (line ${last}); move it below that export`})));
  },
};

/** The rule's message names its function when ESLint's does not (a cognitive complexity, a depth): the declaration on the reported line. */
function functionAt(text, line, message) {
  if (/'[^']+'/.test(message)) return "";
  const code = text.split("\n")[line - 1] ?? "";
  const name = /function\*?\s+([\w$]+)/.exec(code)?.[1] ?? /([\w$]+)\s*[:=]\s*(?:async\s*)?(?:function\b|\(|[\w$]+\s*=>)/.exec(code)?.[1]
    ?? /^\s*(?:async\s+|static\s+|get\s+|set\s+)*([\w$]+)\s*\(/.exec(code)?.[1];
  return name && !KEYWORDS.has(name) ? ` (in ${name})` : "";
}

function oneLineComment(text) {
  const first = text.replace(/^#!.*\n/, "").split("\n")[0].trim();
  return /^\/\/.*\S/.test(first) && first !== "//" || /^\/\*.*\*\/$/.test(first);
}

function helpersAbove(ts, file, text) {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const listed = src.statements.some(s => (ts.isExportDeclaration(s) && !s.moduleSpecifier) || (ts.isExportAssignment(s) && ts.isIdentifier(s.expression)));
  if (listed) return [];
  const inline = s => ts.canHaveModifiers(s) && (ts.getModifiers(s) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  const helper = s => ts.isFunctionDeclaration(s) ? s.name?.text : ts.isVariableStatement(s)
    ? s.declarationList.declarations.find(d => d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)))?.name.getText(src) : undefined;
  const statements = [...src.statements], at = statements.findLastIndex(inline);
  if (at < 0) return [];
  const lineOf = s => src.getLineAndCharacterOfPosition(s.getStart(src)).line + 1, last = lineOf(statements[at]);
  return statements.slice(0, at).filter(s => !inline(s)).flatMap(s => { const name = helper(s); return name ? [{name, line: lineOf(s), last}] : []; });
}

/** One ESLint pass over every file an eslint rule covers, kept on the run: a map of each file to its messages. A file ESLint cannot parse stops the
 *  run (the rules cannot judge it); name it in the rule's exclude if it is meant to be so. ARCH_CACHE_DIR keeps ESLint's cache by content. */
function linted(repo) {
  repo.eslintRun ??= (async () => {
    const rules = repo.config.rules.filter(r => r.kind === "eslint");
    const files = [...new Set(rules.flatMap(r => repo.covered(r)))].filter(file => CODE.test(file));
    if (!files.length) return new Map();
    const load = createRequire(join(repo.root, "package.json")), {ESLint} = load("eslint");
    typescriptOf(repo.root);   // the parser asks for typescript; on 7.x it is given typescript-5
    const prefixes = [...new Set(rules.map(r => r.rule.includes("/") ? r.rule.slice(0, r.rule.lastIndexOf("/")) : null).filter(Boolean))];
    const plugins = Object.fromEntries(prefixes.map(p => [p, PLUGINS[p] ? PLUGINS[p](load) : load(`eslint-plugin-${p}`)]));
    const cache = process.env.ARCH_CACHE_DIR;
    const eslint = new ESLint({cwd: repo.root, overrideConfigFile: true, ignore: false, ...(cache ? {cache: true, cacheStrategy: "content", cacheLocation: join(cache, "eslint/")} : {}),
      overrideConfig: [{files: ["**/*.{js,mjs,cjs,ts,tsx,mts,cts}"], linterOptions: {noInlineConfig: true, reportUnusedDisableDirectives: "off"},
        languageOptions: {parser: load("typescript-eslint").parser, ecmaVersion: "latest", sourceType: "module"}, plugins,
        rules: Object.fromEntries(rules.map(r => [r.rule, r.options === undefined ? "error" : ["error", r.options]]))}]});
    const results = await eslint.lintFiles(files);
    const broken = results.flatMap(r => r.messages.filter(m => m.fatal || (!m.ruleId && /ignored/i.test(m.message))).map(m => `${relative(repo.root, r.filePath)}:${m.line} ${m.message}`));   // a file skipped is no pass
    if (broken.length) throw new Error(`ESLint cannot read ${broken.length} file(s): ${broken.slice(0, 5).join("; ")}`);
    return new Map(results.map(r => [relative(repo.root, r.filePath).split(sep).join("/"), r.messages]));
  })();
  return repo.eslintRun;
}

/** TypeScript 5's compiler API from the repository: `typescript-5` (an alias beside a newer typescript) or `typescript`. On TypeScript 7, which has
 *  none, the typescript every later require asks for (the ESLint parser's) is resolved to typescript-5 for this process. */
function typescriptOf(root) {
  const load = createRequire(join(root, "package.json")), api = name => { try { const ts = load(name); return typeof ts.createSourceFile === "function" ? ts : null; } catch { return null; } };
  const ts = api("typescript");
  if (ts) return ts;
  const five = api("typescript-5");
  if (!five) throw new Error("the story kinds need the TypeScript 5 compiler API: npm i -D typescript@5.9.3 (or typescript-5@npm:typescript@5.9.3 beside a newer typescript)");
  const path = load.resolve("typescript-5"), resolveFilename = Module._resolveFilename;
  if (!Module._resolveFilename.storyFive) Module._resolveFilename = Object.assign(function (request, ...rest) {
    return request === "typescript" ? path : resolveFilename.call(this, request, ...rest); }, {storyFive: true});
  return five;
}
