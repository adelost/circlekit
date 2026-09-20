# Migration and worker contracts

Status: proposed execution plan. Start at [README](README.md). No row below is complete merely because this handoff or example code exists.

## 1. Keep the work streams distinct

| Work stream | Existing owner/work | Result | Not a dependency |
|---|---|---|---|
| Shared authoring DX | CircleKit W0/W1/W2/W3/W5/W6 | Less repeated authorship, unchanged declared behavior, mandatory canonical form | ai-dsl 360 implementation |
| SKYVW native adoption | Native product owner | One equivalent interaction family, then justified settings slice | All web or AMUX upgrades |
| AMUX policy naming | W4, AMUX policy owner | Same 42 decisions and predicates, clearer trace vocabulary | New SKYVW interaction helper |
| AMUX Link / SKYVW web | Their existing graph/runtime owners | Narrow shared primitives and actual binding conformity | App-wide native UI replacement |
| ai-dsl migration | Existing P0-P5 | One status boundary first, then state publication and Apply | W1/W4 finishing in other repositories |

Do not block ai-dsl's published-package pilot on authoring helpers it will not use. Conversely, do not make CircleKit's shared release depend on ai-dsl's camera renderer. This corrects the previous overly serial “SKYVW, then AMUX, then ai-dsl” order.

## 2. The migration record is a review artifact, not another platform

For every slice, put a small record in its implementation PR or existing task row:

```yaml
slice: aidsl.studio-activity
source_revision: <actual checked-out SHA>
installed_pins: { product_spec: <version and integrity>, emitter: <when applicable> }
state_authority: <existing owner and scope>
replaced_authorship: [<specific functions/declarations>]
retained_code_leaves: [<actual adapters/algorithms>]
new_guarantee: <one mechanically checked invariant>
compatibility: <what stays equal; what intentionally changes>
real_consumer: <registered entrypoint and component>
proof: { old_symptom: <when fixing>, negative: <test>, runtime: <test> }
rollback: <known data-compatible state and restore procedure>
remaining: [<explicit unverified pieces>]
```

This is documentation for review, not a schema to implement, a new mandatory daemon or a cross-repository task database. Preserve each repo's owner/run/release rules. A cross-repo reference should point here instead of copying the whole plan into four drifting files.

## 3. S0: bounded baseline and package feasibility

**Read:** affected source, actual manifest+lock, current runtime consumer, previous W/P card.

**Capture:** expected behavior/output BEFORE running a generator that would overwrite it. Separate the last accepted output from newly generated output. `generate && check-generated` alone can hide that the checked-in output was stale before the run.

**Check package:** install from the normal immutable release pin in an isolated workspace; compare locked version/integrity; execute a minimal declaration and the real consumer build/import path. Local source tests do not prove a published package contains that code.

Node/browser/native are separate targets. Existing `@v1d/product-spec/foundation` is for foundation adapter inspection, not arbitrary product authoring. Never “solve” an exports error with `dist/src/...` deep imports, path aliases to a sibling checkout, `as any` or a second local compiler. Request the smallest useful public export in CircleKit when the actual probe establishes the need.

The handoff's DNS failure is an environment limit, not evidence the release is unavailable. A worker with working normal package access should test, not redesign around it.

**DoD:** locked dependency+environment manifest, real import/build proof, small golden corpus and negative tests. If a package fix is needed, isolate it. Do not couple product behavior changes to a broad dependency update.

## 4. CK-DX / SKYVW native: one normalizer, one completed adoption

Use W0/W1 as written. Keep the actual irregular stable IDs and `deliberate` timing. Reduce one family’s repeated source metadata/mount category only where the relationship is true. Required host coverage stays independent from placements.

A valid implementation test starts with the current explicit declaration, applies the new normalizer, and compares full normalized interaction IR and affected emitted files. Removing wear, duplicating a mount, changing a host, changing timing and changing an external ID must all be caught by the right proof. An expected-output comparison alone is not the native behavior test; run the affected registered action path as well.

