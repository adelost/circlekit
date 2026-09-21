# Product Studio

A local, English workbench over the existing ProductSpec language. This is executable application code, not the earlier HTML storyboard. Version 0.2 adds generated inspection bundles, architecture questions, source navigation and recorded traces. It is not a complete native IDE.

Start here, then read [app integration](INTEGRATION.md), [implementation handoff](HANDOFF.md) and [verification boundaries](VERIFICATION.md).

## Start

Requires Node 22 or later. From `circlekit/product-studio`:

```bash
npm ci
npm run verify
npm start
```

Open the printed address, normally `http://127.0.0.1:4317`. The server binds to loopback only. The initial selections are an original synthetic lifecycle, public AMUX policy excerpts, an original synthetic pipeline table, and public CircleKit Showcase catalog excerpts. Examples are labelled as examples, not connected products.

To inspect your real products, stop this server and attach existing local checkouts. Substitute your actual paths:

```bash
npm start -- \
  --workspace /path/to/circlekit \
  --workspace /path/to/skydive-altimeter \
  --workspace /path/to/agentmux \
  --workspace /path/to/ai-dsl
```

No repository is cloned. No workspace module, generator, provider, model, emulator or product runtime is executed. The server reads configured source files and already-generated artifacts. Generate stale product artifacts through their existing owners, then reload Studio.

Private product code and media are not bundled into this public application. SKYVW and the video editor are read only from roots you attach. No data is sent to a diagram service or to GitHub by Studio.

### Optional Git draft branches

Working-tree source writes are always disabled. To explicitly permit new draft branches for one existing repository:

```bash
npm start -- --workspace /path/to/repo --allow-git-drafts /path/to/repo
```

The GUI's `Save Git draft branch` then creates `product-studio/<operation-id>` inside that repository. It uses a temporary, separate Git index and an atomic new-ref update. It does not checkout the branch, modify the normal index or working files, push, merge, deploy or restart anything. It requires the source to match its tracked HEAD version and rechecks captured sources/configuration. Uncommitted source edits must instead use patch export through their owner. Existing repository writer policies still apply; enabling the flag is an explicit owner decision, not a workaround for those policies.

The saved branch is **logic-checked source**, not a successful whole-product/native build. Inspect the receipt and perform the product's normal verification before integration.

## Added in 0.2

- **Generated inspection first:** versioned data-only bundles from the product's own compiled exports. Studio indexes source locations rather than reinterpreting every helper to understand the model.
- **Architecture questions:** upstream, downstream, shortest path, consumers, port owner and potential impact over declared bindings. Explicit group views and source-linked entity inspection; no inferred domains from ID prefixes.
- **Trace:** ordered capture import, identity checks, explicit causal paths, filtering, backward/forward inspection and compatible-kernel comparison of recorded decisions. No live runtime is paused or executed.
- **Code navigation:** exact exported/uniquely indexed source locations, file selection, line numbers and source-to-entity selection. Source drafts are shared per file, not accidentally duplicated per facet.
- **Semantic editing:** split a decision-table region while preserving all output values and original invariant callbacks. Review the source/semantic diff and explore a separate candidate. Rule identity intentionally changes for the split portion.
- **Scenarios:** local immutable named save/reopen with exact model identity. An event run without assertions is explicitly `unasserted`, not a passing behavior proof.
- **Attachment CLI:** `npm start -- /path/to/product`, `npm run doctor -- /path/to/product`, and `bin/studio.mjs bundle` for existing compiled JSON. A version-2 `studio.workspace.json` names one generated bundle instead of repeating its source/logic inventories.
- **Version boundaries:** mismatched producer/evaluator versions block simulation; changed source package pins also block misleading draft validation. Producer diagnostics are not discarded.

The exporter and trace APIs are implemented in this development tool. No product generator hook, native observer, public npm release or live preview adapter was automatically installed in your apps.

## What works

