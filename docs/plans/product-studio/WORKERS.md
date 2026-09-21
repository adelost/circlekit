# Worker plan and acceptance tests

Start with [README](README.md), [ARCHITECTURE](ARCHITECTURE.md) and [UX](UX.md). All implementation cards below are **OPEN**. The HTML storyboard and this handoff do not complete an editor/runtime card.

## Working agreement

One vertical slice at a time. Each worker reads the actual source and installed pins before changing it. Record `Found`, `Change`, `Reason`, `Proof`, `Open` in English in the existing task/PR, not a new task database. Preserve product ownership, stable IDs, unresolved receipts and generated-file rules.

Reuse the existing ProductSpec language and compiler. No local copies of `decide`, `step`, graph validation or invariant semantics. Do not wait for every authoring-DX idea in PR #263: use current canonical source and extend known edit lenses when that API changes.

All new GUI text and examples are English. Code identifiers and raw imported evidence stay exact. No production mutation, provider calls, agent restart, account change, paid execution or automatic deploy for a Studio test.

## Dependency order

```text
D0 source/package baseline
  -> D1 read-only model viewer
       -> D2 pure logic simulation
       -> D3 provenance and read-only source inspection
            -> D4 draft visual editing and validated source diff
                 -> D5 guarded draft saving / conflict recovery
       -> D6 typed scenario and fake-service adapters
       -> D7 recorded diagnostics, then optional live observation
       -> D8 supported interface previews and catalog composition
```

D2 and D3 can proceed in parallel after D1. D6's first fake boundary follows a working D2 runner. D7 initially needs only D1 plus the existing dump verifier. D8 composition changes depend on D4/D5; read-only mount inspection can ship earlier. Do not have multiple workers changing the same adapter schema/export file simultaneously.

## D0. Freeze a reproducible small baseline

**Owner:** Studio integration worker with package/product owners.

**Read:** exact source paths and revisions in README; actual product package manifest/lock; ProductSpec public exports; SKYVW compile entrypoint, recording-machine export and diagnostic CLI.

**Deliver:**

- A fixture manifest identifying compiler version, pinned dependencies, source revision, dirty-content/config digests and artifact hashes.
- The real `recording.session`, AMUX's two policy tables and one bounded SKYVW graph slice.
- A minimal import/build probe for the public package in the chosen local service. Probe browser bundling separately before selecting a browser execution path.
- A confirmed existing/new app shell location. Suggested stack is React Flow + Monaco + local Node service; adapt to a suitable existing shell instead of migrating frameworks.

**Must prove:** no hidden deep imports, moving worktree dependency or copied kernel. Capture baseline output before generating over it. The current AMUX numeric defaults are 100,000 tokens, 60-minute warm idle and 24-hour cold idle; a fixture must name its own policy snapshot.

**Exit:** one reproducible offline fixture load and one actual package import. No full-repository census or unrelated dependency upgrade.

## D1. Read-only System and Logic views

**Owner:** model-adapter and GUI workers, separate files.

**Deliver:** product-owned inspection adapter, bounded bundle decoder, domain/node/port viewer, standalone table/machine index, stable selection, search and English capability messages.

**Pseudocode:** ARCHITECTURE sections 1-2 and 4.

**Acceptance:**

| ID | Case | Expected |
| --- | --- | --- |
| LOAD-01 | Valid schema-9 SKYVW bundle | Nodes/ports/mounts match compiler output, not a manually redrawn topology |
| LOAD-02 | Standalone AMUX tables | Tables visible; no invented AMUX application graph |
| LOAD-03 | Machine not embedded in ProductIr | Loaded from the actual exported facet, no fake product field |
| LOAD-04 | Invalid/unknown schema, oversized input | Bounded failure, English diagnostic, no partial green status |
| LOAD-05 | Alias/shadowed DSL function | Symbol resolution identifies the imported DSL function, not a same-named local function |
| LOAD-06 | Stale generated artifact | Marked out of date or refused; not presented as current source |
| UI-01 | Filter/zoom/collapse | Program meaning unchanged; focus scope visible |

**Exit:** a real artifact can be explored without source execution or writes. Existing code leaves are visible as such, not debt or imaginary expanded logic.

## D2. Real pure table and machine simulation

**Owner:** simulator worker.

**Deliver:** pure-kernel runner, synthetic guard inputs, step/reset, run history, why/why-not view and exact cell identities. No effects or clocks implicit in the DSL.

**Pseudocode:** ARCHITECTURE section 5.

**Acceptance:**

