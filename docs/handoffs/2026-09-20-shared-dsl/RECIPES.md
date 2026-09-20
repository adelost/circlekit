# Recipes, pseudocode and migration seams

Read [README](README.md) and [MIGRATION](MIGRATION.md) first. Examples in this file are **not deployed features**. Every block is labelled either current API shape, proposed shared helper, or application pseudocode. Private domain functions in pseudocode are responsibilities to bind to existing owners, not new exports to invent in ProductSpec.

## R1. Existing `family`: repeat meaning once

**Current API shape.** The real standalone family source was tested during this review. Consumer package compatibility still needs its own check.

```ts
import { family } from '@v1d/product-spec';

const conditions = family({
  category: 'CONDITIONS',
  shape: 'WHOLE_JUMP',
  edit: 'DERIVED',
});

const rows = [
  conditions({ id: 'night', label: 'NIGHT' }),
  conditions({ id: 'cloud', label: 'CLOUD' }),
];

// Must fail, even though the redundant value is equal:
// conditions({ id: 'night', category: 'CONDITIONS' });
```

Use for facts with one intended owner. Do not build inheritance/mixin precedence or auto-share independent decisions merely because their bytes happen to match. `family` is a record constructor, not a graph validator or immutable state store. The ordinary downstream validator still applies.

## R2. Interaction normalizer: fewer fields, same product

**Proposed shared helper, not a current export.** Implement under W1 in the existing interaction-authoring owner. Do not copy this helper into SKYVW, AMUX and ai-dsl independently.

```ts
// Application authoring target. Keep exact stable identities.
const action = defineActionFamily({
  sourceFile: 'appspec/products/skyvw/menus/interactions.ts',
  requiredHosts: ['phone', 'wear'],
});

const reset = action({
  id: 'action.live-iso-reset-view',
  timing: 'deliberate',
  mounts: [
    { id: 'mount.live-iso-reset.phone-menu-row', hosts: ['phone'] },
    { id: 'mount.live-iso-reset.wear-menu-row', hosts: ['wear'] },
  ],
});
```

Normalizer responsibility, in pseudocode:

```text
normalizeAction(family, member):
    reject unexpected/redundant canonical input fields
    preserve member.id, timing and full mount IDs exactly
    validate family.requiredHosts independently of member.mounts
    produce EXISTING InteractionDeclaration:
        kind = discrete-action
        controlId = existing interactionControlId(member.id)
        timing = member.timing
        requiredHosts = family.requiredHosts
        source.file = family.sourceFile
        source.declarationId = member.id
        mounts = for each supplied placement, in original order:
            id = existing interactionMountId(placement.id)
            kind = atom
            requiredHosts = placement.hosts
    run existing interaction validation at its owned boundary
    return ordinary normalized data, no registrations/effects
```

A missing wear placement must fail while the required set stays unchanged. Source metadata can be family-owned; desired host scope cannot be inferred from what happens to have been mounted. Do not shorten irregular IDs or change deliberate timing in an equivalence migration.

## R3. Sequential settings without losing tuple identity

**Proposed helper shape.** Start only with UNITS. This sketch does not claim an existing `settingsSection` export.

```ts
const units = settingsSection('UNITS', [
  altitudeUnitSetting,
  distanceUnitSetting,
  dateFormatSetting,
] as const);
```

Type/normalization responsibilities:

```ts
// Pseudocode types: bind Setting and Section to the existing product types.
type SectionRows<S extends readonly Setting[], Section extends string> = {
  readonly [I in keyof S]: {
    readonly setting: S[I];
    readonly mount: {
      readonly kind: 'settings-section';
      readonly section: Section;
      readonly order: number;
    };
  };
};

// Construction maps index -> order ONLY for this proven sequence shape.
// It must not return Setting[] and lose each element's actual ID.
```

Preserve the full surrounding catalog and its existing order. Keep explicit seats for sparse SYSTEM and existing interleaving for FLIGHT. Negative type fixture: a menu referencing a setting not actually mounted still fails. The helper’s internal proven implementation cast is not permission for product authors to use `as any`/`as never`.

## R4. AMUX axis renaming: keep decision semantics and traces honest

**Current table API; proposed consumer names.** Do not rename core keywords `axes/columns/cells/invariants/on`.

