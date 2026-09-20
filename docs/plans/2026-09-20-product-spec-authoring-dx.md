# ProductSpec authoring DX: worker handoff

Status: design handoff, not implemented. This PR changes documentation only.
Updated: 2026-09-20. Supersedes the earlier versions of this handoff.

## Worker entrypoint

**Decision: evolve the existing embedded ProductSpec DSL. Do not create a new language or a second spelling of the same grammar.** Remove repeated authorship, preserve independently meaningful requirements, and enforce the selected authoring form for its proven scope.

The operator requested less boilerplate, better developer experience, shared use by SKYVW and AMUX, and enforcement rather than optional recommendations. The API choices, work order and acceptance targets below are this reviewer's recommendations, not claims that the operator selected each proposed identifier.

Start with W0 and W1 below. Do not implement every evaluated alternative. A small feature set is deliberate; using an adopted canonical form is mandatory, not optional.

| Work | Owner by responsibility | Deliverable | Depends on |
| --- | --- | --- | --- |
| W0 | First implementer | Small baseline and negative fixtures from real consumers | None |
| W1 | Shared authoring owner, then SKYVW owner | One interaction family normalizer, consumer migration and enforcement | W0 |
| W2 | Shared settings owner, then SKYVW owner | Ordered-section helper for an actually equivalent sequence | W0; keep separate from W1 |
| W3 | ProductSpec owner | Preserve and test inference; prototype reference handles only for a demonstrated gap | W0 |
| W4 | AMUX owner | Precise axis names with unchanged decisions and explicit trace migration | W0 |
| W5 | Compiler/source-check owner | Consistent diagnostics and canonical-source checks using existing tooling | Ships with each affected slice |
| W6 | Integration owner | Published-pin adoption, local verification, documentation and compatibility retirement | Accepted slices only |

All implementation work is OPEN in this handoff. Do not mark a row complete because this document exists. Each implementation PR records: source SHA, found duplication, chosen change, proof, exclusions and remaining work. Follow current repository ownership and release rules. Do not restart agents, invoke models, compact sessions, change permissions or publish a package merely to validate this document.

## 1. Source baseline and reading map

The review inspected these repository snapshots. Recheck affected files and package pins before implementation; do not substitute a newer kit checkout for the version a consumer actually installs.

| Repository | Reviewed commit | Relevant source |
| --- | --- | --- |
| CircleKit | `00958f02442f58ee24750a2747281a76118858ea` | `product-spec/GUIDE.md`; `product-spec/src/decision-table-model.ts`; `product-spec/src/family-model.ts`; `product-spec/src/node-instance-model.ts`; `product-emit/src/skydiving/compile-interactions.ts` |
| SKYVW, in `adelost/skydive-altimeter` | `9942a1d78448b7132299cc1cbc9e71f2ce70c1ab` | `appspec/products/skyvw/menus/interactions.ts`; `appspec/products/skyvw/settings/settings-components.ts`; `docs/plans/2026-09-17-dsl-language-freeze.md` |
| AMUX, in `adelost/agentmux` | `22a8bed2d4dc48d3c9c27bf76f555bc4502de4b2` | `policies/context-cost.mjs` |

Read the [current DSL guide](../../product-spec/GUIDE.md) for implemented vocabulary, then the named source for the shape being changed. The earlier SKYVW language-freeze document includes future forms and historical implementation statuses. It is not evidence that a later implementation is absent. The current guide already describes machines and emitters.

Source findings, not new proposals:

- `family(shared)` already exists. It rejects a row restating a shared key, both in its type signature and at runtime. Its output is a plain record.
- `defineDecisionTable`, `on`, `choice`, `DecisionPoint` and `decide` already preserve useful generic information. `decide(table, point)` is not inherently less type-safe than a method call.
- `ProductOutputPortRef`, `ProductInputPortRef`, `ExactNodeInstances` and `ExactComponentInstances` already constrain string references using contracts, instances and port names. Strings are not automatically untyped.
- Interaction compilation already checks duplicate identities, mount kind, host coverage, timing membership and setting/control parity.
- The inspected AMUX context table has 3 x 2 x 3 = 18 points and six cells; its launch table has 3 x 2 x 2 x 2 = 24 points and six cells.

