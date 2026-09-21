# Product Studio: visual DSL workbench

Status: **implementation handoff plus an interactive design reference, not an implemented editor**.
Date: 2026-09-21. All authored documentation, GUI copy, tooltips, errors, fixtures and accessibility labels for this work must be **English**. Preserve existing code identifiers; do not translate identifiers into UI-specific aliases.

## Start here

| Read | Purpose |
| --- | --- |
| [Cross-product usefulness and adapter acceptance](CROSS-PRODUCT.md) | SKYVW, Showcase, video editor and AMUX tasks; shared capabilities, product-owned writes and required cross-product checks |
| [Architecture and pseudocode](ARCHITECTURE.md) | Loading, source provenance, validated editing, simulation, mocks and runtime evidence |
| [English UX specification](UX.md) | Screen layout, interaction flows, state distinctions, accessibility and exact copy |
| [Worker plan and acceptance tests](WORKERS.md) | D0-D8, dependencies, deliverables, failure cases and completion criteria |
| [Interactive English design reference](concept.html) | Open locally in a browser. A scripted, disconnected storyboard, not ProductSpec execution |

CROSS-PRODUCT adds requirements to the existing D0-D8 cards, not a second project. Use one workbench with product-owned adapters and useful representations: graphs for dependencies, matrices for decisions, a component gallery for Showcase, and existing media viewers for video artifacts. Source-draft mechanisms must respect each repository's writer/isolation policy; they do not replace a video project's document and undo owner. The HTML reference still covers only the earlier SKYVW storyboard, not these integrations.