```ts
on('compact-once',
  {
    compactionNeed: 'COMPACT',
    compactAttempt: 'NEW',
    compactionSafety: 'SAFE',
  },
  { action: 'COMPACT' });

// Same invariant scope, only its axis name changes:
{
  refuse: 'a failed compact cannot automatically spend another attempt',
  when: d => d.at.compactionNeed === 'COMPACT'
         && d.at.compactAttempt === 'FAILED'
         && d.values.action !== 'HOLD',
}
```

Independent migration comparison, not another runtime decision engine:

```text
for each point in OLD explicit axes:
    old = decide(oldInstalledTable, point)
    renamedPoint = oneToOneAxisRename(point)
    new = decide(newInstalledTable, renamedPoint)
    assert new.values == old.values
    assert new.cell == old.cell
    assert invariants have equivalent predicates under the same mapping

assert existing NONE + FAILED still gives CONTINUE
assert numeric boundary facts still use the current 100000-token default
assert foreign/stale/missing receipt is rejected by the REAL launch adapter
```

Use the actual `decide(table, point)` API, not a new table method. The independent enumeration script in this delivery is a review oracle; it must never be copied into AMUX as a substitute compiler.

## R5. ai-dsl status pilot: finite table over existing normalized facts

**Current ProductSpec API shape; illustrative new ai-dsl declaration.** This is a migration target, not implemented production behavior. Keep backend status normalization and source filtering at their current boundary.

```ts
import { choice, defineDecisionTable, on } from '@v1d/product-spec';

export const activityRules = defineDecisionTable({
  id: 'aidsl.activity-state',
  axes: {
    base: ['queued', 'running', 'done', 'partial', 'failed', 'cancelled'],
    phase: ['none', 'warmup', 'publish'],
    waiting: ['YES', 'NO'],
  },
  columns: {
    state: choice([
      'queued', 'waiting_resource', 'running', 'warming', 'publishing',
      'done', 'partial', 'failed', 'cancelled',
    ]),
  },
  cells: [
    on('done',      { base: 'done' },      { state: 'done' }),
    on('partial',   { base: 'partial' },   { state: 'partial' }),
    on('failed',    { base: 'failed' },    { state: 'failed' }),
    on('cancelled', { base: 'cancelled' }, { state: 'cancelled' }),
    on('waiting', { base: 'queued', waiting: 'YES' }, { state: 'waiting_resource' }),
    on('queued',  { base: 'queued', waiting: 'NO' },  { state: 'queued' }),
    on('running',    { base: 'running', phase: 'none' },    { state: 'running' }),
    on('warming',    { base: 'running', phase: 'warmup' },  { state: 'warming' }),
    on('publishing', { base: 'running', phase: 'publish' }, { state: 'publishing' }),
  ],
});
```

There are 6×3×2 = 36 input points. Terminal status wins even if old phase data remains. Queue waiting is only applied to queued jobs. `idle` is still the empty scoped aggregate, not another raw job state. An unknown backend status must not be coerced to a plausible known one to make `decide` work.

Port this only if comparison against actual `activity.js` and all real consumers proves it replaces the intended classification. Do not add a second status table for each component. Dynamic progress, source identity, timing and queue rank remain runtime facts.

## R6. State presentation with the actual current call shape

**Current API shape, not the previously shortened fictional signature.** Wire into an eligible declared product boundary only after checking the consumer’s installed package.

```ts
import {
  finiteValues, defineStatePresentation, statePresentationField,
} from '@v1d/product-spec';

const requestStates = finiteValues('example.request-state', [
  'ready', 'sending', 'unknown', 'done',
]);

const requestPresentation = defineStatePresentation(requestStates, {
  id: 'example.request-presentation',
  fields: [
    statePresentationField('label', 'string'),
    statePresentationField('canSubmit', 'boolean'),
  ],
  cases: {
    ready:   { label: 'Apply',          canSubmit: true },
    sending: { label: 'Applying',       canSubmit: false },
    unknown: { label: 'Check outcome',  canSubmit: false },
    done:    { label: 'Applied',        canSubmit: false },
  },
});
```

These are example request states, **not a new source of ai-dsl's document/job truth**. If the current request owner already carries equivalent states, declare them instead. Compose `defineStateAuthority` with the actual source output contract, discriminator and component input. Do not infer a second authority from labels or copy the full document into this presentation.