Evidence boundary: this review used repository source reads and primary documentation. A small independent enumeration over transcribed AMUX cells confirmed the 18/24 counts and one-to-one axis-renaming equivalence; it was not a ProductSpec execution or repository test run. Local GitHub downloading failed DNS resolution. No compiler, emitter, linter or live application improvement is claimed as implemented or benchmarked here.

## 2. Corrections that prevent a bad implementation

These supersede overly broad advice in earlier handoffs and discussion.

| Earlier simplification | Correction and consequence |
| --- | --- |
| Derive every `requiredHosts` from mounts | Required coverage and supplied mounts can be independent facts. Deriving both from the same list makes a missing platform undetectable. Declare the obligation once per appropriate scope, or reference an existing independent artifact requirement; validate placements against it. |
| Array order already owns settings order | Not in the current flat list. FLIGHT entries occur with orders `0,4,5,1,2,3`; SYSTEM includes `0` and `3`. Blindly numbering the existing array changes the product. |
| Derive all stable IDs from a short name | Current `action.live-iso-reset-view` uses `mount.live-iso-reset...`. Stable IDs are not uniformly reconstructible. Preserve them explicitly unless a specific derivation is proved. |
| Shorter interaction example can switch `deliberate` to `immediate` | That changes behavior. The example below keeps `deliberate`. Timing corrections require a separate behavior change and proof. |
| Every new enum value necessarily causes a compiler error | An omitted axis covers all declared values, including new ones. Holes and overlaps fail, but a broad region can still cover an added value. Preserve that documented meaning; test critical domain changes explicitly. |
| Raw string references must all be replaced | Existing references already have type constraints. A handle must improve navigation, locality or inference without weakening those constraints or adding cycles. A global string ban is not justified. |
| Identical trees must always be shared | Identical bytes can represent independently evolving decisions. Enforce reuse for an identified shared family, not accidental visual similarity across unrelated screens. |
| A single declaration object is always better than declaration plus compiled table | Separate raw declarations can support focused negative tests or tooling. That is not duplicate semantic authorship. Do not lint it merely for having two variables. |
| An unconditional failed-compact invariant is harmless cleanup | AMUX currently permits `CONTINUE` when `need=NONE`, including `attempt=FAILED`. Removing the original `need=COMPACT` condition changes the policy. Preserve all invariant predicates during DX-only changes. |

The first distinction is fundamental: **remove duplicate authorship, not independent evidence.** Expected versus observed is a valuable comparison. Two generated copies of the same mistaken input are not independent evidence.

## 3. Chosen design

Keep one semantic kernel with these boundaries:

```text
authoring data + small pure construction helpers
    -> existing normalizers and mandatory validators
    -> deterministic, data-only compiled representation
    -> platform emitters or ordinary runtime controllers
    -> independent conformance and behavior evidence
```

The authoring layer may use normal TypeScript/JavaScript functions to construct declarations. Build-time invariants are also functions. Functions do not thereby become legal cell values or serialized IR. Do not add methods, closures, native symbols, clocks or network clients to compiled product data.

Keep `service`, `derive`, `present`, components, contracts, tables, lanes and the existing machine vocabulary. Preserve explicit ownership of effects and state. Existing native/code leaves remain valid. There is no DSL coverage target and no instruction to reimplement controller locks or provider IO as decision-table cells.

### What an author should still write

| Category | Rule |
| --- | --- |
| Product meaning | Explicit: desired hosts, action timing, boundaries, default preference, thresholds, units, externally stable identity |
| Structural consequence | Derived: mount kind when the chosen action form fixes it, source declaration identity when contractually equal to action identity |
| Shared family fact | Written once in the family: source file, intentionally common host obligation or mount category |
| Runtime evidence | Observed independently: actual mounted hosts, delivered values, provider receipt, live process/session/model |

Do not infer meaning from a label such as `DELETE`, from file layout, from compatible port types, or from what happens to be mounted. Do not generate persistent identities from array position, source line, display text or object-property order.

### Construction API rules

Use existing `family` before adding a special-purpose factory. Add a helper only when it encapsulates a real relation that `family` cannot express cleanly, such as deriving a nested source identity while validating a host obligation. Keep normalization pure, deterministic and free of global registration.

New helper inputs preserve literal types and tuple positions, with generics hidden from ordinary call sites where inference suffices. A caller should not need `as any`, `as never` or handwritten unions to use a normal declaration. Type assertions inside a proven implementation are a separate concern from bypasses in product authoring.

