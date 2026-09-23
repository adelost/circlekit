# The product DSL in one page

For agents and for people. Every path and command in this file is checked by `scripts/check-guide-paths.sh`, so a stale line turns red instead of lying.

## 1. Five words

**Thing, fact, law, system, proof.**

| Word | Meaning | Example |
|---|---|---|
| Thing | anything with an id | a page, a stream, the table `power`, the lane `pressure` |
| Fact | a declared property on a thing, never a branch | "in freefall the barometer is asked for 20 Hz" is a cell; "the pressure stream rides the pressure lane" is a ride |
| Law | what must hold across facts, proven when the declaration builds | every point of a table's axes has exactly one cell; a stream never rides the UI lane |
| System | a platform's emitter, its native runtime, and the capabilities it declares | Kotlin today; a new platform is an emitter plus bindings and a capability list, not text generation alone |
| Proof | one generated test per declaration kind | every declared input runs once; every declared page renders; every table point decides |

The product writes facts. The kit owns shapes, laws and emitters. A platform adds an emitter, never a shape.

## 2. Where things live

| Layer | What | Where |
|---|---|---|
| Shapes and laws | decision tables (`product-spec/src/decision-table-model.ts`), lanes (`product-spec/src/lanes-model.ts`), interaction timing, the two kinds of button and nothing between them (`product-spec/src/interaction-timing-model.ts`), navigation, components, state authorities, palettes | `product-spec/src/` |
| Machines | a lifecycle as states, inputs, named guards and cells `from + on + guards -> to`, refused at build unless every state is reachable, every input accounted for, and every state that is not a declared rest left by a declared deadline input; `step()` answers one input (`product-spec/src/machine-model.ts`); Kotlin cells and `declaredNext` (`product-emit/src/core/emit-machine-kotlin.ts`) a Mermaid `stateDiagram-v2` (`product-emit/src/core/emit-machine-mermaid.ts`), a Stately Studio `createMachine` source, export only (`product-emit/src/core/emit-machine-stately.ts`) and Swift with a parity cases file the TypeScript answer is the oracle for (`product-emit/src/core/emit-machine-swift.ts`, `product-emit/src/core/emit-decision-table-swift.ts`) | `product-spec/src/`, `product-emit/src/core/` |
| Emitters | Kotlin; a platform is one more | `product-emit/src/` |
| Domain words | skydiving: phases, bands, stages, units (meanings, not thresholds) | `skydiving-legos/src/` |
| One product's facts | cells, copy, feeds, lanes, pages, thresholds | the product's `appspec/products/<name>/` |
| Projections, never edited | `Generated<Product>*.kt`, `<product>.product.json`, `<product>.graph.mmd` | the product's `appspec/generated/` |

## 3. What a fact looks like

A cell in a decision table. Read it as a sentence: "on the ground or landed, with a lit face, just after you arrived, ask the barometer for the live rate."

```ts
on("ground.lit.arrival",
   { phase: ["GROUND", "LANDED"], display: "INTERACTIVE", arrived: "JUST_NOW" },
   { brightness: litGroundFace, screenHold: stayOnHolds, pressure: live })
```

A derived axis, declared beside the cells so the window has an owner. Read: "arrived is JUST_NOW for 30 s after the face lights or a touch, restarted by a touch, ended when the face goes dark."

```ts
derived: { arrived: { inside: "JUST_NOW", outside: "SETTLED", windowMs: 30_000,
                      startsOn: ["FACE_LIT", "TOUCH"], restartsOn: ["TOUCH"], endsOn: ["FACE_DARK"],
                      source: "docs/architecture/barometer-rate.md" } }
```

A product invariant. Read: "no airborne decision may ask for less than 20 Hz." It runs once when the table builds and never reaches a device.

```ts
invariants: [{ refuse: "air must read pressure live", when: (d) => isAirborne(d.at.phase) && d.values.pressure.hz < 20 }]
```

A machine or table included in a product names its runtime **node type** with
`ownerNodeTypeRef: "recording.runtime"`. The product compiler refuses a missing
or unknown owner and carries the exact reference into ProductIr. It never
guesses from a similar ID or a node instance name. A standalone machine or
table with no product graph may omit the owner and remains independently usable.

A lane and a ride (`defineLanes`; Android Kotlin from `product-emit/src/core/emit-lanes-kotlin.ts`). Read: "pressure samples get their own serial lane, because a late sample is a late altitude."