W2 is separate: migrate contiguous UNITS rows only when their sequence equals semantic order and full catalog ordering is unchanged. Keep sparse SYSTEM seats and interleaved FLIGHT as negative migration fixtures. Preserve mapped tuples/literal setting IDs so an unmounted menu target still fails. Do not broaden a helper's return type to make TypeScript happy.

W3: test the existing typed-string references before adding handles. Reject wrong contract/direction/instance, preserve serialized identity, and demonstrate an actual navigation/refactoring improvement before publishing a new reference wrapper.

**Exit:** adopted source is canonical, actual native connection is verified, changed low-level legacy forms fail locally, and there is one writer for each changed fact. Preserve timing, sensor thresholds, recording and alarm semantics. A DX change must not be used to adjust flight behavior.

## 5. AMUX root: rename policy axes without changing policy

Use W4's mapping:

```text
need       -> compactionNeed
readiness  -> compactionSafety
attempt    -> compactAttempt
identity   -> sessionKnowledge
selection  -> modelChange
receipt    -> compactReceipt
blocked    -> transitionBlocked
```

Keep cell IDs, value strings, output values, thresholds and invariant predicates. Preserve current `maxTokens=100000` unless the operator separately changes it. `NONE` also results from sufficiently recent activity; it does not mean SMALL_CONTEXT. `need=NONE, attempt=FAILED` currently permits CONTINUE. Do not strengthen that invariant accidentally during renaming.

For every old point p, compare both output and cell identity with the new decision under the explicit key mapping. Renamed axes change trace keys, so do not demand byte-identical trace objects. Instead version/map historical traces at their read boundary. Persistent receipts and context journals remain intact.

Then run the existing policy/controller tests with fake compact/launch collaborators. Test missing, foreign, stale and ambiguous receipts at the actual `launchCodexWithPolicy` boundary. The table classifier gets a checked fact, not an arbitrary truthy receipt object.

**Exit:** all 42 points and the real adapter boundary cases match; no live agent was woken merely for testing; no new model selection, quota rule, lock or retry mechanism was introduced. Duplicate analysis of a receipt or repeated wake is not a syntax improvement.

## 6. AMUX Link and SKYVW web: convergence, not forced rewrites

Link already has repeated state authorities and `mapFiniteCases` for finite phase projections. Keep independent capture, delivery, reply, playback, connection and recovery responsibilities independent. Combining them into one Cartesian mega-state merely increases complexity.

A helper to shorten repeated authority construction is worthwhile only if one real fixture proves no changed source port, state field, output identity, scope or topology. Try `family` or a narrow existing constructor first. Do not auto-register all authority adapters via global mutable side effects.

For SKYVW web, preserve its actual `bindLogbook`/generated-connection path. A generated connection literal is useful because the runtime reads it. Do not replace it with a parallel inspector graph. Bounded `compileProductGraph` use is a legitimate migration phase; record its validation limits. If adopting a full state-authority layer, make the corresponding real consumers stop deriving competing states. Do not put an opaque `valueRef` around disputed state solely to make a validator stop seeing it.

**Mobile/desktop:** same intents and domain owner, different mounting/layout. “Phone”, “wear”, “round”, “compact” and “wide” are not interchangeable concepts. Preserve platform obligations and exact supported scopes. Do not claim the same graph proves every layout is legible or that every touch action is reachable.

**Exit:** one chosen input/action traverses a real registered callback through the existing owner and back to presentation, on each required platform/surface. Rendering the expected graph alone does not satisfy this.

## 7. ai-dsl: migrate status before side effects

### AI-P0/P1: read-only status pilot

Keep the `selectStudioActivity` interface. Preserve source/workspace filtering, canonical queue order, progress/timing data and terminal precedence. The current status list is not a backend lifecycle: aggregate `idle` means no scoped rows. Do not create fake idle jobs.

