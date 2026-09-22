# Product Studio 0.4

A local, English architecture and logic workbench over the existing ProductSpec DSL. Inspect declared dependencies, explain decisions, navigate source, simulate finite logic, review candidates and inspect recorded evidence. Ordinary implementation code remains with its product owner.

**Status:** source implementation in a stacked PR above #274. JavaScript syntax was parsed without executing modules. No application, dependency install, compiler, unit test, browser or benchmark was run for this revision. See [VERIFICATION](VERIFICATION.md) before treating it as ready.

## Start

Requires Node 22 or later. Use this PR's branch or complete source archive, not `main` before integration.

```bash
cd product-studio
npm ci
npm run verify
npm start
```

Open the printed loopback address, normally `http://127.0.0.1:4317`. Without an attached repository the clearly labelled examples are available. To inspect your own existing checkouts:

```bash
npm start -- /path/to/product
# Or several repositories:
npm start -- --workspace /path/to/circlekit --workspace /path/to/skydive-altimeter
```

No repository is cloned and no product generator, agent, model, GPU, emulator or native runtime is started. The package remains private/unpublished; `v1d-studio` is not globally installed by this PR.

## Begin with a question

A real attached product opens an overview. Press **Ctrl+Shift+P** or **Commands** to find an object, open source, inspect problems or focus a neighborhood. Use **Back/Forward**, **Save view**, and the **More views** menu rather than keeping every action on the canvas.

Select a node and choose **What feeds this?**, **What uses this?**, **Find path** or **Focus ±2**. These use declared bindings, not an inferred execution trace. Groups must be explicitly exported; IDs do not secretly define architecture.

The graph preserves its camera across selection and ordinary state changes. **Fit** frames the content; **Arrange** explicitly requests a new view layout. Dragging and keyboard node movement never change source code or event order.

## What is implemented

| Area | Capability and boundary |
|---|---|
| Architecture | ProductSpec schema-9 graph, ownership/port queries, groups, focus, indexed search and source provenance. Unknown relationships stay unknown. |
| Logic | Existing ProductSpec `decide` and `step`, exact cell identities, explicit unknown guards, scenarios and primitive boundary fixtures. No whole-program or provider execution. |
| Code and changes | Supported source edits, transitions, region splits, shared per-file drafts, candidate exploration and source/semantic diff. Not a complete TypeScript language service or full-product compiler. |
| Recorded evidence | Exact-model trace import, causal links, finite-result comparison, paged events and sequence lanes. No live debugging; lanes are not proportional-time plots. |
| Daily workflow | Passive build following, previous-build comparison, browser navigation, local bookmarks, command palette, Problems and a scope-aware proof strip. |
| Performance structure | Frozen snapshot/index reuse, on-demand source/details/catalog/trace data, retained DOM/graph elements and incident-edge redraw. No measured performance claim yet. |

[EXPERIENCE.md](EXPERIENCE.md) checks all 22 requested improvements, including partial and intentionally deferred items, examples and acceptance work.

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

The initial transport still includes compiled finite facets and a lightweight entity index. Full source text, selected object details, catalog/scopes and trace event pages are fetched when used. Very large models need focused exports; fully paged model loading and general graph virtualization remain open.

## The same model from a shell

```bash
node bin/studio.mjs doctor /path/to/product --pretty
node bin/studio.mjs inspect /path/to/product --search recording
node bin/studio.mjs simulate --examples --product workflow-example \
  --facet example.request --input '{"state":"IDLE","input":"Send","guards":{}}'
```

The example's expected result is `IDLE -> PENDING` via `send`; it is synthetic. [CLI.md](CLI.md) specifies query/source/scenario/trace commands, identity checks and JSON/exit behavior. Read commands do not start HTTP or create drafts. No agent-write API or MCP was added.

## Saving and safety

Working-tree source writes are disabled. Changes can be saved separately as local Studio drafts or exported as patches. An explicitly enabled Git-draft option retains its existing separate role:

```bash
npm start -- --workspace /path/to/repo --allow-git-drafts /path/to/repo
```

It creates a new draft ref without checkout, ordinary-index/worktree changes, push or merge. The product's own build and review remain required. Studio does not write video documents, copy an application's undo engine or replace native renderers.

The server remains loopback-only with Host/Origin checks and a per-process token. Do not expose it as a multi-user service. Imported data is bounded; unsupported syntax/versions stay explicit; missing mocks never fall back to network calls. No private SKYVW/video source or media is bundled into this tool.

Treat traces and drafts as potentially sensitive. Trace fields are limited to summaries/facts, but producer text is not automatically redacted. Links and bookmarks store semantic identities only, never source, prompts or event payloads. Default draft/scenario storage is `~/.local/state/product-studio`; camera/bookmark storage is local to the browser.

## Verification and next owner

```bash
npm run verify
npm run profile
npm start
# Separate terminal with Python Playwright installed:
python test/browser.py
python test/browser_experience.py
python test/browser_extended.py
```

The profile script is a measurement tool, not a benchmark result or release gate. Browser checks now require ordinary direct HTTP, not the old flattened module-injection bridge.

Start the next pass at [HANDOFF.md](HANDOFF.md). Clean installation, browser acceptance and two real product integrations remain required. Full native/media previews, live subscriptions, whole-flow service mocks, full code compilation and arbitrary visual graph rewiring are not delivered by this slice.
