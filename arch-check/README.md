# @v1d/arch-check

Rules as data in `arch.config.json`; old debt as counts in `arch.baseline.json` that may only shrink.

    node arch-check.mjs [repo]            check (exit 1 on any hit or stale baseline entry)
    node arch-check.mjs [repo] --init     write the baseline from today's counts (first time only)
    node arch-check.mjs [repo] --lower    lower the baseline to today's counts; never raises

A hit reads `rule N name: file:line message. Fix: ...`.

Kinds (each rule has `id`, `name`, `kind`, `fix`; `files` and `exclude` are globs with `*` and `**`):

- `max-lines` `{max}`: a file over max; the excess counts toward the baseline.
- `max-files` `{max}`: a folder with more files than max.
- `pattern` `{pattern, flags?, message?}`: a regex per line (comment lines skipped).
- `absent` `{paths}`: a path that must not exist.
- `modules` `{modules: [{dir, imports}]}`: a module is reached only through its `index`, and only along the listed edges.
- `duplicates` `{lines?, minChars?}`: the same run of lines in two files.
- `count` `{module, export, path, min}`: every item `path` reaches (`*` visits each key) holds at least `min` entries; the module is imported, so a `.ts` module needs `node --import tsx`.