Reject conflicting restatements instead of letting a deep merge silently overwrite shared facts. Do not add a family-inheritance hierarchy, mixin precedence system or configuration overlay language. One scoped family and its explicit members are enough for the first slice.

Keep maps for uniquely named fields and arrays for ordered members or entries whose duplicates need diagnosis. In particular, replacing an array with a JavaScript object can lose duplicate entries before runtime validation. Do not trade duplicate-ID detection for a shorter literal.

## 4. Alternatives considered

This table records reviewer tradeoffs, not performance measurements. The selected direction is embedded ProductSpec with small proven normalizers and enforced canonical source forms.

| Alternative | Potential gain | Decision for this work |
| --- | --- | --- |
| Existing object literals and `on(...)` | Familiar, inspectable data and existing checks | Keep as semantic foundation. |
| Small typed construction helpers | Remove repeated structure without hiding decisions | Choose for W1/W2 after exact equivalence tests. |
| Existing `family(shared)` | Shared fields once, conflicting restatements rejected | Reuse before adding factories. |
| Fluent chains and `.decide()` on every table | Shorter call spelling | Do not add now: another API and method-bearing objects are not needed for inference. |
| Rename core keywords to `facts/rules/laws/when` | More conversational words | Reject parallel spelling; keep `axes/columns/cells/invariants/on`. |
| Single-output shorthand returning a scalar | Saves `{ action: ... }` | Defer: current named output works with multi-output SKYVW tables and exposes output identity. |
| Positional tuples, symbols or string expressions | Fewer characters | Reject for policy regions: loses named context and adds parsing/position knowledge. |
| YAML/JSON as the authoring language | Tool-neutral interchange | Keep serialization separate; do not migrate authorship merely for shorter files. |
| External DSL using Langium or another grammar tool | Dedicated syntax and editor tooling | Defer: no demonstrated need outweighs a parser, grammar, diagnostics and migration surface. See references. |
| Infer axis domains from the cells | Avoid enum declarations | Reject: an omitted case could also disappear from the inferred domain. |
| Default or first-match decision-table rules | Fewer rows | Reject for tables: hides holes or overlaps. Do not confuse this with separately specified machine semantics. |
| Automatic wiring by contract type | Fewer edges to write | Reject: compatible does not mean intended source. |
| Typed reference handles | Navigation to definitions and reusable exact identity | Prototype only against the existing typed-string baseline. |
| Automatic extraction of all repeated trees | Fewer repeated layouts | Reject global extraction; use explicit semantic families only. |
| A large `defineSkydivingProduct` facade | Central place to call validators | Defer an omnibus API. First prove a missing mandatory-validation path; fix ownership there without a platform framework. |
| A second schema library or validation DSL | Reuse another ecosystem | Do not add now. Current ProductSpec shapes remain authoritative; exports/adapters must derive from them. |
| Regex-only lint versus symbol-aware source analysis | Regex is cheap to start | Choose source analysis for enforcing imports/calls; reuse installed tooling, no second parser stack just for this plan. |
| Formatters and codemods | Low-effort consistent syntax and migration | Use formatting for layout; use a proven codemod for canonical transformations. Neither replaces semantic validation. |
| Generated inspectors and graph editors | Easier debugging | Start with a textual decision/source view from existing data. Defer a custom editor or editable graph. |
| Encode all combinations in TypeScript's type system | Very early errors | Keep local inference there; retain runtime declaration validation for exhaustive graph/table checks and JS consumers. Do not create an enormous type-level solver. |

Ordinary TypeScript can also enforce exhaustive `switch` statements with `never`. ProductSpec is justified here by its multidimensional regions, overlap checks, stable decision provenance and shared emitters, not by a claim that plain code cannot be exhaustive.

## 5. Concrete authoring targets

### 5.1 W1 interaction family: one requirement, explicit placements

**Proposed API, not an existing export.** Finalize this spelling in the implementation fixture before publication. The existing explicit declaration is the compatibility oracle, not a second preferred product-authoring style.

