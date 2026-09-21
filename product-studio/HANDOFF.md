# Product Studio 0.2: implementation handoff

Status: real code in `product-studio/`, not completion of every planned integration. Follow README, INTEGRATION and VERIFICATION. This work continues implementation PR #274; design #273 and language-DX #263 remain separate.

## Outcome and ownership

The user prioritizes a generic architecture/logic/code workbench across existing ProductSpec apps. Full visual no-code programming is not the first goal. Keep that order: trustworthy inspection, questions, source navigation, scenarios and real evidence before more visual editing widgets.

All new GUI copy, documentation and comments remain English. Existing source identifiers and imported evidence remain exact. No private SKYVW/video source was copied into public CircleKit. Only this development-tool directory is changed. No app/agent was restarted, no model or GPU was called, no package published, and no production code or access changed.

## Implemented boundaries

| Capability | Implementation | Important limit |
| --- | --- | --- |
| Generic bundle loading | `inspection.mjs`, `model.mjs`, `workspaces.mjs` | Schema-9 Product IR; foreign facets inspect-only; bundle is not a new product authority. |
| Build integration | `adapter.mjs`, `exporter.mjs`, CLI bundle | Accepts actual compiled exports; does not automatically hook every existing product build. |
| Architecture model | `architecture.mjs` | Compiler bindings plus labelled adapter associations; internal native input/output causality remains unknown. |
| Queries | Upstream/downstream/path/consumers/owner/potential impact | Exact boundary ports; owner traversal is potential dependency, not observed execution. |
| Source navigation | `provenance.mjs`, shared source documents, GUI source selector/gutter | Unique literal positions or explicit exported map. No general inverse compilation; native files need explicit maps. |
| Finite simulation | Existing package `step`/`decide` through `simulation.mjs` | Matching kernel required; pure policy/machine behavior, not sensors, services or field-update algorithms. |
| Semantic editing | `planSplitRegion`, existing literal edits and transition insertion | Preserves output semantics for split; cell IDs intentionally change. Arbitrary graph rewiring still unavailable. |
| Recorded evidence | Passive recorder + bounded trace codec + Trace GUI | No installed product hooks/live streaming. Causal paths require explicit producer links. |
| Scenarios | Ordered inputs/assertions, local save/reopen | Same logical model and facet; zero assertions means unasserted, never a behavioral proof. |
| Source persistence | Existing local draft/patch/opt-in Git draft branch | No normal worktree or video-document mutation. A logic-checked draft is not a full product build. |

## Decisions not to undo

1. Generated model is the normal inspection path. `source.mjs` stays a bounded standalone/edit fallback, not an expanding TypeScript interpreter that every product must conform to.
2. Pure source indexing and effectful build execution are separate. The server never imports repository modules or executes browser-supplied commands. An already-trusted product build calls the exporter.
3. Groups and facet/owner associations are explicit metadata. Equal-looking names are not a runtime connection. Unknown scope must stay unknown.
4. Producer version, current source dependency version, saved model identity, view identity and runtime session are different. Do not use a single “latest” evaluator for every model.
5. Keep producer diagnostics, raw contradictory evidence, missing guards, trace truncation and unsupported capabilities visible. Do not repair evidence to agree with the model.
6. Source code, product documents, scenarios, graph layout and runtime effects have different owners. No new video undo engine, scheduler or backend job-state copy belongs here.
7. One draft per source file, even when two facets share it. Preserve candidate/original separation and stale-reply protection.
8. Native/media previews and live/AI operations remain explicitly unavailable until real adapters and authorization exist. No network fallback from mocks.

## Start here: release verification, not more features

This environment could not install the locked dependencies or exercise direct browser navigation. First use a normal Node >=22 development machine:

```bash
cd product-studio
npm ci
npm run verify
npm start
# Separate terminal, with Python Playwright installed:
python test/browser.py --url http://127.0.0.1:4317
python test/browser_extended.py
```

The checked-in tests default to direct HTTP. Do not count `--http-bridge` as a normal browser/CSP/module-loading pass. Inspect the actual package version in the app; the earlier temporary `0.3.65-source-check` harness is not shipped and is not the release package.

Keep #274 draft until clean package/direct-browser checks have independent evidence. Do not bypass the issue with deep imports, temporary runtime fallbacks or a rewritten ProductSpec evaluator.

## Next real adoption: two products, one core

**First adapter:** export one existing full Product IR plus one owned machine/table through the current build. Pass exact compiler version, source list and a small source map. Add one version-2 workspace entry. Confirm no Studio-core change is needed for its product ID.

**Second adapter:** a different app's standalone table or full product. Use different local IDs, then deliberately repeat an ID in a different workspace to verify selection isolation. Confirm a version mismatch blocks simulation while inspection works. The smaller AMUX/video policy cases are useful; no live agent or job is needed.

**Proof:** generated bundle content preserves compiled objects; graph matches existing bindings; click from a node/cell to the correct source; modify a supported candidate, inspect its changed output, and do not mutate real source. Run the product's own normal compiler independently for any integration intended to ship.

## Next real observation hook

Select one existing debug/test owner, not a whole-program instrumentation rewrite. Emit a few bounded trace events with product/model/session identity, the owner's actual clock and known causal links. Use the provided trace format or passive recorder. Do not infer causes from timestamps or invent native guards.

**Proof:** capture an independently known event/decision; import it; compare its cell/values to the same model; deliberately alter the captured expected result and confirm the difference stays visible. Confirm foreign model, duplicate sequence, unreported gap and unknown entity are refused. No real flight/recording loop is paused by this test.

## Source editor and semantic commands

The existing textarea now has file selection, line numbers, exact span navigation, Ctrl+Enter validation, and shared per-file draft state. It is not Monaco or a full TypeScript language service. A future language-service integration should replace that presentation component without replacing the source/draft owner or compiler.

Keep semantic edits narrow. `table.splitRegion` is a useful example: determine the exact region, preserve output expressions, emit one coordinated source patch, run existing invariants and compare all points. There is no generic arbitrary “fix” engine. A quick fix may point to source without guessing the desired product decision.

Unsupported computed declarations stay `Open source`; do not flatten a helper or silently duplicate an imported definition. Any graph rewiring command needs real source provenance plus the full product compiler, not just compatible-looking port types.

## Runtime and packaging caveats

- The package remains private/unpublished. The new CLI and adapter exports exist locally; a global command or bare npm import is not automatically installed in users' apps.
- The exporter requires an existing output directory and writes only its generated `.studio.json`. It is not a multi-file source transaction.
- Imported bundle source digests cover the explicitly named source set, not a magically discovered whole dependency closure. Production adapters should include their real relevant configuration/lock inputs through their build's provenance; document any omitted coverage.
- Local draft/scenario publication is atomic with respect to readers on the same filesystem, but no power-loss/fsync durability guarantee is claimed.
- SVG graph layout is simple and bounded. Domain grouping and scope/path navigation work; a production-grade graph-layout/virtualization library is a later UI improvement, not a reason to invent graph semantics.
- Recorded Trace playback works; live subscriptions, device adapters, media previews, whole-flow mocks and affected-test execution are not implemented. Do not relabel them as minor CSS polish.

## Completion report for each next change

Record `Found`, `Change`, `Reason`, `Verified`, `Open` in the existing PR/task. For a bug, reproduce the symptom before the fix. For a new capability, name its boundary and negative cases. A screenshot proves a rendered state, not the correct package or runtime. A package install proves installation, not every user journey.

Do not add another task database, CI/release gate, full-repository rewrite or package publication as a side project. Finish one real adapter and its proof before expanding capability coverage.
