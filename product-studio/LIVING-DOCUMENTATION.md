# Living documentation in Product Studio

This feature keeps four questions separate:

1. **Intent**: short source-owned `WHAT:` and `WHY:` comments.
2. **Declared reality**: ProductSpec ports, effects, ownership, lifecycle, bindings and consumers.
3. **Behavior evidence**: optional test reports. A test result is not runtime observation.
4. **Observed reality**: recorded traces from a specific execution.

The rule is deliberately small: **humans and agents write intent; machines derive structure and evidence.**

## Authoring rule

Every ProductSpec `service()` type in the selected source scope needs one adjacent contract:

```ts
/**
 * WHAT: Publishes the active recording session and accepts recording commands.
 * WHY: Keeps recorder effects separate from sensing and presentation.
 */
export const recordingService = service({ ... });
```

`WHAT` names the responsibility. It must not repeat ports, counts or lifecycle fields that ProductSpec already declares.

`WHY` names the important boundary or failure mode. Prefer concrete forms such as `Keeps X outside Y`, `Separates X from Y`, `Prevents X when Y` or `Avoids X across Y`.

Do **not** add parallel prose fields such as `purpose`, `owns`, `doesNotOwn` or `description`. Node instances, ports, cells and bindings do not get this ProductSpec-specific prose requirement.

The wording grammar remains owned by AMUX `core/contract-lint.mjs`. Product Studio discovers the relevant service calls and delegates wording checks to that evaluator. There is no LLM quality judge.

## Computed service factories

A service factory may compute its concrete ProductSpec ID:

```ts
function defineFeature(product: string) {
  /** WHAT: ... WHY: ... */
  return service({ id: `${product}.service` });
}
```

The source intent is still checked at the real `service()` call. A computed ID is reported as an identity limitation, not a missing contract. Model correlation requires exact exported source provenance; Studio never runs a factory merely to discover an ID.

## Existing SKYVW app-service reason

`AppServiceDeclaration.reason` remains legacy/user-facing copy. `runs` still owns cadence. Do not copy either field into ProductSpec prose mechanically.

Studio may show **Legacy reason** separately. A same-looking name is not enough to merge it with a ProductSpec service. Migrate only when stable identity or an explicit relation proves they are the same real boundary.

## Inspection, not ProductIr

WHAT/WHY is inspection metadata. Changing a comment must not change ProductIr or runtime behavior.

Studio can show, for an exactly correlated service:

- WHAT
- WHY
- inputs and outputs
- effects
- state owner
- lifecycle and durability
- consumers
- exact source location

A stale or same-ID source file must not replace the intent attached to a compiled model.

## Problems and enforcement

Missing or invalid service intent is an **authoring check**, not a product startup or release gate. Opening Studio is read-only and never starts generators, providers, native runtimes or tests.

Run the explicit source check from a configured repository:

```bash
node studio.mjs check
```

The command requires the existing AMUX grammar checkout. With sibling checkouts the launcher finds it automatically. For other layouts set:

```bash
AMUX_ROOT=/path/to/agentmux
STUDIO_ROOT=/path/to/circlekit/product-studio
```

Install the Studio's own locked dependencies once:

```bash
cd /path/to/circlekit/product-studio
npm ci
```

Then from a product checkout:

```bash
node studio.mjs check
node studio.mjs
```

The viewer does not install packages on demand.

## Evidence

Behavior evidence is optional. Missing reports mean **no evidence**, not a documentation failure.

Do not add a `tests: []` registry to ProductSpec. Prefer exact IDs already referenced by real tests. Use explicit coverage annotations only when a relation cannot be derived safely.

Keep evidence labels precise:

- unit/component/integration result: producer-reported test evidence
- generated structural law: declaration evidence
- recorded trace: observed execution evidence

A passing test does not mean "runtime proven". A source reference does not mean the referenced service was exercised.

## Agent workflow

Before changing a service boundary:

1. Read WHAT/WHY.
2. Inspect declared ports/effects/ownership and consumers.
3. Inspect available behavior evidence.
4. Inspect recorded evidence if the task depends on runtime behavior.
5. If the proposed dependency conflicts with WHY, surface the conflict instead of silently rewriting the intent.
6. Update WHAT/WHY only when the architectural responsibility itself changes.

For new products, add a small `studio.workspace.json` selecting the actual source roots and generated inspection artifact when one exists. Keep product compiler versions authoritative. Do not upgrade a product merely to make Studio agree with it.

## Why this shape

The alternative was more metadata: `purpose`, `owns`, `doesNotOwn`, duplicated dependency lists and a test registry. That creates stale parallel truths.

This design writes only information that cannot be derived reliably: responsibility and boundary intent. ProductSpec supplies declared structure, test tools supply behavior evidence, and traces supply observations.
