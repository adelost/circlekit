# @v1d/arch-check

Rules as data in `arch.config.json`; old debt as counts in `arch.baseline.json` that may only shrink.

    node arch-check.mjs [repo]            check (exit 1 on any hit or stale baseline entry)
    node arch-check.mjs [repo] --init     write the baseline from today's counts (first time only)
    node arch-check.mjs [repo] --lower    lower the baseline to today's counts; never raises
    --amux-root DIR                       where AMUX is, for a `contract` rule (else $AMUX_ROOT, else the amux on PATH)

A hit reads `rule N name: file:line message. Fix: ...`.

Kinds (each rule has `id`, `name`, `kind`, `fix`; `files` and `exclude` are globs with `*` and `**`):

- `max-lines` `{max}`: a file over max; the excess counts toward the baseline.
- `max-files` `{max}`: a folder with more files than max.
- `pattern` `{pattern, flags?, message?}`: a regex per line (comment lines skipped).
- `absent` `{paths}`: a path that must not exist.
- `folders` `{allow, in?}`: a folder directly under the repo's root (or under `in`) that is not in `allow` is red; node_modules, dist, build, .git and dot folders are left alone.
- `names` `{files, pattern, flags?}`: the name of each covered file, without its folders, must match the regex.
- `modules` `{modules: [{dir, imports}]}`: a module is reached only through its `index`, and only along the listed edges.
- `duplicates` `{lines?, minChars?}`: the same run of lines in two files.
- `contract` `{}`: the first comment of each file has exactly one `WHAT:` and one `WHY:`, and the words pass AMUX's `core/contract-lint.mjs` (`evaluateContract`: a WHAT that opens with one of its verbs, at most 16 words in the WHAT and 18 in the WHY, no filler, a boundary in the WHY); its errors and its warnings are both red, as in Product Studio. AMUX is found by `--amux-root`, `$AMUX_ROOT` or the `amux` on PATH, never by the config. Without it the run stops with exit 2, also with `--init` and `--lower`, and never reads as a pass.
- `count` `{module, export, path | paths, min}`: every item `path` reaches (`*` visits each key; with `paths` the entries of all of them are summed) holds at least `min` entries; a value that is there counts, a list counts its entries; the module is imported, so a `.ts` module needs `node --import tsx`.
