# Product Studio delivery and remaining boundaries

This is the current capability and limitation index for the [original cross-product plan](https://github.com/adelost/circlekit/pull/273) and the 22 requested experience improvements. "Delivered" means the bounded Studio capability exists. It does not mean a product runtime, renderer or live account was exercised. [VERIFICATION](VERIFICATION.md) records dated tests and browser checks; final images are separate evidence.

The useful tool today is a local architecture, source, finite-logic and recorded-test workbench. `v1d-studio` opens a product's committed model without starting its generator or runtime. The model and compiler remain product owned; unknown capability stays visible. The larger visual-authoring and native-preview vision in #273 remains a roadmap, not a hidden claim of completion.

`v1d-studio plan` summarizes declared impact for a PR; `converge` reports existing evidence as Converged, Diverged or Unknown. Neither command generates evidence. Facet ownership still needs an explicit ProductSpec owner declaration where the current model lacks one.

## Experience checklist, items 1–22

| Items | Status and evidence | Remaining boundary |
|---|---|---|
| 1, 15 | Delivered: frozen per-build snapshot and indexed search; snapshot/search unit cases. | None for bounded models. |
| 2 | Delivered: source, entity, catalog and trace data load on demand; transport tests. | Fully paged compiled-model loading is deferred until real size measurements require it. |
| 3, 4 | Delivered: retained DOM/graph, camera and focus in headed Chrome. | Cross-file editor-cursor restoration is not proved and remains deferred. |
| 5 | Delivered: stable candidate observations, draft protection and invalid-build retention in focused tests. | No build executor or daemon is planned in the viewer. |
| 6–9 | Delivered: semantic comparison, history/deep links and command search, with unit and selected browser checks. | Wrong-model links refuse; they are never silently remapped. |
| 10–13 | Delivered: disclosure, explicit modes, paged trace and bounded payload contract; native test trace stepped in Chrome. | Producer-supplied summaries need producer-side redaction; no live debugger is claimed. |
| 14 | Delivered: synthetic 100/1000-owner profile, 40.09 ms median build and 1.41 ms mean query median on the measured host. | Browser-frame p95 and a production-scale performance promise are deferred. |
| 16–19 | Delivered: explicit Arrange/focus, local bookmarks and separated Problems/notes; selected Chrome flows. | Optimal large-graph layout and general virtualization remain deferred. |
| 20 | Delivered: supported source/transition/region draft lenses and source navigation. | Automatic invention of policy, deadlines and unsupported source edits is deferred. |
| 21, 22 | Delivered: scope-aware proof strip and a real-product overview/command entry, inspected on desktop and mobile. | Product-specific runtime proof still belongs to the product owner. |

## Seven failure cases

| Case | Status and evidence |
|---|---|
| 1. Camera after selection, stepping and source | Delivered for selected headed-browser flows; the graph is retained rather than rebuilt on selection. A full cross-product gesture matrix is deferred. |
| 2. One source draft across facets/products | Delivered for shared per-file draft identity in focused tests. A manual two-product editing session remains deferred because Studio does not write shared source by default. |
| 3. Build during draft/modal | Delivered for pending-draft candidate protection in focused tests. The exact modal timing race has not been manually run and is deferred. |
| 4. Partial then valid bundle, manifest change | Delivered by stable-candidate and invalid-bundle tests; manifest changes require restart by design. |
| 5. Reversed A/B/A replies | Delivered by generation-ticket guards and focused stale-response checks; a cross-product live network race is not claimed. |
| 6. Long trace, gaps and foreign link | Delivered by bounded trace/paging/gap/identity tests and a real seven-step native test trace. A 20,000-event glass pass is deferred. |
| 7. Reorder versus changed cell | Delivered by identity-keyed comparison tests; a reordered entity is not reported as replacement. |

The old living-documentation deferrals now resolve as follows: JUnit import, generated ProductSpec laws and optional `@covers`/`@proof` are delivered by the shared evidence adapters; automatic test-to-service coverage claims remain deliberately unsupported because a source mention is not executed coverage; live runtime observation remains deferred until a product-owned, authorized connector exists. Semantic CLI Q0–Q5 are implemented and exercised by the local CLI tests and real-product doctor/inspect/simulate/trace commands. No MCP, source-writing agent channel or arbitrary build runner was added.

## Original D0–D8 implementation cards

| Card | Status and remaining condition |
|---|---|
| D0 | Delivered for the four selected products: exact package pins, source digests, named artifacts and real compiler loads. A full Showcase fixture baseline remains deferred. |
| D1 | Delivered: bounded graph/table/machine inspection; native, web, AMUX and ai-dsl load through one core. |
| D2 | Delivered for pure finite table/machine simulation with exact cells and explicit unknown facts. Sensors, controllers and effects do not execute. |
| D3 | Delivered for supported source spans, digests and editability. General TypeScript symbol resolution and arbitrary computed expressions remain unsupported. |
| D4 | Delivered for selected literal/transition/region draft edits and semantic diff. General binding/mount/source-language editing is deferred. |
| D5 | Deferred: the current patch/Git draft path does not prove transactional writes against another editor's shared worktree. No automatic overwrite was added. |
| D6 | Delivered for local scenario documents and the bounded example mock; a real product service boundary with full offline effect control remains deferred. |
| D7 | Delivered for exact-model, bounded recorded test traces and count-only snapshot separation. Authenticated live observation and real payload playback are deferred. |
| D8 | Delivered for read-only mount/catalog inspection. Actual native/web preview adapters and visual component creation remain deferred. |

## Cross-product acceptance, CROSS-01–12

| Card | Status and remaining condition |
|---|---|
| CROSS-01 | Partially delivered: SKYVW and Showcase can load through the same inspection core; Showcase catalog-extension parity and connected preview are deferred. |
| CROSS-02 | Delivered: AMUX and ai-dsl table-only products use `product:null` without an invented app graph or copied evaluator. |
| CROSS-03 | Deferred: no independent fifth product fixture has passed the complete no-core-edit acceptance journey. Unknown schemas remain visibly unsupported. |
| CROSS-04 | Delivered by root-scoped project keys and per-project state; a manual same-ID multi-workspace collision journey remains deferred. |
| CROSS-05 | Partially delivered: canvas positions are view data, source drafts/scenarios have separate owners. Video-document undo is not a Studio write path. |
| CROSS-06 | Delivered by ticket/revision refusal in focused tests; a live A/B/A browser race across products remains deferred. |
| CROSS-07 | Deferred: no actual Showcase connected preview identity proof. Missing renderers remain unavailable. |
| CROSS-08 | Deferred: Studio only inspects ai-dsl's existing activity table; it does not integrate video preflight or the artifact resolver. |
| CROSS-09 | Deferred: offline mock/updater/QA effect isolation has not been exercised through a real product boundary. |
| CROSS-10 | Deferred: media clicked-frame/scrub identity stays with ai-dsl; Studio has not added a media-document adapter. |
| CROSS-11 | Partially delivered: source patches and product export reach the selected compiler. Video-document undo remains with ai-dsl and is not integrated here. |
| CROSS-12 | Delivered for English capability/mode labels and explicit unsupported states in the bounded workbench; preview support is never inferred from metadata. |

Deferred items are outside this bounded delivery. Reopen one only with its actual owner, adapter and acceptance evidence; do not count the disconnected storyboard as a finished runtime feature.