| ID | Case | Expected |
| --- | --- | --- |
| SIM-01 | STOPPED + Start, START_NOW false | ARMED, `start-armed` |
| SIM-02 | ARMED + AltitudeObserved; AUTOMATIC and ABOVE_GPS_HEIGHT true; LEASE_EXPIRED and ABOVE_RECORDING_HEIGHT false | BUFFERING, `gps-height` |
| SIM-03 | BUFFERING + ExitPromotes | RECORDING, `exit-promotes-buffering` |
| SIM-04 | Relevant guard unknown | `Supply the missing guard facts before stepping.` No guessed transition |
| SIM-05 | BufferingDeadline without required guard facts | No invented timeout duration or automatic predicate |
| SIM-06 | Input covered only by machine `updates` | Stage result as `step` specifies; native field arithmetic not falsely simulated |
| SIM-07 | Same bundle/seed/events | Same ordered results and cell IDs |
| SIM-08 | Source changes mid-run | New candidate run; old timeline retains original identity |
| TABLE-01 | Enumerate all 18 and 24 current AMUX points | Same result/cell as the installed shared kernel |
| TABLE-02 | `need=NONE`, `attempt=FAILED` | Preserve current CONTINUE outcome; no strengthened policy inside GUI |
| TABLE-03 | Missing, foreign or undeclared axis value | Shared decoder/kernel refusal, no default |
| TABLE-04 | Deleted cell or overlapping region | Named hole/overlap witness from compiler |

For all machine paths, compare to the actual package's `step`; do not use the HTML storyboard as a behavior oracle. Keep independent expected product cases such as SIM-01/02/03 to avoid comparing a function only with itself.

**Exit:** reproducible simulation of declared transitions/decisions with explicit limits. No claim that sensors, controllers or all algorithms run in-browser.

## D3. Source provenance and edit capability

**Owner:** source-analysis worker.

**Deliver:** source index keyed by stable declaration/field, original spans/digests, imported-symbol handling and `editable/shared/derived/external/unsupported` classification.

**Acceptance:** literal fields resolve to the actual source; aliased imports work; conflicting IDs are refused; shared-family edits name the owner and affected members; derived values open their inputs; external library definitions remain read-only; arbitrary function/spread expressions never flatten silently.

**Required fixtures:** inline object, `as const`, `satisfies`, imported constant, `family(...)`, computed map, shadowed symbol, duplicate ID, comments and two independently edited files. An unsupported pattern is a visible outcome, not an empty success result.

**Exit:** selecting the `gps-height` cell opens the correct source and identifies which supported fields can be edited without reverse-engineering arbitrary JavaScript.

## D4. Visual draft editing and semantic diff

**Owner:** source-edit worker with compiler owner.

**Deliver:** one transition-field lens, inspector draft controls, source editor synchronization, immutable draft snapshot, real recompile, diagnostics and source/semantic diff. Add binding and ordered-mount lenses only after the first round trip is proved.

**Pseudocode:** ARCHITECTURE section 3.

**Acceptance:**

| ID | Case | Expected |
| --- | --- | --- |
| EDIT-01 | Open and save without edits | Byte-identical source; no generated changes |
| EDIT-02 | Edit one literal property | Only intended source change plus explained compiled consequences |
| EDIT-03 | Changed field violates a product invariant | Real source recompilation refuses it, even if JSON remains well-formed |
| EDIT-04 | Edit shared helper property | Owning definition changed once; impact explicit; no copied literals |
| EDIT-05 | Unsupported computed source | Actionable read-only state; no forced reprint |
| EDIT-06 | Temporary incomplete graph | Draft retained; last good graph marked outdated; validated save disabled |
| EDIT-07 | Apply same source transform twice | Second transform is a no-op |
| EDIT-08 | Move a canvas node | Layout metadata only; no transition-order/source semantic change |
| EDIT-09 | Comments, full IDs and sparse mount seats | Preserved unless the intended edit explicitly targets them |

**Exit:** GUI and code are two views of the same draft, not an editable JSON fork. A valid syntax tree alone does not authorize saving a changed product.

## D5. Save, conflicts and recovery

**Owner:** workspace transaction worker.

**Deliver:** isolated Studio draft branch, versioned proposals, branch-head compare-and-swap, operation identity, recovered save receipt and explicit conflict UI.

**Pseudocode:** ARCHITECTURE section 3, Save boundary.

**Acceptance:** source changes after preview, changed lock/config, same operation twice, same operation ID with different payload, interrupted save after commit, changed branch head, undo after an external edit, symlink/path escape and multi-file proposal. Each preserves unrelated work and produces either an exact save receipt or a conflict. No force-update, live directory replacement or automatic push/merge/deploy.