| Area | Delivered behavior |
| --- | --- |
| System | Import schema-9 Product IR; preserve extension data; inspect nodes, port contracts, bindings, artifacts and mounts; search; pan, zoom, drag and keyboard-select a scoped SVG graph. |
| Logic | Actual ProductSpec `defineMachine`/`step` and `defineDecisionTable`/`decide`; exact cell identities, guard facts, why-not information, all table points within a budget, synthetic history and reset. |
| Source | TypeScript/MJS parsing without executing repository code; supported static construction helpers/constants/import aliases; syntax diagnostics and original source spans; unsupported expressions are explicit. |
| Visual authoring | Edit literal cell/root properties; append a machine transition; create a new table or machine using normal ProductSpec syntax. No new DSL keywords. |
| Changes | Edit source text, validate supported declarations including supported original invariant callbacks, inspect source and semantic diffs, undo/redo edits, preserve one shared draft per source file and export a real unified patch. |
| Candidate exploration | Open a validated draft as an independent in-memory candidate. Original source, project and synthetic run remain separate. |
| Scenarios | Run explicit ordered virtual events with independent assertions; export scenario input; reject stale bundle identities and unknown relevant guard facts. |
| Mock requests | Exact primitive-record fixture contracts, virtual latency, response ordering, same-operation deduplication, conflicting identity refusal, and no external fallback on a missing or ambiguous fixture. |
| Interface | Real imported Showcase case catalogs and Product IR mount scopes. Native previews and video-document writes are explicitly unavailable rather than faked. |
| Evidence | Read compatible aggregate port snapshots against the exact product and graph hashes; inspect captured counts/quality without fabricating an event trace or source freshness. |
| Persistence | Atomic local draft files; saved-draft reopening; opt-in Git draft branches with idempotency and source checks. No silent product mutation. |

Current graph rendering is bounded to 160 visible nodes and 600 edges. Search narrows the view; it does not change the product. Tables are bounded to 4,096 points and 256 cells. These are interactive tool limits, not changes to ProductSpec semantics.

## A useful first session

1. Open the lifecycle example. `Send` enters PENDING. Select `Response`; unknown guard facts stop stepping. Supply `CURRENT_REQUEST=true` and `RESPONSE_OK=true`; the shared kernel chooses `reply-success`.
2. Inspect a cell and use `Edit definition`, or open `Changes`. A conflicting/unreachable edit is an invalid draft, not a green runnable model. It can still be retained locally and corrected.
3. Validate, inspect the diff, then `Explore this draft` to test a candidate without replacing the original. Export a patch or explicitly save a Git draft branch on an enabled workspace.
4. Open AMUX's public policy sample. Choose `need=UNKNOWN`; the real policy returns HOLD with `unknown-evidence`. This does not compact or start an agent.
5. Attach your real repositories or import their generated ProductSpec JSON. Standalone tables do not turn into imaginary whole-application graphs.

## Custom product attachment

Prefer a generated bundle when available:

```json
{"version":2,"projects":[{"id":"my-product","label":"My Product","bundle":"generated/my-product.studio.json"}]}
```

[INTEGRATION.md](INTEGRATION.md) covers the implemented export API, CLI and source/trace contracts. The older source/artifact form below remains useful for read-only attachment and supported standalone declarations.

A root can contain `studio.workspace.json`. This is a local file-selection configuration, not a second product definition or a plugin loader:

```json
{
  "version": 1,
  "projects": [
    {
      "id": "my-product",
      "label": "My Product",
      "sources": ["src/policy.ts", "src/lifecycle.mjs"],
      "artifact": "generated/product.json",
      "graph": "generated/product.graph.mmd"
    }
  ]
}
```

Paths must be relative, non-hidden files inside that root. Traversal and symlink escapes are refused. Omit `artifact`/`graph` for a table-only product. Do not place credentials in this file. It cannot grant source-write permissions or run commands.

Built-in path presets find SKYVW's recording declaration/product JSON, AMUX's context-cost source, the video editor's activity declaration, and Showcase's generated product/catalog. These are convenience paths, not special evaluator logic. A custom product with supported formats uses the same core.

The Import action accepts a ProductSpec schema-9 JSON file, a compiled machine/table, or this transport envelope:

```json
{
  "kind": "product-studio-bundle",
  "version": 1,
  "product": null,
  "facets": [{ "kind": "machine", "compiled": {} }]
}
```

Replace `{}` with a real compiled machine. This envelope does not execute plugins. Source editing needs an attached source, not inverse compilation of generated JSON. For exact runtime snapshot correlation, attach the original generated product and graph files through a workspace; a reserialized bundle is not the original byte identity.

## Source reader and validation scope

`lib/source.mjs` uses the installed TypeScript parser to interpret a **bounded construction subset**, not arbitrary JavaScript. Recognized ProductSpec constructors delegate to the installed package. The reader handles literal records/arrays, same-file constants, aliases, supported pure helpers, selected collection methods and simple invariant expressions. It never uses `eval`, Node `vm`, dynamic imports of repository code, a browser-supplied command or a local copy of ProductSpec's laws.