```ts
const action = defineActionFamily({
  sourceFile: "appspec/products/skyvw/menus/interactions.ts",
  requiredHosts: ["phone", "wear"],
});

export const skyvwInteractions = [
  action({
    id: "action.replay-clouds",
    timing: "deliberate",
    mounts: [
      { id: "mount.replay-clouds.phone-menu-row", hosts: ["phone"] },
      { id: "mount.replay-clouds.wear-face-tool", hosts: ["wear"] },
    ],
  }),
];
```

The family states which hosts are required independently of which mounts were supplied. Removing the wear mount must fail. Required coverage may instead come from a canonical artifact requirement only after that relationship is traced and tested; do not fabricate such a relationship.

Normalize into the existing form: discrete action kind, branded control/mount identities, atom mount kind, per-mount host lists, family host obligation, and source with declaration identity equal to the action ID. Keep full IDs and ordering byte-for-byte. Keep timing explicit and unchanged. Support multiple mounts on one host; do not reduce the model to one mount per host unless the underlying shape requires it.

For a family whose members genuinely require different host subsets, use the appropriate explicit requirement per scope. Do not silently broaden or narrow requirements to make an example pass. Source provenance is shared per file, not globally across unrelated files.

### 5.2 W2 ordered sections: start where equivalence is demonstrable

**Proposed API, not an existing export.** The contiguous UNITS rows are a smaller first candidate than the interleaved DISPLAY or FLIGHT rows.

```ts
settingsSection("UNITS", [
  altitudeUnitSetting,
  distanceUnitSetting,
  dateFormatSetting,
]);
```

This derives sequence positions `0,1,2`, not arbitrary stable seats. Preserve the surrounding catalog order, literal setting identities and the tuple information used to derive legal menu references. Test a menu referencing a setting that is not mounted.

Do not automatically renumber sparse SYSTEM seats or reorder the flat catalog. A stable seat and a list position are different concepts and can legitimately have different canonical authoring forms. If the whole list cannot be preserved exactly, narrow the migration instead of weakening the comparison.

### 5.3 W3 references and inference

First test the current authoring experience: valid autocomplete, wrong contract, missing port, extra port, wrong instance, and a renamed symbol. Existing typed string unions may already suffice.

A handle prototype, if justified, must derive from the actual declaration and preserve its exact serialized ID, direction, contract and purpose. It must not be `ref(anyString)` with a type cast, a second hand-maintained catalog, or a source of import cycles. Keep every graph edge explicit. Runtime validation remains necessary for `.mjs`, decoded data and widened values.

Do not add `table.decide`, `.coverage`, `.explain` and `.declaration` merely to decorate the same IR. Existing `decide` returns `at`, `cell` and `values`; a formatting function can use those without modifying serialized data.

### 5.4 W4 AMUX terminology

Keep core DSL keywords unchanged. Prefer these product-axis names over both the original vague names and this handoff's earlier `context` proposal:

| Original axis | Selected target name | Meaning |
| --- | --- | --- |
| `need` | `compactionNeed` | Result of token/idle policy assessment, not raw context size |
| `readiness` | `compactionSafety` | Whether the observer proved compact is currently safe |
| `attempt` | `compactAttempt` | Existing compact-attempt classification for this context generation |
| `identity` | `sessionKnowledge` | Fresh session, existing session with known prior model, or insufficient prior-model evidence |
| `selection` | `modelChange` | Whether the requested model differs from the prior model |
| `receipt` | `compactReceipt` | Receipt classification supplied to launch policy |
| `blocked` | `transitionBlocked` | Whether the model transition is blocked |

For the first naming migration, **keep value strings, cell IDs and output strings unchanged**. `NEW` can be explained as no recorded prior attempt without simultaneously renaming persistent or diagnostic vocabulary. Further value renaming is a separate measured migration, not an incidental cleanup.

A representative renamed cell is:

```ts
on("compact-once",
  { compactionNeed: "COMPACT", compactAttempt: "NEW", compactionSafety: "SAFE" },
  { action: "COMPACT" })
```

The adapter still owns the meaning of these inputs. Recent activity currently yields `need=NONE` even for a large context; naming it `SMALL_CONTEXT` would be false. `receipt=VERIFIED` is not evidence by itself: test the upstream receipt classification, exact session and freshness independently. If a bucket currently combines failure and ambiguity, splitting it changes semantics and is outside this rename.

