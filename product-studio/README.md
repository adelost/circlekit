# Product Studio

Product Studio makes software architecture executable and inspectable. It connects declared intent, compiled structure, test evidence and observed runtime behavior without treating them as the same thing.

## Start

Requires Node 22 or later and this package's locked dependencies.

```bash
cd product-studio
npm ci
npm link
```

Run the linked command from a directory without a product workspace. It opens a labelled synthetic lifecycle example; no other repository is needed.

```bash
v1d-studio
```

From a product root containing `studio.workspace.json`, the other two primary commands are:

```bash
v1d-studio review
v1d-studio converge
```

`review` combines the current Git change, declared impact, type-owned WHAT/WHY and loaded evidence; `plan --changed` remains the narrow impact command. `converge` reports contradictions. Neither runs product code or writes source. The workspace selects a compiled bundle. Studio derives the repository from Git `origin`, the nearest unambiguous installed ProductSpec, and optional `test-results/<project-id>-studio-trace.json`, `<project-id>-bdd-run.json` and `<project-id>-laws.json`. [INTEGRATION.md](INTEGRATION.md) covers explicit overrides and export.

When a product declares `authoring` in its workspace file, `v1d-studio export`
explicitly rebuilds its named inspection bundle with the product's own locked
ProductSpec. Commit that bundle with the source so a fresh checkout opens with
the single `v1d-studio` command. Opening the viewer never executes authoring code.

Open the printed loopback address, normally `http://127.0.0.1:4317`. To inspect another checkout explicitly:

```bash
v1d-studio /path/to/product
# Or several repositories:
v1d-studio --workspace /path/to/first-product --workspace /path/to/second-product
```

This package is not published to npm. `npm link` installs the local `v1d-studio` command from this checkout; a missing command requires that one-time setup rather than a fallback to another Studio version.

## Begin with a question

A product opens on its relevant loaded view. Press **Ctrl+Shift+P** or **Commands** to find an object, open source, inspect problems or focus a neighborhood. Use **Back/Forward**, **Save view**, and the **More views** menu rather than keeping every action on the canvas.

Select a node and choose **What feeds this?**, **What uses this?**, **Find path** or **Focus ±2**. These use declared bindings, not an inferred execution trace. Groups must be explicitly exported; IDs do not secretly define architecture.

The graph preserves its camera across selection and ordinary state changes. **Fit** frames the content; **Arrange** explicitly requests a new view layout. Dragging and keyboard node movement never change source code or event order.

## What is implemented

| Area | Capability and boundary |
|---|---|
| Architecture | ProductSpec schema-9 graph, ownership/port queries, groups, focus, indexed search and source provenance. Unknown relationships stay unknown. |
| Logic | Existing ProductSpec `decide` and `step`, exact cell identities, explicit unknown guards, scenarios and primitive boundary fixtures. |
| Code and changes | Supported source edits, transitions, region splits, shared per-file drafts, candidate exploration and source/semantic diff. |
| Recorded evidence | Exact-model trace import, causal links, finite-result comparison, paged events and sequence lanes. |
| Daily workflow | Passive build following, previous-build comparison, browser navigation, local bookmarks, command palette, Problems and a scope-aware proof strip. |
| Performance structure | Frozen snapshot/index reuse, on-demand source/details/catalog/trace data, retained DOM/graph elements and incident-edge redraw. |

## Agent edits, Studio follows

Agents keep editing ordinary source and running the product's existing generator. **Follow builds** observes only declared files while the browser is visible and idle. A changed generated bundle must be stable across two observations, decode successfully and correlate with its source before automatic adoption.

Pending source/scenario drafts, including saved-but-unapplied source proposals, prevent automatic replacement. Invalid/partial generated output retains the prior usable snapshot. Source-only changes wait for the product owner to regenerate. A changed workspace manifest requires restart, not a guessed project selection. No build command is executed by the watcher.

