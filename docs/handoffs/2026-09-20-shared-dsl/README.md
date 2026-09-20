# Shared ProductSpec: SKYVW, AMUX and ai-dsl

**Recommendation: keep one CircleKit semantic kernel; migrate one real product boundary at a time; remove redundant authorship without removing independent requirements, runtime evidence or the existing domain owners.**

Date: 2026-09-20. Status: reviewed handoff, implementation OPEN. Requested by Mattias. The priorities and proposed APIs here are the reviewer's choices. This is not authorization to publish packages, invoke paid models, send footage to a provider, restart agents, deploy devices, change access or delete data.

## Start here

Read this file, [MIGRATION.md](MIGRATION.md), then the applicable recipe in [RECIPES.md](RECIPES.md). They are one delivery, not three competing plans. Keep the existing [authoring-DX work cards W0-W6](../../plans/2026-09-20-product-spec-authoring-dx.md#worker-entrypoint) for the shared syntax work. The ai-dsl plan `.planning/PLAN-circlekit-adoption-2026-09-20.md` supplies its P0-P5 work; this handoff sharpens its dependencies and evidence boundaries.

Start two bounded tracks, not a global rewrite:

1. CircleKit W0/W1 with one real SKYVW interaction family and its negative examples.
2. ai-dsl P0: package/browser feasibility and one read-only status baseline. This does **not** depend on SKYVW's interaction helper or AMUX's axis renaming.

Do not start all the alternatives. Do not put a new parser, state runtime, database, generic scheduler or theme migration inside this task. Implementations stay in their owner repositories. Code with declared, tested boundaries remains a valid leaf.

## 1. Snapshot and actual integration level

All references below are pinned reading points, not promises about later HEADs. Re-read affected files and installed lockfiles before implementation.

| Repository / surface | Reviewed revision | Manifest dependency on product-spec | What is actually present |
|---|---|---|---|
| `adelost/circlekit` | `00958f02442f58ee24750a2747281a76118858ea` | Package source says 0.3.65 | Shapes, validators, decision/machine evaluators, state authorities and emitter support |
| SKYVW native, `adelost/skydive-altimeter` | `9942a1d78448b7132299cc1cbc9e71f2ce70c1ab` | `appspec`: 0.3.63 | Existing native product authoring, interaction/settings declarations and generation |
| SKYVW web, `adelost/skyvw-web` | `a4849d6bf96b9f4e192fc613cdb212d54c769daf` | 0.3.52 | Bounded `compileProductGraph` logbook graph and executable generated-connection bindings |
| AMUX root, `adelost/agentmux` | `d94b25560b17fb94b02aeefc9b11ee7bd04ca95b` | 0.3.54 | Decision tables imported by the actual cost/launch policy |
| AMUX Link, same repository | same revision | nested product package: 0.3.64 | State authorities, product graph and Kotlin-facing presentation/binding layer |
| `adelost/ai-dsl` | `20ece0d14196a4cfbb71a1a9a80004afc2692d6a` | None in the inspected UI manifest | Existing V1D, edit session, job runtime, pure projections and generated operation inventory; migration plan only |

The CircleKit source package version is not its overall repository release number (0.3.114). These are manifest pins, not verification of what a running device or agent has loaded. No simultaneous upgrade of all products is proposed. Record the compiler/emitter pair and artifact schema separately from the authoring package version.

The open CircleKit PR #263 was read at `f8bef4671636da9b1f95bc9834a8b6ae9c73e39e`. Its W0-W6 helpers and enforcement are proposed, not implemented APIs. This cross-product handoff belongs with that documentation work, not in a second DSL fork.

## 2. Findings that change the plan

### F01. Same package family does not mean the same guarantees everywhere

SKYVW web's `src/logbook/product.ts` calls `compileProductGraph`, while full `defineProduct` additionally owns product/state-authority/navigation composition. AMUX's root uses standalone decision tables; Link uses a broader product graph. These are useful bounded integrations, but must not be called an app-wide proof of single-state ownership.

`valueRef("logbook-model")` is an opaque domain reference, not automatic validation of every nested field inside that model. A compile-time edge match does not validate a JSON response or prove a Kotlin callback ran. Name the exact validator, actual binding and runtime proof for each claimed guarantee.

**Action:** every migrated slice records its validation scope. Use an existing full validator where its requirements apply. If a bounded public API lacks a required guarantee, identify that exact gap in CircleKit rather than faking a complete product or writing a private checker in each app.

### F02. ai-dsl's existing transaction boundary is narrower than “all document state”

`createEditSession().applyEditTurnAtomically` checks timeline revision/digest and duplicate turn identity, drafts changes, then uses the existing commit/history seam. Preserve it.

In the same file, `addSource`, `updateSource`, `addMarker` and `removeMarkerAt` are explicitly outside timeline undo. They change the document without being the same timeline transaction. This is a **verified distinction in source**, not a newly reproduced corrupt-project incident.

**Action:** do not claim that a timeline digest covers source bindings, marker evidence, representation transforms or every artifact used by an AI decision. Map dependencies for each operation. Preserve current source/annotation behavior in a syntax migration; add any needed binding-revision check as a separate behavior change with a failing-before test. Do not silently redefine all annotations as undoable timeline edits.

### F03. The latest AMUX policy is not the earlier transcript's policy

Current `CONTEXT_COST_POLICY.maxTokens` is **100,000**, not 150,000. Its context table still has 18 points and launch table 24. The rename task must preserve the latest threshold, cells, outputs, invariant predicates and actual receipt checks.

`core/codex-launch-policy.mjs` validates the supplied receipt against the resumed session before classifying it for the table. Keep that real evidence check. A boolean or the word `VERIFIED` in a table is not itself proof of compaction.

**Action:** retain W4 as a naming change only. A fake-evidence/launch regression belongs in a separate correctness change, never hidden inside axis cleanup. No live compact or launch is needed to test renaming.

### F04. Boilerplate reduction has valuable limits

Actual SKYVW interaction IDs include `action.live-iso-reset-view` and `mount.live-iso-reset...`. They are not uniformly derivable from a shortened slug. Required phone/wear coverage is separate from the supplied mount list. The settings source contains FLIGHT order `0,4,5,1,2,3` and SYSTEM seats `0,3`. Array renumbering would change product meaning.

**Action:** W1 preserves exact IDs/timing/requirements; W2 starts with the contiguous UNITS slice only. `family` is already available and its basic type/runtime rejection was checked in this review. Prefer it to another helper when it expresses the relation. A mapped tuple helper must preserve literal identities; broad `Setting[]` return types can weaken menu-reference checking.

### F05. The browser/package boundary is a real P0 check, not a reason for a framework rewrite

CircleKit's current source package requires Node >=22. AMUX's root advertises >=20; that is a compatibility question for an upgrade, not proof its currently pinned older version is broken. ai-dsl/skyvw-web need their actual bundler paths checked. The package root exports Node-side pin tooling; `/foundation` is a specific adapter-inspection entry, **not** a generic browser runtime escape hatch.

**Action:** verify a published immutable package, lock integrity, actual exports and target runtime. Build-time validation can run in Node. Browser code must use an intended verified public entry or generated pure data. Do not deep-import private dist files or copy the compiler into ai-dsl. A needed portable export belongs in CircleKit with a targeted test.

### F06. Declaration coverage is not runtime evidence or a transaction

`defineMachine` is a pure transition contract, not a timer/IO/lock engine. Reachability is checked with guards abstracted away; a declared deadline is not proof that the clock fires. Native conformance must be based on actual registered handlers/mounts, not a manifest copied from the expected graph.

**Action:** distinguish authored requirements, compiled data, bound implementation, and observed behavior. A generated test over generated expected data proves internal consistency, not the user's visible result. See the layered acceptance matrix in MIGRATION.

### F07. Safety wording around enum growth and ratings needed correction

An omitted decision-table axis covers all of its declared values. A new enum value can therefore remain covered without a build error. Exhaustiveness does not automatically mean every domain expansion requires a new cell. Preserve this meaning; add an explicit review/test for critical domain expansions.

The previous 9/10 ratings, “75% optimized”, “70-80% benefit” and confident P0-P3-in-20-hours claim were not measured. They must not become worker acceptance evidence. Treat 20 hours as a time budget with a checkpoint, not a guarantee that all asynchronous and Apply behavior is migrated.

The previously shown `defineActionFamily`, `settingsSection` and simplified `component(...)` examples were illustrative. Do not copy them as current exports. RECIPES separates current API from proposed helper implementation and application pseudocode.

## 3. Shared architecture rules

| Concern | One author | What must stay independent |
|---|---|---|
| Language meaning and mandatory shape laws | CircleKit product-spec | Product behavior fixtures and negative mutations |
| Platform emission and translation | Existing shared/platform emitter owner | Actual runtime registrations and pixel/event/timing proofs |
| Domain meaning | Existing product/domain package | Provider observations, source files and server receipts |
| Persisted/operational state | Existing runtime/store/session owner for that domain | UI-derived view and user demand |
| Closed product decision | One declared table/machine or justified code leaf | Input observation/classification and effect execution |
| Presentation | One scoped, derived model per responsibility | Legitimate local UI state such as an expanded panel |
| Generated files | Compiler/emitter output, never manual authoring | Checked-in previous output before regenerating a baseline |

“One author” does not require one global store, one graph for every runtime object, or one incoming UI port for an entire app. Multiple explicit ingress ports may call the same canonical writer. Do not confuse graph fan-in/cardinality with the number of legitimate user entrypoints.

No automatic wiring by compatible type, no inference of required hosts from observed mounts, no IDs from line numbers or labels, no permanent verbose/concise dialect split. Low-level forms remain legitimate inside decoders, compiler internals and negative tests; those are not a second preferred product-authoring style.

Finite decision spaces should stay small. State space grows by multiplying axis sizes. Separate genuinely independent decisions, but do not split coupled outputs that must be chosen together. No new type-level solver or asynchronous workflow language is justified by this handoff.

## 4. What was actually checked

Repository reads covered the source map below and the previous plans, including critical runtime call sites. This was not a line-by-line audit of five repositories, a full native/web test run or a proof that every task in every ledger is closed.

Executed locally:

- `family-model.ts`: the **entire unmodified 1,446-byte source**, Git blob `f7e17120e250cb5650e56b35899da103c4533929`, compiled with local TypeScript 5.8.3 and tested with Node 22.16.0. Three checks passed: literal inference; compile-time rejection of a shared-field restatement; runtime preservation/refusal cases.
- AMUX `context-cost.mjs`: the **entire unmodified 5,117-byte source**, Git blob `7bb913e8660c7cae48ea9e2e3534ebbefb704f03`, loaded with recording collaborators in place of its ProductSpec import. Seven checks passed, including independent enumeration of all 42 policy points, invariants, axis-mapping parity and current threshold boundaries. This is explicitly **not** execution of the installed ProductSpec compiler or live AMUX.

Scripts and raw results: [check-family.py](check-family.py), [check-amux-enumeration.mjs](check-amux-enumeration.mjs), [evidence/family.json](evidence/family.json), [evidence/amux.json](evidence/amux.json). Pass counts are not a product quality score. No product fix was attempted, so these are not claims of a fixed-before/after symptom.

A local tarball download attempt failed DNS resolution for circlekit.pages.dev. GitHub search also returned upstream 502 errors; known paths and Git data were read through the connector instead. No published-package installation, package-integrity check, full ProductSpec/emit test or native/browser run is claimed. These stay explicit work-card gates.

## 5. Source map for the next agent

Paths use the pinned revisions above. Read actual installed consumer versions too; source HEAD is not a substitute for a pinned package.

**CircleKit:** `product-spec/GUIDE.md`, `README.md`, `package.json`, `src/{family-model,decision-table-model,machine-model,state-authority-model,node-model,product-model,foundation,pin-check,index,frozen}.ts`; previous W0-W6 handoff in PR #263. `product-spec/GUIDE.md` is the existing language reference. State/graph files were inspected in targeted sections, not claimed exhaustively tested.

**SKYVW native:** `appspec/package.json`, `appspec/products/skyvw/menus/interactions.ts`, `appspec/products/skyvw/settings/settings-components.ts`. The native UI, sensor behavior and actual device output were not run here. Preserve existing safety/timing behavior; prove native changes through the owner's normal replay/device fixtures, not a new flight test.

**SKYVW web:** `package.json`, `src/logbook/product.ts`, `src/logbook/bindings.ts`; follow referenced generated connections and details/replay/account/manual-editor surfaces when migrating each one. Current evidence is the bounded graph and real binding function, not certification of all web views.

**AMUX:** `package.json`, `policies/context-cost.mjs`, `core/codex-process-launch.mjs`, `core/codex-launch-policy.mjs`, `android/audio-inbox/product-spec/{package.json,src/state-authorities.ts}`, and `android/audio-inbox/link-ui/src/main/java/io/agentmux/linkui/product/LinkProductPresentations.kt`. Read actual port registration/conformance tests before changing Link.

**ai-dsl:** `ui/package.json`, `ui/src/lib/studio/{activity,activity.test,editProjectState}.js`, `ui/src/stores/jobs.svelte.js`, `ui/src/lib/jobStateMachine.js`, `ui/src/lib/edit/{intents,editTurnContract}.js`, `ui/src/stores/generated/scoped_operations.json`, and the August capability plan plus September CircleKit/360 plans. Source/annotation semantics in intents were re-read for this handoff.

Primary public documentation used for general language/runtime boundaries:

- TypeScript exhaustiveness: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- TypeScript assertions are not runtime validation: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html
- Svelte derived-state/effect guidance: https://svelte.dev/docs/svelte/$effect
- Node package exports: https://nodejs.org/api/packages.html

These support only the general distinctions. Product behavior claims above come from repository source or the labelled local probes.
