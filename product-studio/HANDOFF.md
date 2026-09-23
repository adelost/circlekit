# Product Studio 0.3: next-owner handoff

Start with [README](README.md), [CLI](CLI.md), [INTEGRATION](INTEGRATION.md) and [VERIFICATION](VERIFICATION.md). This continues PR #274; design #273 and language-DX #263 remain separate. Q0-Q5 are implemented in source, not marked as verified. [SEMANTIC-CLI-PLAN](SEMANTIC-CLI-PLAN.md) maps their implementations and remaining acceptance work.

## What the user wants

A generic architecture/logic/code workbench for ProductSpec apps. Trustworthy inspection, source navigation, scenarios and real evidence take priority over visual no-code programming. Agents already edit source using their normal tools; Studio supplies semantic information, not another agent write channel. All authored GUI copy, comments and documentation are English.

## First: run the version that was actually delivered

The latest implementation was statically reviewed only, at the user's request. No install, Node command, application, compiler, test or browser was run for this revision. Previous test results are historical, not the current version's test evidence.

On a normal Node >=22 machine:

```bash
cd product-studio
npm ci
npm run test:cli
npm run verify
node bin/studio.mjs inspect --examples --product workflow-example --pretty
node bin/studio.mjs simulate --examples --product workflow-example \
  --facet example.request --input '{"state":"IDLE","input":"Send","guards":{}}'
npm start
# In another terminal, with Python Playwright installed:
python test/browser.py --url http://127.0.0.1:4317
python test/browser_extended.py
```

Do not turn the PR ready/merge solely from static review. Confirm exact installed versions, stdout/exit contracts and the ordinary browser module/CSP path. Do not use a source-extraction test harness, deep imports, sibling compiler checkout or private evaluator as a runtime fallback. For a bug-fix claim, run its regression on the previous implementation first.

## Current implementation boundaries

| Capability | Owner | Limit |
| --- | --- | --- |
| GUI and semantic CLI model access | `Workbench`, `SemanticStudio` | Loaded snapshots, not a live application |
| Model export/attachment | Existing exporter, `bundle`, manifests | Does not automatically hook every product build |
| Architecture queries | `architecture.mjs` | Declared potential dependencies, not native algorithm causality |
| Source navigation/drafts | Provenance and existing source/draft owner | Bounded source patterns; no general inverse compilation or full type service |
| Finite simulation | Existing installed ProductSpec `step` and `decide` | No sensors, native field arithmetic, effects or provider calls |
| Scenarios | Existing runner and local GUI scenario store | CLI reads files only; unasserted results are not behavior proofs |
| Recorded traces | Existing decoder, recorder and shared GUI comparison | No installed runtime hooks or live subscriptions |
| Source persistence | Existing local drafts/patches/opt-in Git draft refs | No ordinary worktree or video-document writes |

## Decisions to retain

- Generated inspection is the primary model path. Do not grow `source.mjs` into a second TypeScript implementation.
- The CLI delegates to the same core as the GUI. It does not start HTTP or import product modules. Read commands reject server/write flags; examples require explicit selection.
- Groups and runtime associations are explicit. Names and nearby timestamps do not prove architecture or causality.
- Preserve producer, evaluator, source, model, view and runtime-session identities separately. A stale source can coexist with an inspectable old model, but cannot masquerade as its exact source location.
- Incomplete evidence, missing guards, dropped history, unsupported impact and failed assertions stay visible. A trace disagreement is evidence, not something to repair into agreement.
- Source code, video documents, scenarios, graph layout and runtime effects have different owners. Retain the shared per-file draft and the product's own document/undo rules.
- Keep all source, dependency and execution boundaries versioned. The package is private/unpublished; CLI exports do not imply a global install.
- No MCP, AI provider, new scheduler, native renderer, task database or release/CI gate was added. Do not add one without a concrete need.

## Next real adoption: two products, not more widgets

Use an existing trusted product build to export a full Product IR and one owned machine/table with exact compiler version and relevant source/configuration digests. Add a version-2 manifest. Then attach another app's standalone table. No product-name branch should be needed in Studio core.

Compare generated data with actual compiler output; query a known path; open its exact source; simulate an independently expected case; keep unsupported relationships explicit. Use the product's normal build to validate real source changes. `bundle` merely packages supplied compiled objects and does not prove source freshness by itself.

Before adding live tooling, record a short actual debug/test flow at an existing owner. Keep model/session/clock identity and explicit causal links. Import it, compare an independently known result, deliberately alter that result and ensure the contradiction remains visible. Never pause a real flight/recording loop or invoke a paid model for an authoring test.

## Known remaining work

Clean locked-package/direct-browser verification; real per-product exporter adoption and trace hooks; richer editor language service; native/media previews; video-document commands; live observation; whole-flow service mocks; full product compiler integration and complete visual graph rewiring. These are not merely CSS polish.

The exporter still covers only explicitly supplied sources, not an automatically discovered dependency closure. Local atomic file publication is not a power-loss/fsync durability guarantee. Graph rendering is bounded. Runtime observations are not authenticated by a hash alone. Existing Git draft behavior remains explicitly enabled per root and still needs each product's normal verification.

## Report scope accurately

For each next change record Found, Change, Reason, Verified and Open in the existing PR/task. A file hash proves which bytes were submitted, not runtime correctness. A package install is not a full user-journey proof. Preserve unrelated WIP, original media, receipts, user sessions and existing writer rules.