Compare all 18 and 24 points under an explicit one-to-one axis mapping. Keep output and cell identity equal. Renamed axis keys legitimately change trace/IR metadata; document that versioned mapping instead of claiming literal byte equality for a renaming change. Test old saved evidence at its compatibility boundary; do not keep two source spellings indefinitely.

## 6. Mandatory enforcement without false rules

Canonical authoring becomes required for each accepted, proven-equivalent pattern. Do not wait until every legacy occurrence is gone before refusing new legacy occurrences.

**Migration order:** implement and prove the form; enumerate the existing legacy occurrences; turn on error-level checks for new or changed occurrences immediately; migrate the listed occurrences; retire compatibility when supported consumers no longer need it.

| Rule class | Strongest truthful enforcement |
| --- | --- |
| Invalid values, missing coverage, incompatible edges | Shared compiler/normalizer, plus types where practical |
| Structurally derived fields | Omit from canonical input type and reject unexpected fields at its authoring boundary |
| A legacy source spelling in a proved scope | Symbol-aware source check producing an error and canonical replacement |
| Temporary known legacy source | Occurrence-level shrink-only baseline, not a whole-file exemption |
| Cosmetic layout | Existing formatter, not semantic lint |
| Concurrent runtime behavior | Independent controller/conformance tests, not source lint |

Use one checker implementation through existing tooling. An ESLint-style adapter is an integration choice, not another semantic authority. Do not add a new mandatory linter dependency unless the existing runner cannot express the needed symbol-aware check. Source checks must not execute arbitrary product modules just to identify syntax.

Each rule ships with valid, invalid, aliased-import, unrelated-same-name, spread/indirection, test-fixture and generated-file cases. Unsupported analysis must be reported, not called clean. Do not ban every `order`, every string ref or every repeated subtree by regex.

Autofix only a deterministic transformation proven to preserve IDs, values, comments, ordering and compiled output. It must be idempotent: a second run changes nothing. If intent, effects or external identity cannot be determined, emit an actionable error without guessing a fix. Test fixtures intentionally constructing invalid raw data are not production authoring.

A baseline entry identifies an occurrence, rule, source fingerprint, responsible migration and deletion condition. New occurrences cannot be added just to get green; changed legacy code cannot inherit a file-wide exemption. Remove baseline machinery when empty. Published older IR remains readable where promised; removing an authoring overload is a versioned API change, not permission to delete saved data.

Explicit low-level representations remain available to compiler internals, decoders and negative tests. That does not make them a competing recommended product-authoring style. An external reference boundary must still validate identity and compatibility; an escape hatch is not a way around graph laws.

## 7. Diagnostics, explainability and efficient work

### One useful error, not another debugging project

Reuse existing diagnostic fields such as `rule`, `declarationId`, `sourceFile`, `target` and `message`; extend only where needed. Do not rename all diagnostics to match an example in this document.

Errors should identify the source declaration, violated rule, expected/observed values, smallest useful witness and canonical correction. Missing host coverage should name both the required host scope and supplied mounts. A wrong edge should name both endpoints and contracts. A table hole should name a concrete uncovered point; overlap should name the conflicting cell IDs. Preserve a real source span when available; never fabricate a line number.

Format existing decision provenance as table ID, source, input facts, chosen cell and outputs. For runtime decisions, distinguish the declaration version from the observation timestamp/session that supplied the facts. Do not create an inspector-only state registry or logging loop merely for an explain view.

### Feedback loop and scale

Keep the short loop: change a declaration, regenerate as needed, run the affected proof. The wide local verification command should reuse one build for type checks, declaration compilation, canonical-source checks, output comparison and relevant tests. Verify stale output before overwriting the comparison target; do not make generation hide drift.

Measure the existing loop first on the same machine. Record cold and warm runs, package pins, table cardinality and peak memory. Use three repeat runs for a small before/after median; do not create a benchmarking platform.

The current `decisionPoints` materializes a Cartesian product. Cardinality is the product of axis sizes, not their sum. Before large expansion, report cardinality and enforce a documented compiler-owned resource budget; choose its actual threshold from representative consumers. Prefer factoring genuinely independent decisions over inventing a solver or silently dropping combinations. Do not arbitrarily split outputs that must be decided together.

Keep recursive type machinery bounded. Preserve inference at a useful local boundary rather than accumulating a whole application in one generic builder. `.mjs` consumers must remain runnable as installed; add useful JSDoc/checkJs examples rather than requiring AMUX to execute TypeScript sources. No new watch daemon, CI workflow or release-path gate is part of this work.