Publish into a user's shared worktree only through a separately proved existing transactional edit or explicit patch workflow. Test this as an independent capability; a Studio mutex is not cross-editor exclusion.

**Exit:** a validated draft commit is reachable and read back with the expected content. A finished filesystem command alone is not proof.

## D6. Mock requests and reproducible scenarios

**Owner:** product test-adapter worker plus Studio scenario worker.

**Deliver:** one existing real service/test boundary, fixture codec, explicit adapter manifest, virtual scheduler, scenario save/load and independent assertions. Start with one offline fixture rather than a generic network proxy.

**Pseudocode:** ARCHITECTURE section 6.

**Acceptance:**

- Missing fixture makes zero external calls and fails visibly.
- Wrong contract/payload or unresolved opaque field is rejected before injection.
- Delay, out-of-order result, duplicate receipt, cancellation and timeout are delivered through the actual selected test seam.
- Request/operation identities remain separate from display row indices.
- A port fixture explicitly excludes upstream behavior.
- The same fixture/seed/bundle reproduces results; edits create a new run identity.
- Existing QA scenes using live traffic cannot enter a fixture-only run accidentally.
- No provider credential, real model call, shared journal mutation or ADB write is reachable from a default scenario.

**Exit:** at least one product boundary is genuinely exercised with controlled collaborators. A scripted visual demo is not completion.

## D7. Recorded diagnostics, then live observation

**Owner:** existing diagnostic/runtime owner plus GUI worker.

**Deliver first:** import existing SKYVW diagnostic bundle and ledger snapshot; reuse hash/schema validation and owner classification; show capture time, quality and recency distinctly.

**Acceptance:** wrong product, graph hash, product hash, artifact, schema and timestamp handling; old snapshot reopened later has the same relative reading; recent delivery with stale quality retains both; aggregate statistics do not generate an event history; active-but-silent owner does not automatically become a source error.

**Later ordered trace:** add bounded, versioned instrumentation at an owned seam with run/sequence/cell/port identities and explicit dropped-event count. Prove monotonic ordering within its clock domain and visible cross-domain uncertainty. Redact payloads by policy. Playback requires codecs and sufficient captured payloads, not just summaries.

**Later live observation:** authorized, read-only debug connector with identity verification and clear disconnect state. Debug injection or process breakpoints are separate capabilities, never side effects of inspection.

**Exit:** evidence says exactly what was observed and what is missing. No runtime snapshot is authenticated merely because its hash matches a model.

## D8. Interface previews and visual creation

**Owner:** component/rendering owners plus Studio GUI worker.

**Deliver first:** artifact/surface/mount explorer, supported component-body schema view, real catalog entries and implementation-required status.

**Preview:** one actual web/native preview adapter. A schematic has a permanent label. Native fidelity is verified with the real renderer and existing scene mechanism. Do not claim pixel parity from component metadata.

**Creation:** place an existing type, configure its real fields, connect ports through graph validation, author supported table/machine/mount data, review and save canonical DSL. Keep independent host requirements and stable IDs. The GUI cannot invent a driver, renderer, persistent store or arbitrary algorithm from a graph box.

**Acceptance:** missing required input/host, duplicate identity, incompatible direction/contract, unsupported platform, changed state authority, persistence wire-name change and missing implementation all surface clearly. Valid wiring reaches the real registered consumer, not only a matching inspector graph.

**Exit:** one small assembled program slice works through its actual product runtime/preview adapter with no second state owner. This is the completion criterion for visual creation, not the number of draggable shapes.

## Cross-cutting release gates

These are owner-run local acceptance criteria, not a request for new CI or release-path gates.

- English GUI copy, tooltips, errors, aria labels and documentation; source IDs/evidence unchanged.
- Keyboard selection and connection alternative, focus restoration, reduced motion, measured contrast and readable narrow layout.
- Bundle and source operations have documented size/time budgets; cardinality explosion is detected before unbounded enumeration.
- Loading an untrusted workspace does not execute imports. Build trust is explicit, sandboxed and bounded.
- Changes remain tied to pinned compiler/adapter versions. Generated IR is not hand-edited.
- No missing mock falls through to live services. No screenshot is reported as runtime proof.
- Re-run the old symptom first for a claimed fix; new-feature cases must be identified as new contracts, not invented historical bugs.

## Completion record

Each implementation PR reports:

```text
Done: <implemented slice and reachable branch/path>
Verified: <tests, source identities, actual adapter path and evidence>
Open: <unsupported features, remaining conflicts and deployment boundary>
```

Do not report "Studio complete" while only the storyboard/viewer works. Conversely, do not withhold a useful read-only viewer until every future runtime adapter exists. Each released capability is explicit and independently verifiable.