After a clean adoption, existing selection IDs are retained, results are cleared, and **Compare builds** can show the previous snapshot. Comparison describes declared changes, not which tests must pass or what a real runtime executed.

## Connect a product once

Preferred attachment is a generated inspection bundle from the product's already-trusted build:

```json
{"version":2,"projects":[{"id":"my-product","label":"My Product","bundle":"generated/my-product.studio.json"}]}
```

Save this selection as `studio.workspace.json` at the product root. The bundle contains compiled models and source identity, not executable plugins or a second product definition. [INTEGRATION.md](INTEGRATION.md) documents the exporter, legacy attachments and trace adapter. Built-in path presets are conveniences, not separate evaluators.

The initial transport includes compiled finite facets and a lightweight entity index. Full source text, selected object details, catalog/scopes and trace event pages are fetched when used.

## The same model from a shell

```bash
v1d-studio doctor /path/to/product --pretty
v1d-studio inspect /path/to/product --search recording
v1d-studio review /path/to/product
v1d-studio plan /path/to/product --changed src/recording.ts
v1d-studio converge /path/to/product
v1d-studio simulate --examples --product workflow-example \
  --facet example.request --input '{"state":"IDLE","input":"Send","guards":{}}'
```

The example's expected result is `IDLE -> PENDING` via `send`; it is synthetic. `review` prints a Markdown summary for a PR; `converge` can list contradictions with `--tasks`. [CLI.md](CLI.md) specifies the commands, identity checks and exit behavior. Read commands do not start HTTP or create drafts.

For test evidence, `v1d-studio record --product my-product -- TEST_COMMAND` runs one focused existing test. It derives the trace identity and `test-results/<project-id>-studio-trace.json` from the workspace. ProductSpec's test-only package condition observes JS decisions and machine steps; generated Kotlin looks only when its build's `DEBUG` constant is true. Named port implementations can use `bindPortImplementations`, which returns the same object in normal builds. Recording refuses an empty or failed test run and preserves the previous trace.

Trace v1 remains readable with its original, unspecified application semantics. Trace v2 carries explicit `evaluated`, `applied` or `returned` phases, an optional opaque instance ID, a capture watermark and explicit loss ranges. Only an owner-side `applied` observation can identify an observed state. An open or interrupted capture, or one with losses, cannot be treated as complete evidence.

## Saving and safety

Working-tree source writes are disabled. Changes can be saved separately as local Studio drafts or exported as patches. An explicitly enabled Git-draft option retains its existing separate role:

```bash
npm start -- --workspace /path/to/repo --allow-git-drafts /path/to/repo
```

It creates a new draft ref without checkout, ordinary-index/worktree changes, push or merge. The product's own build and review remain required.

The server remains loopback-only with Host/Origin checks and a per-process token. Do not expose it as a multi-user service. Imported data is bounded; unsupported syntax/versions stay explicit; missing mocks never fall back to network calls.

Treat traces and drafts as potentially sensitive. Trace fields are limited to summaries/facts, but producer text is not automatically redacted. Links and bookmarks store semantic identities only, never source, prompts or event payloads. Default draft/scenario storage is `~/.local/state/product-studio`; camera/bookmark storage is local to the browser.

## Local checks

```bash
npm run verify
npm run profile
npm start
# Separate terminal with Python Playwright installed:
python test/browser.py
python test/browser_experience.py
python test/browser_extended.py
```

The profile script is a measurement tool, not a benchmark result or release gate. Browser checks use ordinary direct HTTP.

## What Studio does not do

Opening Studio does not clone a repository or run a product, generator, test, provider, GPU, emulator or native runtime. It has no runtime control, native/media preview adapter, whole-program compiler, automatic build runner or general graph virtualization; large models need focused exports. Finite simulation does not execute sensors, controllers or effects. Draft patches are not transactional edits against another editor's worktree, and Studio does not replace a product's state store, undo engine or scheduler. Missing runtime evidence and unsupported capabilities remain visible, not inferred from a model or source reference.
