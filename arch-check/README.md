# @v1d/arch-check

Rules as data in `arch.config.json`; old debt as counts in `arch.baseline.json` that may only shrink.

    node arch-check.mjs [repo]            check (exit 1 on any hit or stale baseline entry)
    node arch-check.mjs [repo] --init     write the baseline from today's counts (first time only)
    node arch-check.mjs [repo] --lower    lower the baseline to today's counts; never raises
    --amux-root DIR                       where AMUX is, for a `contract` rule (else $AMUX_ROOT, else the amux on PATH)

A hit reads `rule N name: file:line message. Fix: ...`.

`KEY_NAMES` (`providers`, `modal`) exports the two key-name matchers alone, for a check of live secrets by name.

Kinds (each rule has `id`, `name`, `kind`, `fix`; `files` and `exclude` are globs with `*` and `**`):

- `max-lines` `{max}`: a file over max; the excess counts toward the baseline.
- `providers` `{}`: a line that names an AI provider's host, imports its SDK (JS or Python) or names its key is red: only ai-gateway calls a provider, and a provider key lives only as an ai-gateway secret. The list is `PROVIDERS` in arch-check.mjs, the same for every repo; `files` defaults to code and config, and the places a repo still has sit in its baseline, which may only shrink. ai-gateway does not turn it on.
- `modal` `{}`: the same for Modal (`MODAL` in arch-check.mjs): its SDK, a `*.modal.run` address, its token and an app's own address of a Modal app (`STATELESS_URL`, `EXECUTOR_URL` and the like) are red; only ai-gateway starts Modal work.
- `max-files` `{max}`: a folder with more files than max.
- `pattern` `{pattern, flags?, message?}`: a regex per line (comment lines skipped).
- `absent` `{paths}`: a path that must not exist.
- `folders` `{allow, in?}`: a folder directly under the repo's root (or under `in`) that is not in `allow` is red; node_modules, dist, build, .git and dot folders are left alone.
- `names` `{files, pattern, flags?}`: the name of each covered file, without its folders, must match the regex.
- `modules` `{modules: [{dir, imports}]}`: a module is reached only through its `index`, and only along the listed edges.
- `duplicates` `{lines?, minChars?}`: the same run of lines in two files.
- `contract` `{}`: the first comment of each file has exactly one `WHAT:` and one `WHY:`, and the words pass AMUX's `core/contract-lint.mjs` (`evaluateContract`: a WHAT that opens with one of its verbs, at most 16 words in the WHAT and 18 in the WHY, no filler, a boundary in the WHY); its errors and its warnings are both red, as in Product Studio. AMUX is found by `--amux-root`, `$AMUX_ROOT` or the `amux` on PATH, never by the config. Without it the run stops with exit 2, also with `--init` and `--lower`, and never reads as a pass.
- `css-imports` `{files, scripts, prefix, exclude?}`: a stylesheet (`files`) names a class that starts with `prefix` and that another folder's script (`scripts`) draws, while its own folder's script does not import that folder; a class no script names is nobody's, and `exclude` leaves out the scripts that draw nothing (examples). One hit per class in a stylesheet.
- `count` `{module, export, path | paths, min}`: every item `path` reaches (`*` visits each key; with `paths` the entries of all of them are summed) holds at least `min` entries; a value that is there counts, a list counts its entries; the module is imported, so a `.ts` module needs `node --import tsx`.

## The guard (`guard/`, since 0.9.0)

For a repository that wants its architecture held, not only reported. A repository keeps one small pinned wrapper (it checks the sha256 of this package's `.mjs` files before it imports anything) and runs `runGuard({root, args})` from `@v1d/arch-check/guard/run.mjs`:

- **Doors, dependencies and cycles.** A `modules` rule with `exactEdges` is read from the imports of TypeScript, JavaScript and the scripts of Svelte files (needs TypeScript 5 as `typescript` or the alias `typescript-5`), Python (`lang: "py"`, `sourceRoots`) and Kotlin (`lang: "kt"`), including `new Worker`, `new URL(.., import.meta.url)` and template imports. `entry` is the module's door (a name, a list, or `"*"`), `acyclic` finds module cycles, `edgesOnly` asks for no door, `closed` makes an import out of every module a breach, `onlyFrom` limits the importers, `hard` takes no exception at all. Breaches are named by file and target, never pooled.
- **A ratchet against the parent commit.** A raise of a known exception, a removed or renamed rule, a lower bar (`max`, an excluded file, a lost `hard`), a widened dependency, a changed door, a dropped module or a changed `guard` is red unless `arch.decisions.json` gains, in the same commit, a decision with who, when, message and its `ceilings` (`<rule>:max`, `<rule>:import:<from>><to>`, `<rule>:entry:<dir>`, `<rule>:module:<dir>`, `<rule>:exclude:<file>`, `guard`) or `removes`. A decision of an earlier commit never licenses a later change, and none can be altered or dropped. `--adopt <rule>` names a new rule's breaches once; a new rule's keys must equal today's breaches.
- **The guard of the guard** (`policy.mjs`): `arch.config.json` names `guard: {wrapper, lint, docsOnly?}`; `npm run lint` must run that wrapper and the wrapper must still check the hash.
- **`export.mjs`** lints a commit in an export of it: as a pre-push hook (`node node_modules/@v1d/arch-check/guard/export.mjs`) or for a deploy (`--commit <sha>`; a commit from before the guard is a rollback and is not checked).

Exit codes of the wrapper: 0 holds, 1 a breach, 2 a rule that cannot run or a package that is not the pinned one.