Extract only the finite classification into a real ProductSpec table. RECIPES gives a nine-cell/36-point override sketch that keeps current queued/running/terminal behavior. Retain existing normalization and projectors as explicit pure code leaves. In the full product scope, wire its eligible state discriminator through the appropriate authority rather than independently creating status labels in each panel.

No second watcher, store, timer or poller. During comparison, evaluate both pure versions on frozen fixtures. One existing runtime still owns effects. Keep existing Svelte APIs and theme; this is not a UI redesign.

**DoD:** equivalence on current valid cases, explicit unknown response handling, wrong-workspace/source refused or excluded, new authority consumed by the actual selected UI, negative missing-case/edge tests, and replaced duplicate logic removed.

### AI-P2: publish the right asynchronous result

Read the actual polling/source/session path and its guards before choosing fields. Do not prescribe a universal token that invalidates every cache on every edit.

Track two distinct kinds of freshness:

- view/request generation: may this result enter the currently selected view?
- domain/resource revision: is this evidence valid for the material, job attempt or edit being changed?

A result may remain valid in source A's cache while no longer belonging on the screen after a switch to B. A -> B -> A requires a fresh generation even when IDs match again. Do not discard useful durable results merely because the UI closed; do not publish them into the wrong session either.

Guard after awaits and at mutation. Recheck under the existing serialized owner/transaction when effects are involved. Abort signals save work but are not correctness proofs. Duplicate terminal receipts, out-of-order responses, hydration, retries with a new attempt ID and reconnect are separate test cases.

**DoD:** actual transport collaborators deliver the adversarial order and the real consumer behaves correctly. A pure `isFresh` test alone is not the proof. No new fake frontend job state overrides server job truth.

### AI-P3: admission and atomic Apply are distinct

Use CircleKit to express admissibility and feedback. Call existing `applyEditTurnAtomically`; do not implement a second draft/undo engine. That existing function already rejects stale timeline revision/digest, duplicate turns and invalid intent batches at its boundary.

Before claiming broader protection, map source/marker dependencies. `updateSource` and marker operations have intentionally different history semantics. A timeline-only digest is not a source hash, source binding revision or event-evidence revision. If a proposal needs those facts, make the dependency explicit at the owned boundary. Do not silently add fields to an exact-key wire schema during an ergonomic-only migration.

Test duplicate requests by stable command ID and payload identity. Same ID+different payload is a conflict, not a successful retry. A same-ID retry after an unknown network outcome should check the owner's receipt rather than blindly mutate again. UI button disablement is not idempotency.

**DoD:** preview leaves the document unchanged; valid batch has one undo step; stale/wrong-source/partial-invalid attempts have zero; save/reopen and undo/redo retain documented scope. Exactly-once over networks is not promised. Retain authoritative commit checks even when the UI already ran the table.

### AI-P4/P5: capability surfaces and reframing

Keep Python worker/model/operation registries authoritative. Use the existing generated scoped-operation contract and digest, not a new hand-authored copy in ProductSpec. If a finite shared policy must execute in another language, use the owned emitter/portable data plus independent parity tests, not two separately written tables.

Artifact availability depends on canonical read and requested coverage, not only a terminal job. Multiple controls may request the same analysis, but request deduplication and budget reservations belong to the existing backend/owner.

Reframe is a later consumer, not a prerequisite for status. Its source-time/orientation/roll/FOV/preview-export problems still need their own domain proofs. FocusTrack, event evidence and CameraRecipe remain media-domain artifacts. ProductSpec wires Generate/Refine/Apply; it does not infer camera geometry or force SAM/VLM on every clip.

## 8. Five independent layers of proof

| Layer | Proves | Does not prove |
|---|---|---|
| Types and authoring checker | Legal source/API use, literal/reference constraints, canonical form | JSON payload validity or runtime timing |
| Shared compiler | Declared graph/table laws, expected finite coverage | Correct sensors, inputs, receipts or actual mounts |
| Normalized-output parity | An ergonomic rewrite preserves the specified prior meaning | That the prior product behavior was ideal |
| Actual binding/conformance | Registered runtime endpoints match the expected contract | That every gesture/result sequence is correct |
| Behavioral scenario | The tested user/transport/timing sequence works | Exhaustive behavior of the whole product |