Unsupported external imports, imperative helpers, computed inverse edits and top-level executable statements produce diagnostics. The source editor remains usable for invalid drafts. A declaration coming through an unsupported construction can be inspected only when a product-owned compiled artifact is available.

This is not a full TypeScript type check, a full product build or native conformance proof. Imported JSON with invariant descriptions cannot reconstruct the original callbacks; it is labelled structural validation only. The tool pins ProductSpec 0.3.65 and TypeScript 5.9.3; it does not silently execute a workspace's dependency installation. Different consumer pins require their own normal verification.

## Safety and ownership

- Local HTTP is protected by exact Host/Origin checks, same-origin response policy, a per-process API token and a restrictive CSP. This is a local development tool, not a multi-user server. Do not expose it through a public reverse proxy.
- Imports, collection expansion and table points are bounded. Mock execution has no network code or production fallback. The UI distinguishes source, candidate, fixture, declared model and recorded snapshot.
- Code edits, media-document commands, scenario inputs and graph positions are different owners. This implementation does not write video documents, modify original footage or create another undo engine for the video editor.
- Drafts contain source text. Default storage is `~/.local/state/product-studio`; use `--data-dir` to choose another local folder. Saved files are private to the local account where filesystem permissions support that. Clear retained drafts through your normal local file-management process.
- Source identity, read-set digests and the tool's actual installed versions participate in bundle identity. Simulation refers to that loaded snapshot, not an automatically watched live checkout. Reload is explicit.
- Git draft saving affects Git objects and a new ref only when enabled. No operation here constitutes authorization for package publication, a model call, native installation or deployment.

## Tests and evidence

```bash
npm run verify
# With the server running and Python Playwright/browser installed:
python test/browser.py --url http://127.0.0.1:4317
# Creates its own temporary synthetic fixture server:
python test/browser_extended.py
# Pure architecture, inspection and trace modules only:
npm run test:core
```

`npm run verify` checks module syntax and runs Node tests for source reading, laws, edit spans, imports, identity checks, scenarios, mocks, HTTP boundaries, local draft persistence and isolated Git branch saves. Browser tests use the actual UI and HTTP backend, not the old scripted concept.

**Read [VERIFICATION.md](VERIFICATION.md) for the exact environment limitation:** the authoring environment could not download the locked packages. Full local results used a separate source-check harness derived from the reviewed functions and an older available TypeScript build. The 24 pure core tests need neither that harness nor TypeScript. They are not proof of a clean `npm ci` or the released tarball's integration. The test harness is neither shipped nor a runtime fallback. The managed browser also required the explicitly reported HTTP-bridge test mode; direct HTTP/CSP checks were separate.

## Architecture and next implementation seams

- `bin/studio.mjs`: generic serve/doctor/bundle entrypoint.
- `adapter.mjs`, `lib/inspection.mjs`, `lib/exporter.mjs`: data-only build integration and provenance.
- `lib/architecture.mjs`: derived typed entity graph, bounded views and deterministic queries.
- `lib/provenance.mjs`: source positions without interpreting program semantics.
- `lib/trace.mjs`: passive producer SDK, capture validation and recorded inspection.
- `lib/scenario-store.mjs`: local immutable scenario persistence.
- `server.mjs`: loopback HTTP and explicit operations.
- `lib/source.mjs`: bounded AST construction reader and minimal source edits.
- `lib/kernel.mjs`: actual package import and tool resource limits.
- `lib/model.mjs`: artifact integrity, derived graphs and snapshot correlation.
- `lib/simulation.mjs`: shared-kernel calls and explicit fixture event scheduling.
- `lib/workspaces.mjs`: source snapshots, candidates and local draft ownership.
- `lib/git-draft.mjs`: opt-in, conflict-checked Git draft refs without working-tree mutation.
- `public/`: native browser ES modules and SVG. No frontend compilation step or CDN.

The design handoff remains CircleKit PR #273. This implementation intentionally does not finish all D0-D8 capabilities. The next useful work is a clean locked-package/direct-browser verification, then adopting the implemented bundle/trace interfaces in actual product-owned builds and runtime hooks. Full native/media previews, richer source lenses, a language-service editor and exact product-document commands remain later seams. Do not create another scheduler, DSL, library catalog or native renderer to fill those gaps. A port wire drawn by the viewer is not an implementation, and this first release does not visually rewire arbitrary product graphs.