The existing [ProductSpec guide](../../../product-spec/GUIDE.md) defines the implemented language. [PR #263](https://github.com/adelost/circlekit/pull/263) addresses authoring ergonomics and canonical forms. This workbench is a separate slice: do not block a read-only viewer on all language improvements, and do not expand #263 into an editor platform.

## Decision

Build a local-first workbench over the existing ProductSpec compiler and product-owned runtime adapters. Use one model through several views:

- **System:** declared domains, typed ports, data/demand/context edges and actual binding evidence.
- **Logic:** decision tables and state-transition machines with exact deciding cell IDs.
- **Scenarios:** isolated synthetic inputs, fixture services, explicit virtual time and repeatable assertions.
- **Interface:** component composition and supported previews, clearly separating schematic previews from real native renderers.
- **Changes:** source diff, compiled semantic diff, diagnostics and explicit apply.

The source DSL remains authoritative. An inspector bundle, layout file, graph canvas or Stately export must never become a second product definition.

Choose an embedded web UI with a local Node workspace service. Recommended presentation stack: React Flow for typed-port/node interaction, Monaco for source editing, and the consumer's pinned TypeScript APIs for source analysis. These are presentation/tooling choices, not replacements for ProductSpec semantics. D0 verifies packaging and fit before adding dependencies. Reuse an existing suitable app shell when the owner identifies one; no framework migration is required by this plan. Start cross-product access with exact selection links to the same workbench; embedding does not require porting the whole GUI to every consumer framework.

## What exists in the inspected code

Rechecked branch heads for this handoff and its cross-product addendum:

| Repository | Commit |
| --- | --- |
| `adelost/circlekit` main | `464f432fab90947c26b0e170c0ed6014504b654d` |
| `adelost/skydive-altimeter` main, original handoff baseline | `be4a4685fbb1ee83b0847a7008b73fee4ad96e01` |
| `adelost/agentmux` master, original handoff baseline | `1413687782c83305455efd2e98c0ca36994568be` |
| `adelost/ai-dsl` master, cross-product addendum | `949a66fcecedc15dbc5b7d7410367f44713d2068` |

Repository state is not installed-runtime evidence. Workers must resolve the actual package pins, generated artifact hashes and local changes at implementation time.

| Existing source | Supported claim | Boundary |
| --- | --- | --- |
| CircleKit `product-spec/src/product-model.ts` | Product IR schema 9 includes nodes, components, contracts through the port registry, mounts, navigation, tables and lanes | There is no universal `machines` field in this ProductIr interface |
| CircleKit `product-spec/src/decision-table-model.ts` | Closed axes, typed values, cells, mandatory checks and `decide` | Compiled invariant descriptions do not preserve the original callback code |
| CircleKit `product-spec/src/machine-model.ts` | `defineMachine` and pure `step(machine, state, input, guardsHeld)` | Returns `{to, cellId}`; does not execute native field updates, services or clock delivery |
| CircleKit `product-emit/src/core/emit-machine-stately.ts` | Generates a Stately/XState source projection | Explicitly export-only. Deadline/rest information is partly commentary; do not treat export execution as full semantic equivalence |
| CircleKit `showcase-product/src/product.ts` | ProductIr plus real Showcase catalog extension and declared platform profiles | Catalog/profile declarations are not proof of connected native previews; preserve the existing conformance owners |
| SKYVW `appspec/generated/skyvw/skyvw.product.json`, `skyvw.graph.mmd`, `skyvw.domains.mmd` | Already compiled structure and derived graph views | Use structured model data, not Mermaid parsing, as the interactive model |
| SKYVW `appspec/generated/skyvw/skyvw.diagnostic.json` | Product/graph hashes and schema identity | Correlation integrity, not authentication or physical correctness |
| SKYVW `appspec/tools/port-ledger-graph.ts` and `appspec/README.md` | Bounded per-port counts, latest value/quality summary, recency and active-node snapshot | Not a full ordered event trace, not source freshness, not historical lease reasoning |
| SKYVW `appspec/products/skyvw/jumps/recording-machine.ts` | `recording.session`: four states and 17 declared transition cells | Actual recording algorithms and guard observations remain runtime-owned |
| SKYVW `appspec/products/skyvw/home/home-action-button.ts` and `emit/emit-component-bodies.ts` | One explicit component-body pilot emitted into Kotlin | Not a complete browser-renderable UI language |
| SKYVW `appspec/products/skyvw/qa/qa-scenes.ts` | Existing owned QA scene definitions with fixture and some live paths | Select fixture-only adapters for Studio simulation; not every scene is offline |
| AMUX `policies/context-cost.mjs` | Same ProductSpec decision-table API, 18 context-policy and 24 launch-policy points | Not a complete graph of AMUX. At the reviewed revision defaults are 100,000 tokens, 60-minute warm idle, 24-hour cold idle; do not reuse earlier policy values |
| Video `ui/scripts/lib/studio-activity-product.mjs` | Actual shared ProductSpec activity table, 36 points and nine cells, plus state presentation | A finite status classifier, not the complete Python worker engine or video document |
| Video `docs/lego-lab.md` and `ui/src/lib/studio/editProjectState.js` | Existing sandbox/catalog seams and an existing project-keyed edit-session boundary | Integrate existing execution/document owners; do not replace them with a new scheduler or Git-based video-save path |

Source references are the repo-relative paths at the commits above. The prior conversation's rendered mockups are inspiration, not evidence about these repositories.

## Corrections to the earlier pictures

Do not implement invented items from a generated image:

- No new `rules`, `onSelect`, `background` interaction timing, arbitrary effects DSL or generic success/partial outcomes are introduced.
- SKYVW and AMUX are separate product selections. AMUX is not automatically a service inside SKYVW just because both use ProductSpec.
- Item counts, successful checks, latency numbers and live badges must come from a real loaded artifact or clearly marked fixture. The prototype's short path is explicitly a sample.
- Current machine guards are supplied facts. A toggle in simulation does not prove that a native sensor or predicate produced that fact.
- A green port-activity indicator does not mean the underlying weather/location data is fresh.
- A machine graph cannot be promoted to a runnable whole application without implementations for its native/code leaves.
- The English reference replaces the earlier Swedish image as the GUI copy specification. The earlier raster images are not imported into the repo as authoritative specifications.

## Can the current DSL be parsed and edited visually?

**Yes, with a precise scope.** Syntax parsing of TypeScript/JavaScript yields an AST. Compiling the product yields its normalized meaning. These are different jobs.

Use the compiled model to draw and query the program. Use symbol-resolved AST locations and explicitly supported authoring patterns to propose source edits. Do not reconstruct the original source from JSON: imports, helper families, computed expressions, comments and invariant functions cannot generally be recovered that way.

A field is one of `editable`, `shared`, `derived`, `external` or `unsupported`. The GUI explains why it cannot edit something and offers `Open source`. It never silently flattens a helper, duplicates a library declaration or drops a law to make an edit possible.

The first target vertical slice is: load the real recording-machine declaration, explore it, simulate named guard facts with the existing `step`, edit one literal transition in an allowed draft mechanism, show the exact source and semantic diff, validate through the real compiler, then apply only through its authorized source owner. Publishing changes into a shared worktree is a later guarded transaction, not an unprotected file write. See CROSS-PRODUCT for repository no-copy constraints and the distinct video-document command path.

## What "create a program visually" means

From an available catalog, place an implemented component/service, connect compatible ports explicitly, configure supported fields, author table cells or transitions, and choose supported mounts. This can produce normal canonical DSL declarations and the normal generated output.

A new algorithm, sensor driver, persistence implementation, native renderer or external provider still needs a code implementation. Represent that as an honest code leaf with declared ports and `Implementation required`. Do not display a fictitious runnable application or auto-generate hidden behavior. Visual creation becomes progressively more capable as real reusable components and adapters become available, without replacing the language.

## Success criteria

A user can answer: what is declared, what actually ran, why this cell won, which input is unknown, what a mock replaces, and exactly what a visual edit changes in source.

The main quality constraint is not the number of node types. It is that diagram, code, compiler diagnostics and evidence refer to the same product identity without hidden behavior or silent source rewriting. Cross-product acceptance is the four real journeys and CROSS-01 through CROSS-12 in CROSS-PRODUCT, not four product names in a dropdown.

Start at D0/D1. Runtime mutation, external requests, package publication, paid model calls, broad platform rollout and production deployment are not authorized by this documentation task.
