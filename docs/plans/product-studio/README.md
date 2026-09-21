# Product Studio: visual DSL workbench

Status: **implementation handoff plus an interactive design reference, not an implemented editor**.
Date: 2026-09-21. All authored documentation, GUI copy, tooltips, errors, fixtures and accessibility labels for this work must be **English**. Preserve existing code identifiers; do not translate identifiers into UI-specific aliases.

## Start here

| Read | Purpose |
| --- | --- |
| [Architecture and pseudocode](ARCHITECTURE.md) | Loading, source provenance, validated editing, simulation, mocks and runtime evidence |
| [English UX specification](UX.md) | Screen layout, interaction flows, state distinctions, accessibility and exact copy |
| [Worker plan and acceptance tests](WORKERS.md) | D0-D8, dependencies, deliverables, failure cases and completion criteria |
| [Interactive English design reference](concept.html) | Open locally in a browser. A scripted, disconnected storyboard, not ProductSpec execution |

The existing [ProductSpec guide](../../../product-spec/GUIDE.md) defines the implemented language. [PR #263](https://github.com/adelost/circlekit/pull/263) addresses authoring ergonomics and canonical forms. This workbench is a separate slice: do not block a read-only viewer on all language improvements, and do not expand #263 into an editor platform.

## Decision

Build a local-first workbench over the existing ProductSpec compiler and product-owned runtime adapters. Use one model through several views:

- **System:** declared domains, typed ports, data/demand/context edges and actual binding evidence.
- **Logic:** decision tables and state-transition machines with exact deciding cell IDs.
- **Scenarios:** isolated synthetic inputs, fixture services, explicit virtual time and repeatable assertions.
- **Interface:** component composition and supported previews, clearly separating schematic previews from real native renderers.
- **Changes:** source diff, compiled semantic diff, diagnostics and explicit apply.

The source DSL remains authoritative. An inspector bundle, layout file, graph canvas or Stately export must never become a second product definition.

Choose an embedded web UI with a local Node workspace service. Recommended presentation stack: React Flow for typed-port/node interaction, Monaco for source editing, and the consumer's pinned TypeScript APIs for source analysis. These are presentation/tooling choices, not replacements for ProductSpec semantics. D0 verifies packaging and fit before adding dependencies. Reuse an existing suitable app shell when the owner identifies one; no framework migration is required by this plan.

## What exists in the inspected code

Rechecked branch heads for this handoff:

| Repository | Commit |
| --- | --- |
| `adelost/circlekit` main | `464f432fab90947c26b0e170c0ed6014504b654d` |
| `adelost/skydive-altimeter` main | `be4a4685fbb1ee83b0847a7008b73fee4ad96e01` |
| `adelost/agentmux` master | `1413687782c83305455efd2e98c0ca36994568be` |

Repository state is not installed-runtime evidence. Workers must resolve the actual package pins, generated artifact hashes and local changes at implementation time.

| Existing source | Supported claim | Boundary |
| --- | --- | --- |
| CircleKit `product-spec/src/product-model.ts` | Product IR schema 9 includes nodes, components, contracts through the port registry, mounts, navigation, tables and lanes | There is no universal `machines` field in this ProductIr interface |
| CircleKit `product-spec/src/decision-table-model.ts` | Closed axes, typed values, cells, mandatory checks and `decide` | Compiled invariant descriptions do not preserve the original callback code |
| CircleKit `product-spec/src/machine-model.ts` | `defineMachine` and pure `step(machine, state, input, guardsHeld)` | Returns `{to, cellId}`; does not execute native field updates, services or clock delivery |
| CircleKit `product-emit/src/core/emit-machine-stately.ts` | Generates a Stately/XState source projection | Explicitly export-only. Deadline/rest information is partly commentary; do not treat export execution as full semantic equivalence |
| SKYVW `appspec/generated/skyvw/skyvw.product.json`, `skyvw.graph.mmd`, `skyvw.domains.mmd` | Already compiled structure and derived graph views | Use structured model data, not Mermaid parsing, as the interactive model |
| SKYVW `appspec/generated/skyvw/skyvw.diagnostic.json` | Product/graph hashes and schema identity | Correlation integrity, not authentication or physical correctness |
| SKYVW `appspec/tools/port-ledger-graph.ts` and `appspec/README.md` | Bounded per-port counts, latest value/quality summary, recency and active-node snapshot | Not a full ordered event trace, not source freshness, not historical lease reasoning |
| SKYVW `appspec/products/skyvw/jumps/recording-machine.ts` | `recording.session`: four states and 17 declared transition cells | Actual recording algorithms and guard observations remain runtime-owned |
| SKYVW `appspec/products/skyvw/home/home-action-button.ts` and `emit/emit-component-bodies.ts` | One explicit component-body pilot emitted into Kotlin | Not a complete browser-renderable UI language |
| SKYVW `appspec/products/skyvw/qa/qa-scenes.ts` | Existing owned QA scene definitions with fixture and some live paths | Select fixture-only adapters for Studio simulation; not every scene is offline |
| AMUX `policies/context-cost.mjs` | Same ProductSpec decision-table API, 18 context-policy and 24 launch-policy points | Not a complete graph of AMUX. Current defaults are 100,000 tokens, 60-minute warm idle, 24-hour cold idle; do not reuse earlier policy values |

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

The first completed vertical slice is: load the real recording-machine declaration, explore it, simulate named guard facts with the existing `step`, edit one literal transition in a draft, show the exact source and semantic diff, validate through the real compiler, then apply only to an isolated Studio draft. Publishing changes into a shared worktree is a later guarded transaction, not an unprotected file write.

## What "create a program visually" means

From an available catalog, place an implemented component/service, connect compatible ports explicitly, configure supported fields, author table cells or transitions, and choose supported mounts. This can produce normal canonical DSL declarations and the normal generated output.

A new algorithm, sensor driver, persistence implementation, native renderer or external provider still needs a code implementation. Represent that as an honest code leaf with declared ports and `Implementation required`. Do not display a fictitious runnable application or auto-generate hidden behavior. Visual creation becomes progressively more capable as real reusable components and adapters become available, without replacing the language.

## Success criteria

A user can answer: what is declared, what actually ran, why this cell won, which input is unknown, what a mock replaces, and exactly what a visual edit changes in source.

The main quality constraint is not the number of node types. It is that diagram, code, compiler diagnostics and evidence refer to the same product identity without hidden behavior or silent source rewriting.

Start at D0/D1. Runtime mutation, external requests, package publication, paid model calls, broad platform rollout and production deployment are not authorized by this documentation task.
