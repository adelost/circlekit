// repo-node.mjs: a repository on disk as the kinds read it (Cut row 1880): its files, TypeScript 5 and ESLint from its own install, its Python read by
// python3, its decisions. The browser entry (web.mjs) gives the same kinds a repo of files given as text.
import {execFileSync} from "node:child_process";
import {existsSync, readdirSync, readFileSync} from "node:fs";
import {createRequire, Module} from "node:module";
import {join, posix, relative, resolve, sep} from "node:path";
import {matcher} from "./rules.mjs";
import {CODE, eslintConfig, eslintRules, readable} from "./story.mjs";

export const SKIPPED = new Set(["node_modules", "dist", "build", ".git", ".wrangler", "coverage"]);
const PLUGINS = {"@typescript-eslint": load => load("typescript-eslint").plugin, sonarjs: load => load("eslint-plugin-sonarjs")};

/** The repo the kinds read: every file under root (less SKIPPED), each read once. */
export function nodeRepo(root, config, options = {}) {
  const files = walk(root), cache = new Map(), decisions = join(root, "arch.decisions.json");
  const repo = {root, files, config, amuxRoot: options.amuxRoot,
    read: file => cache.get(file) ?? (cache.set(file, readFileSync(resolve(root, file), "utf8")), cache.get(file)),
    covered: rule => files.filter(matcher(rule.files)).filter(file => !matcher(rule.exclude)(file)),
    ts: () => typescriptOf(root),
    eslint: () => linted(repo),
    python: names => pythonUnits(repo, names),
    decisions: () => existsSync(decisions) ? JSON.parse(readFileSync(decisions, "utf8")) : []};
  return repo;
}

const walk = (root, dir = "") => readdirSync(resolve(root, dir), {withFileTypes: true}).flatMap(entry =>
  SKIPPED.has(entry.name) ? [] : entry.isDirectory() ? walk(root, posix.join(dir, entry.name)) : [posix.join(dir, entry.name)]);

/** One ESLint pass over every file an eslint rule covers, kept on the run: a map of each file to its messages. A file ESLint cannot parse stops the
 *  run (the rules cannot judge it); name it in the rule's exclude if it is meant to be so. ARCH_CACHE_DIR keeps ESLint's cache by content. */
function linted(repo) {
  repo.eslintRun ??= (async () => {
    const rules = eslintRules(repo.config.rules);
    const files = [...new Set(rules.flatMap(r => repo.covered(r)))].filter(file => CODE.test(file));
    if (!files.length) return new Map();
    // config.eslint.from: a folder with its own package for ESLint and its plugins (the gateway's tools/lint, which carries TypeScript 5 beside its 7)
    // (node would also find a root install above it, so the folder's own install is asked for by name)
    const from = repo.config.eslint?.from, load = createRequire(join(repo.root, from ?? "", "package.json"));
    if (from && !existsSync(join(repo.root, from, "node_modules/eslint/package.json"))) throw new Error(`ESLint is not installed in ${from}: npm ci --prefix ${from}`);
    const {ESLint} = load("eslint");
    typescriptOf(repo.root);   // the parser asks for typescript; on 7.x it is given typescript-5
    const prefixes = [...new Set(rules.map(r => r.rule.includes("/") ? r.rule.slice(0, r.rule.lastIndexOf("/")) : null).filter(Boolean))];
    const plugins = Object.fromEntries(prefixes.map(p => [p, PLUGINS[p] ? PLUGINS[p](load) : load(`eslint-plugin-${p}`)]));
    const cache = process.env.ARCH_CACHE_DIR;
    const eslint = new ESLint({cwd: repo.root, overrideConfigFile: true, ignore: false, ...(cache ? {cache: true, cacheStrategy: "content", cacheLocation: join(cache, "eslint/")} : {}),
      overrideConfig: [eslintConfig(rules, load("typescript-eslint").parser, plugins)]});
    const results = await eslint.lintFiles(files);
    return readable(results.map(r => [relative(repo.root, r.filePath).split(sep).join("/"), r.messages]));
  })();
  return repo.eslintRun;
}

