# Living architecture contracts

Product Studio treats architecture documentation as three different kinds of evidence instead of one large prose field.

1. **WHAT / WHY** is human-authored intent.
2. **ProductSpec** is machine-declared structure.
3. **Tests and traces** are behavior contracts and observations.

The point is not more documentation. The point is to write only the information the compiler cannot derive.

## Service rule

Every ProductSpec `service(...)` should have one short source contract immediately above the declaration:

```ts
/**
 * WHAT: Routes recording commands and publishes the active session.
 * WHY: Keeps recorder effects separate from flight sensing and presentation.
 */
export const recordingRuntime = service({ ... });
```

WHAT names the stable responsibility. WHY names the boundary, coupling or failure mode the service protects.

Do not copy ports, effects, lifetime, durability, state ownership or consumers into prose. Studio derives those facts from the compiled model.

Good:

```text
WHAT: Stores user preferences behind typed toggle inputs and status output.
WHY: Keeps persistence ownership separate from settings controls and wake-word presentation.
```

Bad:

```text
WHAT: Manages preferences.
WHY: Provides a way to handle preferences cleanly.
```

The AMUX contract linter remains the grammar/quality owner. Product Studio extracts validated-looking tags for display and reports a missing/incomplete service contract, but it does not invent wording or replace the linter.

## Why comments, not ProductIr fields

WHAT/WHY belongs to source intent, not runtime semantics. Changing a sentence must not change native output or the compiled model identity.

Inspection bundles therefore carry contracts as metadata. `modelDigest` continues to describe compiled meaning; `bundleDigest` also covers documentation and evidence metadata.

This keeps one program definition while still making the architecture readable.

## BDD and test contracts

Tests are useful documentation, but a test name is not runtime evidence and a declared test is not a passing test.

Inspection metadata may associate an existing test with exact semantic entities:

```js
testContracts: [{
  id: "recording.starts",
  level: "host",
  entityKeys: [entityKey("node", "recording.runtime")],
  given: "recording is armed",
  when: "the start command arrives",
  then: "one active session is published",
}]
```

Use the existing test owner. Do not create a second Studio test registry just to make the UI look complete. Prefer associations derived from real ProductSpec IDs used by the test. Add an explicit association only when it cannot be derived safely.

Studio labels these as **Behavior contracts** and explicitly says it has not run them. A future exact-revision test-result adapter may add pass/fail evidence separately.

## Agent guardrail

Before changing an architectural service, an agent should inspect:

```text
WHAT
WHY
declared ports
effects
state owner
lifetime
consumers
associated logic
behavior contracts
```

If the proposed change contradicts WHY or adds responsibility outside WHAT, the agent should flag the architecture change instead of silently broadening the service.

A useful sequence is:

```text
inspect intent
→ inspect declared structure
→ inspect impact
→ edit normal source
→ run the product-owned build/tests
→ regenerate inspection
→ compare the new model
```

Studio is not the source-writing authority and does not run product effects automatically.

## Legacy prose

Existing prose such as an app-service `reason` may remain when it is genuinely runtime/user-facing copy or describes cadence. Do not duplicate the same architectural intent into both `reason` and WHAT/WHY.

When a legacy field is only architecture prose, migrate it deliberately and remove the duplicate after its consumers are understood.

## Ownership summary

| Concern | Owner |
| --- | --- |
| Responsibility and boundary | WHAT / WHY in source |
| Ports, effects, lifetime, state | ProductSpec |
| Source identity | inspection provenance |
| Expected behavior | existing BDD/unit/host tests |
| Actual execution | recorded trace |
| Quality of WHAT/WHY prose | AMUX contract lint |
| Presentation | Product Studio |

Less is more: two human sentences per service boundary, everything else derived.