## 8. Worker execution cards

### W0: establish the small oracle, not a repository census

Read the snapshot paths above and the actual installed pins. Record the current interaction family, contiguous UNITS rows, one component reference fixture and the two AMUX tables. Count authored repeated facts, not just lines. Record files touched for adding one ordinary action/setting and diagnosing one invalid binding.

Keep independent fixtures for missing required host, irregular stable ID, sparse/non-source order, table hole/overlap and failed-compact predicate scope. Existing baseline output is an oracle for equivalence, not proof that its product behavior is ideal.

**Done when:** the chosen small corpus, source identities, expected output and negative examples are reproducible. Do not expand W0 into a full product rewrite or audit.

### W1: one interaction helper and a completed adoption slice

Work in the existing interaction-authoring package, currently `product-emit/skydiving`. Reuse `family` where it already works. Add only the nested normalization/validation that the fixture requires; do not reorganize packages as a prerequisite.

Migrate a matching SKYVW family, keeping timing, IDs, source paths, host obligations and normalized output unchanged. Ship canonical-source enforcement with the adoption. Retain compatibility only for its named supported scope and version window.

**Must catch:** removed wear placement, duplicate mount ID, wrong host, wrong mount kind, changed timing, irregular-ID rewrite, and redundant canonical input fields. Test both type errors and runtime authoring validation where the type system can be bypassed.

**Done when:** normalized interaction IR and affected emitted files match exactly, the invalid mutations are rejected, and a new legacy occurrence fails the source check. Do not call a deleted redundant field a missing-field regression: it is rejected at the new authoring boundary instead.

### W2: sequence helper without changing seat semantics

Start with UNITS, not all settings. Preserve tuple inference and full catalog order. Demonstrate that `order=0,1,2` is actually sequence metadata at this boundary. Include sparse SYSTEM and interleaved FLIGHT as negative migration examples, not fields to renumber.

**Done when:** the selected migration is byte-identical, invalid/unmounted setting references still fail, and only the proven sequential shape is enforced. Shared-tree extraction is deferred until an actual common semantic owner is identified; equal serialized trees alone do not trigger a lint error.

### W3: strengthen the existing type experience

Test before adding API. Prefer improving generic inference and error locality in the current signatures. If typed handles win on a real reference fixture, use one derived handle representation and keep the existing graph validator. Prove normal `.ts` and `.mjs` authoring use without unsafe casts.

**Done when:** the demonstrated gap is closed, wrong edge direction/contract/instance remains invalid, IDs remain stable, and imports/check times do not regress materially. If the existing typed strings already meet the task, record that result and do not introduce handles.

### W4: AMUX names, not new policy

Apply the mapping in section 5.4 to declarations, fact construction, invariants, diagnostics and consumers of the affected keys. Keep cell/value/output strings, thresholds, controller order and retry behavior unchanged. Do not combine with incident repair, model migration or provider checks.

**Done when:** all 42 table points retain outputs and cell identity under the mapping, boundary/unknown-input cases pass, old trace handling is explicit, and no new legacy source keys are accepted in these particular declarations. This is not a global ban on the word `need` in other domains.

### W5: enforcement and actionable evidence

Each adopted helper includes its source check, error explanation, safe migration path and positive/negative fixtures. Reuse the installed source-analysis runner and shared diagnostics; do not build a second validator for ProductSpec semantics.

**Done when:** the old redundant source is detected, the canonical source and legitimate different semantics pass, and applying the mechanical fix twice is a no-op the second time. Failed checks exit nonzero through the owner's local verification command. Documentation-only warnings are insufficient for adopted rules.

### W6: finish one versioned slice

Publish through existing package-owner workflows when separately authorized; adopt immutable package pins and matching locks in consumers. Test consumers against the published artifact, not a workspace link masking missing exports. Refresh the current guide with executable examples only after the API exists; keep this plan marked as a plan until then.

Retire compatibility using the supported-version policy, without silently breaking unrelated consumers. Do not bulk-migrate both products because one example looked shorter. Independent W2/W4 preparation can run in parallel after W0; coordinate edits to common exports, diagnostics and guide files. Each worker owns one slice, not the same shared API file simultaneously.