```ts
lanes: { pressure: { isolation: "dedicated", owner: "pressure-hub", lifetime: "process", ordering: "serial", reason: "a late sample is a late altitude" } },
streams: ["stream.pressure"],
rides: { "stream.pressure": { lane: "pressure", owner: "pressure-hub" } }
```

## 4. The four questions

1. **I want to add or change a fact** (a cell, a hint, a feed, a ride): open the thing's file under the product's `appspec/products/<name>/`, change the fact, run the product's generate. If the build refuses, the message names the law and the fix. Never add a Kotlin branch instead.
2. **I want a new kind of thing** (a shape): it goes into `product-spec/src/` with at least one law the product cannot switch off and a portability note saying what Swift and Monkey C would emit. Nothing only Android can express. Then an emitter in `product-emit/src/`. Publish with `scripts/publish-product-spec.sh` and `scripts/publish-product-emit.sh`, pin in the product.
3. **I want a new platform**: one emitter per shape in `product-emit/src/`, plus that platform's runtime glue. No product file changes.
4. **I want to prove it**: the generated tests already cover every declaration kind. A hand-written test is for a reported symptom, red before the fix, or a named contract example that pins a public boundary's delivery or timing rule before the first bug; never a copy of the kit's form test.

## 5. How to review a change

- A diff that adds a fact touches one file under the product's `appspec/products/`, the generated projections, and nothing under the product's `app/src/main`. If it touches Kotlin, ask why.
- A diff that adds a Kotlin branch on `phase`, `display` or another declared axis is a cell that escaped. Send it back.
- A diff that adds a second copy of a colour, label, threshold or id is a fact that escaped. Send it back.
- A diff that adds a file to a baseline is a gate being switched off. Send it back.
- Every decided value carries the id of the cell, rule or lane that decided it. When a test or a recorded jump says `ground.lit.arrival`, that id is the line to read.

## 6. Laws, in order of preference

1. Refused at declaration: the DSL does not build.
2. Generated proof: one test per declaration kind.
3. A gate with a shrink-only baseline for what already exists: new files comply, old ones are listed and only leave.

A code pattern that matters is a law or it is not a rule. Gates are run by the owner before merge, never wired into the build or a release path.

Two laws for mapping code (row 155, the language freeze in Skyvw's docs/plans/2026-09-17-dsl-language-freeze.md):

- **Existing code is a valid leaf.** A component or service implemented in code with declared ports is not debt and has no colour; there is no DSL coverage target. A leaf is refined into declarations only where the declaration buys simpler logic (fewer branches, one source of truth), portability (a second platform consumes it) or a proof (a law refused at build), and the row names which. "More DSL" is never a reason on its own.
- **A mapped edge is bound or says it is not.** An edge in a product graph is runtime-bound (generated bindings carry it, the port ledger can see it) or explicitly observational, and an observational edge exists only on nodes that are not wired. The compiled product keeps every strict check; mapping never switches a check off for runnable code.

## 7. What not to do

- No functions in a cell, a region or a ride: the shape refuses them. Build-time invariants are code and never enter the projections.
- No side fields beside a table: a rule that is really a cell becomes an axis.
- No silent default on a declared enum: an unreadable value is reported, not replaced.
- No file added to a baseline to get green.

## 8. Commands

In this repo, the kit:

```
cd product-spec && npm test        # the shapes and their laws, one red case per law
cd product-emit && npm test        # the emitters against the shapes
scripts/check-guide-paths.sh       # this file's paths and commands still exist
```

In a product (Skyvw), two loops, not one. After a cell or copy change, the short loop: regenerate, then the one test or page the change touches. The wide loop, the declaration's own tests and the stale-projection check, is for a change to a shape or a wiring file, not after every cell. Each of `npm test`, `npm run generate` and `npm run check-generated` starts with a clean TypeScript build, so running all three is three builds; a single `verify` script that builds once is a proposed improvement, measured before it is claimed.

```
(cd appspec && npm run generate)                       # short loop, then the targeted test or page
(cd appspec && npm test && npm run check-generated)    # wide loop, for shape or wiring changes
```

An example in this guide is a claim; the type-checked copy of it lives in the kit's tests, and a change to the shape that breaks the example turns that test red before the guide can go stale.