/** TypeScript 5's compiler API from the repository: `typescript-5` (an alias beside a newer typescript) or `typescript`. On TypeScript 7, which has
 *  none, the typescript every later require asks for (the ESLint parser's) is resolved to typescript-5 for this process. */
export function typescriptOf(root) {
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

/** Python's top-level defs and classes, read by the repository's python3 in one run and kept on the run. A file Python cannot parse stops the run, as
 *  ESLint's does. */
export function pythonUnits(repo, files) {
  repo.pythonRun ??= new Map();
  const missing = files.filter(file => !repo.pythonRun.has(file));
  if (missing.length) {
    const read = JSON.parse(execFileSync("python3", ["-I", "-c", PY_UNITS, repo.root], {input: JSON.stringify(missing), encoding: "utf8", maxBuffer: 256 << 20}));
    const broken = Object.entries(read).filter(([, r]) => r.error).map(([file, r]) => `${file} ${r.error}`);
    if (broken.length) throw new Error(`Python cannot read ${broken.length} file(s): ${broken.slice(0, 5).join("; ")}`);
    for (const [file, r] of Object.entries(read)) repo.pythonRun.set(file, r);
  }
  return files.map(file => ({file, ...repo.pythonRun.get(file)}));
}

/** Reads the files named on stdin (JSON) under the root in argv[1] and prints, per file, its top-level defs and classes in file order: name, line (a
 *  decorator's when it has one), kind, public, and for a def the file's names its body refers to, in the order of first reference, less the names
 *  the body binds itself (parameters, assignments, imports, inner defs); and every top-level statement as an item for --fix: its lines, kind, name,
 *  and the file's defs and classes it uses at load (a def's decorators and defaults, any other statement whole). */
const PY_UNITS = String.raw`
import ast, json, os, sys

def refs(fn, names):
    local, seen = {a.arg for a in ast.walk(fn.args) if isinstance(a, ast.arg)}, []
    for node in (n for stmt in fn.body for n in ast.walk(stmt)):
        if isinstance(node, ast.Name):
            (seen.append((node.lineno, node.col_offset, node.id)) if isinstance(node.ctx, ast.Load) else local.add(node.id))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            local.add(node.name)
        elif isinstance(node, ast.alias):
            local.add((node.asname or node.name).split('.')[0])
        elif isinstance(node, ast.arg):
            local.add(node.arg)
        elif isinstance(node, ast.ExceptHandler) and node.name:
            local.add(node.name)
    return list(dict.fromkeys(name for _, _, name in sorted(seen) if name in names and name not in local))

def units(tree):
    found = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
    last = {n.name: i for i, n in enumerate(found)}
    return [{'name': n.name, 'line': min([n.lineno] + [d.lineno for d in n.decorator_list]), 'kind': 'class' if isinstance(n, ast.ClassDef) else 'def',
             'exported': not n.name.startswith('_'), 'calls': [] if isinstance(n, ast.ClassDef) else refs(n, last)} for i, n in enumerate(found) if last[n.name] == i]

def loads(node, names):
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        node = [*node.decorator_list, *node.args.defaults, *[d for d in node.args.kw_defaults if d]]
    found = {n.id for one in (node if isinstance(node, list) else [node]) for n in ast.walk(one) if isinstance(n, ast.Name)}
    return sorted(found & names)

def items(tree):
    names = {n.name for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))}
    kind = lambda n: 'def' if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) else 'class' if isinstance(n, ast.ClassDef) else 'other'
    return [{'start': min([n.lineno] + [d.lineno for d in getattr(n, 'decorator_list', [])]), 'end': n.end_lineno, 'kind': kind(n),
             'name': getattr(n, 'name', None), 'load': loads(n, names)} for n in tree.body]

out = {}
for name in json.load(sys.stdin):
    try:
        with open(os.path.join(sys.argv[1], name), encoding='utf-8') as handle:
            tree = ast.parse(handle.read(), name)
            out[name] = {'units': units(tree), 'items': items(tree)}
    except (SyntaxError, ValueError, UnicodeDecodeError) as error:
        out[name] = {'error': type(error).__name__ + ': ' + str(error)}
print(json.dumps(out))
`;
