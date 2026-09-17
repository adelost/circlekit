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
| Shapes and laws | decision tables (`product-spec/src/decision-table-model.ts`), lanes (`product-spec/src/lanes-model.ts`), navigation, components, state authorities, palettes | `product-spec/src/` |
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

A lane and a ride (`defineLanes`; Android Kotlin from `product-emit/src/core/emit-lanes-kotlin.ts`). Read: "pressure samples get their own serial lane, because a late sample is a late altitude."

```ts
lanes: { pressure: { isolation: "dedicated", ordering: "serial", reason: "a late sample is a late altitude" } },
streams: ["stream.pressure"],
rides: { "stream.pressure": "pressure" }
```

## 4. The four questions

1. **I want to add or change a fact** (a cell, a hint, a feed, a ride): open the thing's file under the product's `appspec/products/<name>/`, change the fact, run the product's generate. If the build refuses, the message names the law and the fix. Never add a Kotlin branch instead.
2. **I want a new kind of thing** (a shape): it goes into `product-spec/src/` with at least one law the product cannot switch off and a portability note saying what Swift and Monkey C would emit. Nothing only Android can express. Then an emitter in `product-emit/src/`. Publish with `scripts/publish-product-spec.sh` and `scripts/publish-product-emit.sh`, pin in the product.
3. **I want a new platform**: one emitter per shape in `product-emit/src/`, plus that platform's runtime glue. No product file changes.
4. **I want to prove it**: the generated tests already cover every declaration kind. A hand-written test is for a reported symptom, red before the fix.

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
