# ProductSpec authoring DX handoff

Status: proposal only. No runtime, IR, emitter or consumer change is authorized by this document.

Date: 2026-09-20

Owner: `@v1d/product-spec` in CircleKit. Domain-specific helpers remain in `product-emit`. Consumers include Skyvw and AMUX.

## Recommendation

Do a small ProductSpec authoring-DX pass now, but do not invent a second DSL.

Keep the current compiler, closed vocabularies, exhaustive decision tables, graph laws and deterministic IR. Reduce boilerplate only where an authored field is already determined by another authored fact, or where the same structural fact is repeated across a family.

The rule for this work is:

> The product writes decisions that require a product decision. The compiler derives what logically follows from those decisions.

A shorter spelling is not enough reason to add syntax. A helper must remove a named duplication class, improve type guidance, or move an existing correctness rule into the compiler.

## What stays canonical

Do not replace or fork these concepts:

- `service`, `derive`, `present`, component types and explicit ports.
- Decision tables with exhaustive finite axes and exactly one covering cell.
- `axes`, `columns`, `cells`, `invariants` and `on(...)` as the canonical decision-table representation.
- Stable ids in Product IR.
- Explicit state authority and external effect ownership.
- Generated/native conformance as separate proof from the declaration.
- Existing code as a valid leaf. There is no DSL coverage target.
- No silent default for a new enum value.
- No controller/runtime sequencing hidden inside a decision table.

The guide's "thing, fact, law, system, proof" vocabulary remains the mental model. Do not add a parallel `facts/rules/laws` object spelling merely to rename `axes/cells/invariants`; two equivalent grammars would make DX worse.

## P0: remove facts that are already derivable

### Interaction declarations

Skyvw currently repeats information in declarations similar to:

```ts
{
  kind: "discrete-action",
  controlId: interactionControlId("action.replay-clouds"),
  timing: "deliberate",
  mounts: [
    {
      id: interactionMountId("mount.replay-clouds.phone-menu-row"),
      kind: "atom",
      requiredHosts: ["phone"],
    },
    {
      id: interactionMountId("mount.replay-clouds.wear-face-tool"),
      kind: "atom",
      requiredHosts: ["wear"],
    },
  ],
  requiredHosts: ["phone", "wear"],
  source: {
    file: sourceFile,
    declarationId: "action.replay-clouds",
  },
}
```

The compiler already knows several relationships:

- a discrete action requires atom mounts;
- declaration host coverage must equal the union of mount hosts;
- one source file is shared by the declaration list;
- declaration identity normally carries the same control identity;
- mount ids repeat control/host information.

Add a `product-emit` authoring helper only for fields that can be derived without ambiguity. An illustrative target form:

```ts
const action = defineActionFamily({
  sourceFile: "appspec/products/skyvw/menus/interactions.ts",
});

export const skyvwInteractions = [
  action("replay-clouds", {
    timing: "immediate",
    mounts: {
      phone: "menu-row",
      wear: "face-tool",
    },
  }),
];
```

Acceptance:

1. Same normalized interaction IR as the explicit form.
2. Stable ids remain byte-identical unless a separate migration explicitly changes them.
3. Unknown host, illegal mount kind and incomplete host coverage still fail.
4. A future host is never silently included.
5. One negative mutation proves each derived law still bites.

Do not infer semantic timing from a control name. If timing can be proven from an already canonical setting/navigation/action semantic, bind to that canonical declaration rather than adding another descriptive field.

### Settings mount families

Skyvw already has a local `mountFamily(...)` because repeated mount kinds created copy-paste drift. Generalize only the useful pattern into the domain authoring package.

For ordered settings sections, array order is already the order fact. Prefer:

```ts
settingsSection("DISPLAY", [
  dialDirectionSetting,
  showAchievementsSetting,
  groundScreenSetting,
  brightnessSetting,
]);
```

over repeating:

```ts
{ setting: ..., mount: { kind: "settings-section", section: "DISPLAY", order: 0 } }
{ setting: ..., mount: { kind: "settings-section", section: "DISPLAY", order: 1 } }
```

Keep section identity explicit and derive only numeric order.

### Repeated component trees

When several explicitly named surfaces have the same tree, allow one shared declaration such as:

```ts
sameTree(["round", "compact", "wide"], [
  primary(settingsHome),
  primary(settingsMenu),
  primary(statusHub),
])
```

Do not add an implicit `all surfaces` default. A future surface must force an explicit decision.

## P1: improve references instead of copying string ids

Bindings remain explicit, but authoring should prefer typed handles over manually repeated strings where possible.

Current shape:

```ts
bindings: {
  inputs: {
    model: "ui.projection.settings-menu.model",
    accountState: "sync.watch-account-state.presentation-adapter.presentation",
  },
  events: {
    action: "ui.surface-interaction.settingsMenuAction",
  },
}
```

Target properties:

- the author still names every edge;
- the referenced node/port supplies a typed ref;
- serialization still produces the same stable string id;
- rename/type errors are caught before generation.

Do not auto-wire by compatible type. Explicit topology is a correctness feature.

## P1: make diagnostics first-class DX

Standardize compiler-facing failures so agents and people get structured information:

```text
law: interaction.mount.host-coverage
declaration: action.replay-clouds
found: phone
expected: phone, wear
because: mount host union must equal requiredHosts
source: ...
```

Decision tables already return the deciding cell id. Add a small inspection/formatting API if useful:

```text
amux.context-cost
cell: compact-once
inputs:
  context: COMPACT_DUE
  compactReady: READY
  priorCompact: NONE
output:
  action: COMPACT
```

This is presentation over the existing decision result, not new semantics.

## P1: use better product vocabulary without renaming the core DSL

The generic table words `axes`, `columns`, `cells`, `invariants` and `on` are precise and should stay.

Consumer axis names should describe the fact directly.

For AMUX context cost, prefer:

| Current | Prefer |
| --- | --- |
| `need` | `context` |
| `NONE` | `WITHIN_POLICY` |
| `COMPACT` as input state | `COMPACT_DUE` |
| `readiness` | `compactReady` |
| `SAFE/UNSAFE` | `READY/BLOCKED` |
| `attempt` | `priorCompact` |
| `NEW` | `NONE` |

For AMUX Codex launch, prefer:

| Current | Prefer |
| --- | --- |
| `identity` | `session` |
| `selection` | `modelMatch` |
| `SAME/CHANGED` | `SAME/DIFFERENT` |
| `receipt` | `compactProof` |
| `blocked` | `priorTransition` |

These are consumer declaration migrations, not ProductSpec keyword changes. Audit logs/tests before changing existing cell/output words because those names are operational evidence.

## P2: one verification loop

The ProductSpec guide already notes that product verification can rebuild TypeScript several times. Add or measure one `verify` path only if it actually shortens the local loop.

It should:

1. build once;
2. compile declarations;
3. emit to a temporary/in-memory destination where practical;
4. compare tracked projections;
5. run the declaration's law tests;
6. present one structured diagnostics result.

Do not wire it into release or CI merely because it exists. Keep the current local-first ownership rule.

## Explicit non-goals

Do not do any of these in this DX pass:

- no new AMUX-specific DSL for decisions ProductSpec already expresses;
- no second decision-table grammar;
- no default/fallback cell for uncovered enum values;
- no wildcard syntax such as `*` when omission already expresses a region;
- no automatic graph wiring by matching types;
- no attempt to encode locks, retries, clocks, async IO or provider effects as ordinary decision-table cells;
- no migration whose only benefit is fewer characters;
- no broad consumer rewrite before one representative fixture proves the helper.

## Why runtime/controller bugs stay outside this change

AMUX's recent compact/model issues are a useful boundary example.

A decision table can correctly answer:

```text
facts -> COMPACT / HOLD / CONTINUE
```

It cannot prove that runtime code:

1. acquires a lease;
2. waits;
3. re-reads the current receipt;
4. checks session identity;
5. submits exactly once;
6. observes the correct provider receipt.

Those are sequencing and effect proofs. Keep them in normal controller code and tests. Do not respond to a controller race by expanding the DSL until it becomes an async runtime language.

## Implementation order

### E1. Measure two real fixtures

Before changing API, record the authored shape of:

- Skyvw `menus/interactions.ts` plus one repeated settings/component-tree family;
- AMUX `policies/context-cost.mjs`.

Count repeated fields and identify which are derivable versus genuine decisions. Do not use total LOC alone as the success metric.

### E2. Land one generic or domain helper

Choose the clearest named duplication class, likely interaction mount/host metadata or ordered settings sections.

Add:

- a positive type/runtime fixture;
- one red mutation per derived law;
- an explicit before/after IR equality assertion.

### E3. Migrate one Skyvw declaration family

Generated Product IR and native projection must be byte-identical unless the PR explicitly declares a schema migration.

Review the authoring diff. If the helper hides product decisions or requires explaining more concepts than it removes, revert it.

### E4. Improve AMUX vocabulary

Rename product axes only after checking logs/tests that consume those words. Do not mix this naming cleanup with controller-race fixes.

### E5. Typed refs

Prototype typed port refs on one component family. Require explicit edge authoring and byte-identical stable ids.

### E6. Decide whether more is warranted

Only generalize another pattern when at least two consumers exhibit the same duplication class. Skyvw-only UI composition helpers may correctly stay in `product-emit/skydiving`.

## Merge gates

A DX change is ready only when:

- old explicit declarations still work during migration;
- one source of semantic truth remains;
- Product IR/output is unchanged unless explicitly versioned;
- uncovered combinations still fail closed;
- negative mutation tests prove the old laws still bite;
- the author writes fewer duplicated facts, not merely fewer characters;
- error messages are at least as specific as before;
- the guide has one canonical spelling for each concept.

## End state

```text
AUTHOR
writes only product decisions
        |
        v
PRODUCTSPEC / DOMAIN AUTHORING
derives structural metadata
refuses holes, overlap and illegal combinations
        |
        v
DETERMINISTIC IR
stable ids, explicit topology
        |
        v
CONTROLLER / PLATFORM
locks, IO, retries, timing, rendering
        |
        v
CONFORMANCE + RUNTIME PROOF
proves the real system fulfilled the declaration
```

This is an authoring-DX evolution of the current ProductSpec language, not a new language.