**Done when:** the consumer path uses the released canonical form, verification reaches the relevant output, remaining compatibility is named, and the completion note says what is implemented versus merely designed. No live model calls are necessary for an authoring-only migration.

## 9. Proof obligations and quality target

Use three separate kinds of evidence:

1. **Equivalence:** old declaration versus new authoring produces the same normalized data and emitted bytes for structural changes. Naming changes use an explicit metadata mapping instead.
2. **Refusal:** a deliberately wrong case is rejected by the applicable layer. Restore an old redundant source spelling to prove the lint rule detects it. Remove a mount or coverage cell to prove semantic validation remains effective.
3. **Independent behavior:** existing runtime/conformance tests check actual bindings and effects. A generator comparing two outputs derived from the same wrong input is not an independent oracle.

Do not remove product invariants because the current cells happen to imply them. The redundancy can be intentional protection against a later policy edit. Generated tests establish coverage of declared cases, not that the declarations describe the desired product. For a claimed bug fix, run the symptom test on the old implementation first; for a new authoring feature, clearly name the new invalid-input contract rather than inventing a historical runtime bug.

Do not claim this DSL is 9/10 from code reading. Use the following project-local acceptance scorecard after implementation: 0 = missing/unmeasured, 1 = partial, 2 = demonstrated. A target of at least 18/20 is a review convention, not a scientific benchmark; safety items 1-4 must each score 2.

| Item | Evidence for 2 |
| --- | --- |
| 1. Semantic preservation | Exact structural-output equality or explicit naming map, no hidden timing/ID/order changes |
| 2. Independent requirements | Missing required placement still fails; requirements not inferred solely from supplied implementations |
| 3. Law preservation | Holes, overlaps, bad references, invalid values and protected invariants have effective negative cases |
| 4. Runtime boundary honesty | Pure IR, independent receipt/binding evidence, no claim that syntax fixes races |
| 5. Less repeated authorship | Measured reduction of duplicated fields in accepted real fixtures, without a larger decision surface |
| 6. Type/editor experience | Normal task needs no unsafe cast; errors point to the offending declaration in TS and checked JS examples |
| 7. Enforced canonical form | New/changed legacy occurrences fail; compatibility baseline only shrinks |
| 8. Useful diagnostics | Each representative error names rule, source, cause and safe next action |
| 9. Efficient verification | Before/after local timings and memory recorded; added latency is understood rather than hidden by fewer tests |
| 10. Discoverability and migration | One guide entrypoint, runnable examples, immutable pin adoption and explicit compatibility retirement |

Release-independent stop rule: if a helper hides a real product choice, changes observable output without declaring it, or adds more concepts than the duplicated facts it removes, stop that slice and retain the existing form. This is a design rejection, not a permanent optional style exception.

## 10. External references and why they matter

These are primary technical references consulted for alternatives, not evidence about our deployment. The decisions above are this reviewer's application of them.

- [TypeScript satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html): validates compatibility without replacing the expression's inferred type. Prefer that capability over casts where appropriate.
- [TypeScript const type parameters](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#const-type-parameters): helps literal inference for inline inputs, but does not recover specificity already lost in a widened variable. Test actual call sites.
- [TypeScript JSDoc](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html): supports checked JavaScript including `@satisfies`; an AMUX `.mjs` consumer need not become a separate DSL dialect.
- [TypeScript exhaustive narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking): ordinary typed code also supports exhaustive cases; use ProductSpec for the additional shared guarantees we need.
- [ESLint custom rules](https://eslint.org/docs/latest/extend/custom-rules) and [typescript-eslint rule development](https://typescript-eslint.io/developers/custom-rules/): distinguish automatic fixes from suggestions and provide source/type-aware rule tooling. Error severity and whether an edit is safe to apply automatically are separate decisions.
- [Langium grammar reference](https://langium.org/docs/reference/grammar-language/): a separate grammar produces a typed AST and entails a language-definition surface. That alternative is real, but is not selected for this scope.

## Completion state of this PR

Documentation reviewed and revised; no new helper, compiler rule, migration, lint rule or runtime behavior is delivered here. Start implementation at W0/W1, with the strongest existing mechanism that satisfies the contract. The end goal is fewer facts to keep synchronized, not the fewest characters and not the most DSL features.