A valid presentation does not run IO. Unknown outcome does not mean request failed, retry authorized or document untouched. The runtime checks the existing command receipt before retrying.

## R7. Explicit edges and multiple UI entrances, one writer

**Application wiring pseudocode.** Real ports and contracts must use the current ProductSpec constructors and existing binding generator. Do not invent a generic `component({events: ...})` export.

```text
inspector.apply ---> editHost.applyFromInspector --+
                                                 +--> existing edit-session commit
agentPanel.apply --> editHost.applyFromAgent -----+

analysis.generate --> existing job owner --> immutable candidate artifact
candidate + current scoped document --> pure presentation --> inspector / agentPanel
```

If the graph grammar requires one source per input, use explicitly named ingress ports bound to the same writer; do not bypass validation or auto-wire by type. Matching payload types prove compatibility, not which source the product intended.

Actual registration proof in pseudocode:

```text
expectedEdges = compile(declaration).requiredEdges
observedEdges = actualPortRegistry.registrations()
assertBidirectionalConformance(expectedEdges, observedEdges)

click real mounted Apply control
assert exactly one real command reached the existing writer
assert its payload names the current scope and expected revision
assert actual resulting presentation reflects the receipt
```

`observedEdges = expectedEdges` is not a valid implementation. The binding ledger must come from actual registrations. Native/runtime code leaves are legal; claiming an observational edge is a running connection is not.

## R8. Safe asynchronous publication without a new async DSL

**Application pseudocode, to adapt to the existing scope/cache/job owner.** No names below are new ProductSpec primitives.

```ts
async function refreshCurrentView() {
  const ticket = owner.captureReadTicket();
  // ticket identifies scope, material/representation and request generation.
  // It does not unnecessarily bind all caches to every timeline edit.
  const raw = await transport.read(ticket.request);
  const payload = existingDecoder.parse(raw);

  // Cache truth and currently displayed truth are different permissions.
  if (owner.matchesResourceRevision(ticket, payload)) {
    owner.cacheFor(ticket.scope).accept(payload);
  }

  owner.withSynchronousPublication(() => {
    if (!owner.isCurrentGeneration(ticket)) return;
    if (!owner.matchesResourceRevision(ticket, payload)) return;
    owner.publishView(payload);
  });
}
```

The final check and view publication must not have an await between them. For cross-process writes, use the real transactional/CAS boundary instead of pretending a JS callback protects other processes.

Test A -> B -> A, not only A -> B. Test same filename in different workspaces and duplicate/lower resource versions. A valid late source result may be cached without changing the new view. Abort is an optimization; ticket checking remains required after resolution.

## R9. Apply policy and actual commit

**Application pseudocode.** Preserve current `applyEditTurnAtomically(plan, options)` and its exact plan contract.

```ts
async function acceptProposal(request) {
  const decoded = existingProposalDecoder.parse(request);
  return existingOwner.serialize(async () => {
    authorizeCommandScope(decoded); // do not expose another scope's receipt
    // Check a prior outcome BEFORE rejecting a new stale operation:
    // a successful earlier attempt may itself have advanced the revision.
    const prior = existingOwner.receipt(decoded.commandId);
    if (prior) return requireSamePayloadAndReturn(prior, decoded);

    const current = existingOwner.snapshot();
    const facts = observeApplyFacts(decoded, current);
    const decision = decide(applyRules, facts);
    if (decision.values.action !== 'APPLY') {
      return refuseWithWitness(decision); // no silent legacy fallback
    }

    // Domain binding checks are additional only when the operation reads them.
    // Use an owned envelope/versioned boundary; do not add unknown fields to V1.
    checkDeclaredDependencies(decoded, current);

    // No intervening await before the owned synchronous document mutation.
    const receipt = existingSession.applyEditTurnAtomically(decoded.plan);
    return existingOwner.recordOutcome(receipt);
  });
}
```

This is NOT a claim that ai-dsl already has the illustrated `serialize`, durable receipt or broad dependency API. Map responsibilities to existing session and persistence code; do not build a second engine from the pseudocode. A same-ID/different-payload request conflicts. A network timeout after a commit has an unknown outcome until the canonical receipt is read.