Keep expected requirements independent of observed implementation. Removing the wear mount must not also remove wear from the expectation. Generating a native manifest from the expected IR and then comparing it to that same IR is circular evidence.

A migrated slice's acceptance set includes: missing/duplicate edge, wrong scope, invalid raw payload, delayed response, A-B-A generation, duplicate action, interrupted outcome, restore, and required compact/wide/native delivery as appropriate. Do not pretend every slice needs every test: select named applicable cases and record exclusions.

## 9. Enforcement and removal of old forms

Once a form is proved and adopted in a scoped family:

1. Exclude redundant fields from canonical API/types and reject them at the authoring boundary.
2. Turn on symbol-aware errors for new/changed old-form occurrences immediately.
3. Migrate enumerated old occurrences with a shrink-only, occurrence-level baseline.
4. Remove compatibility overloads on the documented supported-version boundary and delete the empty migration machinery.

Generated code, low-level decoders and negative tests are not product authoring. No broad regex bans on `order`, strings, state switches in unrelated domains or equal-looking subtrees. Unsupported source analysis must say unsupported, not clean. Existing code leaves are not debt merely because they are not DSL.

Prove codemod idempotence and semantics. Run once to transform, twice to confirm no further change. Preserve IDs, independent host obligations, comments, ordering and timing. If meaning is uncertain, issue an actionable diagnostic, not an unsafe autofix.

Compiler laws are intrinsic checks. Owner-run local source/conformance checks remain in the existing workflow. Do not add a new CI/release gate, daemon or test framework as a side project.

## 10. Versioning, rollout and rollback

Treat four versions separately: authoring package, compiled IR/schema, platform emitter/bindings, and persisted product documents/traces. A helper-only rewrite may preserve IR bytes. Axis renaming may preserve decisions but change trace keys. A real runtime state change needs behavior proof and a compatibility story.

Release shared support first through the normal authorized package-owner process; consume an immutable published artifact and lock. Do not pin another repo's worktree or a moving branch. Preserve older saved data where promised even after old source authoring is retired.

Rollout: compare pure computations, switch one actual consumer exclusively, then remove the replaced path. No dual writers and no silent fallback when a new rule refuses. A controlled rollback is not the same as an always-on legacy escape hatch.

Define a quiescent change point or a verified compatible session snapshot for dirty/pending work. ui state can be memory-only; reload can lose work even when the disk schema is unchanged. Neither deploy nor revert may reset sessions, receipts, original footage or unresolved operations merely to obtain green status.

## 11. Twenty-hour budget and stop rules

Correction to the earlier estimate: there is no measured basis to guarantee all P0-P3 in 15-20 hours. A useful **20-hour timebox** can target package feasibility, one real status slice, its deletion/enforcement work and evidence. Async/Apply follows only if proven prerequisites fit.

An illustrative allocation, not a completion forecast: 3 h package/baseline, 7 h one consumed status slice, 6 h adversarial/integration proof, 4 h cleanup/rollback/review. If package integration blocks, stop that slice rather than spending the remaining time inventing a local DSL. Report the actual blocked boundary and hand off the package fix.

Do not lower identity, commit, budget, history or runtime evidence standards to close the timebox. A partial but exclusively migrated read-only slice is a valid delivery; marking asynchronous protection complete because declarations compile is not.

## 12. Worker completion receipt

```text
Done / Blocked: <one implemented, consumed slice, or exact blocking dependency>
Verified: <repo SHA, package pin, old-red where applicable, new tests, actual entrypoint>
Open: <unproved runtime/platform cases, retained compatibility and deletion condition>
```

Before closure another agent follows the actual path, not just the unit test names. Review source identity, generated-output provenance and the same URL/branch the operator will read. A successful tool command is not proof that the final artifact is reachable.