The illustrated `recordOutcome` after a mutation does not by itself make document and receipt durable atomically. Bind both to the existing transactional owner where supported, or report an unknown outcome and reconcile after failure. Do not claim exactly-once durability from this call ordering alone. Retrying a completed command returns its prior result only after authorization and payload equality; a conflicting payload never reuses that receipt.

Current timeline revision/digest protection is retained. Source binding and markers need their own dependency consideration because they are outside timeline undo. A private session draft may simulate effects without committing; it must not become a second persistent writer.

## R10. Observation, decision and effect in AMUX

**Application pseudocode reflecting the existing separation.** Keep the actual launch/compact controller and lease.

```text
under existing session lease:
    collect facts for EXACT addressed session/context generation
    classify compact receipt using actual verified receipt reader
    decide through the shared table
    if HOLD: return named refusal and missing evidence
    if COMPACT:
        submit once through existing attempt fence
        read exact-session completion receipt
        if missing/ambiguous: retain blocked/unknown outcome; no automatic retry
    launch selected profile through existing controller
    verify actual live selection
    persist existing receipt/state
```

The table never runs compact or starts a pane. The native/kernel inputs must be current at the effect boundary. Test with controlled collaborators; do not consume subscriptions or wake 30 panes to demonstrate a naming migration.

## R11. Budgeted media analysis as a future consumer, not a second scheduler

**Application pseudocode for the existing job/budget owner.** It clarifies the promised boundary; it is not scope for P1.

```text
generate candidates(request):
    validate source, representation, range, target and approved budget/provider
    reuse matching observations/track if available
    otherwise reserve cost/attempt in the existing budget owner
    run one bounded observer job
    save evidence with actual view transforms, timestamps and unresolved ranges
    derive FocusTrack, then camera recipe without mutating accepted edit
    present one recommendation; alternatives and local refine are optional actions

refine(intervals):
    every child job consumes from SAME parent reservation/limit
    no fresh max_calls copy per tag or interval
    source read receipt + failed/ambiguous attempt remains recorded
    hard request timeout is separate from “stop starting work after deadline”

apply(recipe):
    same owned Apply path as other edits
    validate source/time/geometry dependencies and manual locked anchors
```

The cost contract records unique source times, rendered observation views, submitted images, requests and billed usage separately. Twelve time samples with four views each are 48 images, not 12. Sparse framing estimates do not prove frame-exact event onsets. A changed crop, definition or representation invalidates evidence only as specified by the cache key, not by informal model confidence.

No dynamic model call during compilation, panel mounting or phone rotation. ProductSpec governs the declared requests; runtime validation, shared budget accounting and model/provider receipts govern actual effects.

## R12. Mechanical migration and cleanup

**Worker algorithm, not a new toolchain to build.** Reuse current generators, source analysis and test commands.

```text
read affected source + installed pin + runtime registration
capture baseline BEFORE regeneration
classify change:
    authoring-only -> equal normalized meaning / stable emitted bytes
    naming-only   -> explicit bijection of affected trace keys
    behavior fix  -> old symptom red, new intended behavior green
    wire change   -> compatibility version/read boundary

transform one scoped family or state consumer
compile with existing ProductSpec
run independent negative mutation fixtures
compare baseline and candidate without overwriting baseline
run actual selected runtime path
run codemod again: zero further source change
enable canonical-source error for new/changed legacy occurrences
remove the replaced writer/decision loop
record residual old occurrences, owner and retirement condition
verify rollback/session preservation
```

Never change `deliberate` to `immediate`, reorder stable IDs, strengthen an AMUX invariant or change a source timebase inside an “equivalent” migration. Byte equality is useful for syntax-only changes; it is not a reason to preserve a proven bug.

## R13. Reviewer checklist for a proposed new helper

```text
1. Which repeated semantic fact does this remove?
2. Is it already expressible by family, a typed tuple or current constructor?
3. Which independent requirement remains explicit?
4. What is its normalized existing output and independent oracle?
5. Can a wrong host/ID/edge/state still be rejected?
6. Does it preserve .ts inference AND runtime refusal for .mjs/decoded callers?
7. Is the consumer using a released compatible pin?
8. Does a real runtime binding use its output?
9. Does the old form become mechanically forbidden in the adopted scope?
10. Can it be removed/reverted without rewriting saved product data?
```

A “no” does not mean add more wrappers. It can mean keep the current clear code leaf. The target is minimum non-redundant authorship plus independent evidence, not minimum character count.
