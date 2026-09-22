# Product Studio living-documentation takeover

> Canonical handoff for the next AI. Read this before changing code.
>
> **Verification policy: NO CI.** Do not create GitHub Actions, remote test runners, automated merge gates or CI for this work. All compile/test/smoke verification is owner-run on the user's own hardware.

## 1. Goal

Make Product Studio useful as living architecture documentation across CircleKit, SKYVW, AMUX and ai-dsl without introducing another semantic system.

The model is:

```text
INTENT
WHAT / WHY
    ↓
DECLARED REALITY
ProductSpec structure
    ↓
BEHAVIOR EVIDENCE
tests / declaration laws
    ↓
OBSERVED REALITY
runtime traces
```

Each layer answers a different question. Do not merge them.

## 2. Non-negotiable architecture

### Intent

Every selected ProductSpec `service()` type has one adjacent short contract:

```ts
/**
 * WHAT: Publishes the active recording session and accepts recording commands.
 * WHY: Keeps recorder effects separate from sensing and presentation.
 */
```

- WHAT = responsibility.
- WHY = important boundary / failure mode.
- AMUX `core/contract-lint.mjs` is the single wording grammar authority.
- No LLM semantic judge.
- No second prose schema such as `purpose`, `owns`, `doesNotOwn`, duplicated dependencies or prose lifecycle fields.
- Do not require this special prose on instances, ports, bindings, cells, `derive()` or `present()`.

### Declared reality

ProductSpec remains authoritative for:

- inputs / outputs
- contracts
- effects
- state ownership
- lifetime
- durability
- clock domain
- bindings
- consumers
- node/component instances

Studio derives these facts. Do not restate them in WHAT/WHY.

### SKYVW legacy app services

`AppServiceDeclaration.reason` remains separate legacy/user-facing copy.

- `runs` owns cadence.
- WHAT/WHY owns responsibility and architectural boundary.
- Same-looking names are not identity.
- Do not remove or silently migrate `reason` in this work.

### Evidence

Evidence is optional.

- A passing test is not runtime proof.
- A source reference is not executed coverage.
- `@covers` is optional, not a registry.
- Generated declaration laws are compiler/declaration evidence.
- Recorded traces remain separate observed evidence.
- Missing evidence reports are informational.

### Product versions

The product's installed and locked ProductSpec version remains authoritative.

Do not upgrade SKYVW web, AMUX Link, ai-dsl or another product merely to make Studio agree with it.

## 3. Current PR topology

### CircleKit

#### Bit 1 + bit 2 core

PR #276  
https://github.com/adelost/circlekit/pull/276

Branch:

```text
feat/studio-contracts-takeover-20260922
```

Current head:

```text
8e350b7e8e2d38a24808b7e18bdaf1808fdc5780
```

Base:

```text
feat/product-studio-experience-20260922
```

Status at handoff: open, draft, mergeable.

Contains the usable living-documentation core.

#### Optional evidence layer

PR #277  
https://github.com/adelost/circlekit/pull/277

Branch:

```text
feat/studio-evidence-takeover-20260922
```

Current head:

```text
373710901897a1c463013df6e3cf6360741d4134
```

Base:

```text
feat/studio-contracts-takeover-20260922
```

Status at handoff: open, draft, mergeable.

This is optional step 3. It must not block the usable WHAT/WHY workflow.

### SKYVW native

Original companion:

- #1663: https://github.com/adelost/skydive-altimeter/pull/1663
- head `c55c7578acabc43fd70508a2d0f03493390ab64e`
- base `main`
- open/draft/mergeable

Usable takeover:

- #1664: https://github.com/adelost/skydive-altimeter/pull/1664
- branch `feat/studio-contracts-takeover-20260922`
- head `76fe155c17f8118bdcc265c53300ac878abdae88`
- base = original living-documentation branch
- open/draft/mergeable

Optional evidence:

- #1665: https://github.com/adelost/skydive-altimeter/pull/1665
- branch `feat/studio-evidence-takeover-20260922`
- head `9114462bde52cdd5f5ea95eea53c79ad8aa78b86`
- base = native takeover branch
- open/draft/mergeable

### SKYVW web

PR #35  
https://github.com/adelost/skyvw-web/pull/35

Branch:

```text
feat/studio-contracts-takeover-20260922
```

Head:

```text
6e834b6c0e62947b99c11443aaf7a94bdf82603d
```

Base: `main`.

Status: open/draft/mergeable.

There is no separate step-3 web evidence PR at handoff time. The generic evidence layer can be added later only when a real web test/report warrants it.

### AMUX

Original companion:

- #410: https://github.com/adelost/agentmux/pull/410
- head `e34b7358041442c7dc4e0d57df5a778390eefa56`
- open/draft
- **currently not mergeable**. Treat this as an old-base integration problem, not a reason to redesign the feature.

Usable takeover:

- #412: https://github.com/adelost/agentmux/pull/412
- branch `feat/studio-contracts-takeover-20260922`
- head `2c6991f954f58207c1918067809a4e027356166c`
- base = original living-documentation branch
- open/draft/mergeable

Optional evidence:

- #413: https://github.com/adelost/agentmux/pull/413
- branch `feat/studio-evidence-takeover-20260922`
- head `bafb2af42d51299d04fcd038bd52fb0834ae221d`
- base = AMUX takeover branch
- open/draft/mergeable

### ai-dsl

Historical PR #411 is closed.

Bit-2 PR #412 is also closed and was previously dirty/non-mergeable. The branch still exists:

```text
feat/studio-contracts-takeover-20260922
head: 9621331589d3a5285fcc74c59def7f5bffc0ec30
```

Optional evidence PR #413 is open:

https://github.com/adelost/ai-dsl/pull/413

Branch:

```text
feat/studio-evidence-takeover-20260922
```

Head:

```text
520271b38a73aec935c6a9cd2a48d4eb6e0b101d
```

Base = the bit-2 takeover branch.

Status: open/draft/mergeable.

**Next AI must restore a clean review path for ai-dsl bit 2 before merging evidence.** Either reopen/replace/retarget the bit-2 PR as appropriate after inspecting why #412 was closed. Do not blindly merge #413 directly to master.

## 4. Bit 1/2 features already implemented

### ProductSpec service discovery

The scanner is designed to handle:

- direct `service()`
- import aliases
- namespace access
- const aliases
- const object arguments
- one-line WHAT/WHY comments
- computed-ID factories

A computed service ID does not prevent source intent validation. It does prevent model identity correlation until exact provenance resolves it.

Unsupported constructor escape remains explicit rather than silently claiming complete coverage.

### Grammar

Product Studio delegates wording to AMUX `evaluateContract`.

Expected philosophy:

- active WHAT verb
- short WHAT
- short WHY
- WHY describes boundary/failure mode
- no duplicated WHAT-as-WHY
- no generic AI filler

Do not fork these rules into Product Studio.

### Inspection metadata

WHAT/WHY belongs to inspection/documentation metadata.

It does not alter ProductIr semantics.

Exact source digest/span correlation is required before intent is presented as matched to the loaded compiled model.

### Studio UX

Current design includes:

- Intent & behavior view
- WHAT
- WHY
- declared facts
- exact source navigation
- Problems for missing/invalid contracts
- legacy reason shown separately
- behavior reports shown separately
- trace remains separate

### CircleKit shared service coverage

The intended selected roots include:

- `skydiving-legos/src`
- CircleKit Link
- CircleKit Showcase

Shared service intent belongs in the shared type owner, not duplicated in SKYVW instances.

### SKYVW native

Bit-2 branch has 8 reviewed local ProductSpec service WHAT/WHY contracts.

Known artifact facts inspected during development:

- product id: `skyvw`
- ProductSpec IR schema: 9
- 87 node types
- 89 nodes
- 301 bindings
- `recording.foreground-ingestion` has real `position` and `pressure` inputs
- `LIVE_SHARE.reason` remains present separately

Native validation stays owner-run. Do not add GitHub CI.

### SKYVW web

Bit-2 branch has 7 reviewed service boundaries:

- logbook
- details
- people
- sharing
- devices
- settings
- manual editor

Replay remains presentation-only.

The explicit export uses the web repository's locked ProductSpec 0.3.52.

The Studio artifact is deliberately `product-spec-graph`, not full ProductIr.

It may be inspected by a newer Studio but must not be silently simulated by the wrong compiler.

### AMUX

Takeover handles the Link service set including the computed wake-word factory.

AMUX remains the grammar owner.

### ai-dsl

The intended Product Studio object is the existing activity decision table:

```text
ai-tools.studio-activity
```

It is presentation over backend-owned status/wait/phase, not a new scheduler.

The design expectation is still 36 finite table points.

## 5. Step 3 optional evidence prepared

CircleKit #277 prepares:

- `bdd.run.v1` report writer
- owner-run Vitest reporter
- import of existing JUnit XML
- JS/TS test-source association
- Kotlin test-source association
- literal generated Kotlin ProductSpec ID association
- optional `@covers`
- optional `@proof`
- generated ProductSpec declaration laws
- exact-model law correlation
- product-local ProductSpec kernel selection via `--kernel-root`
- generic bounded authoring export for graph / machine / decision-table
- Studio proof-kind / association-kind presentation
- `product-studio/EVIDENCE.md`

### Evidence semantics

`source-reference`

Means a located test body references an exact ProductSpec ID.

It does **not** mean the service/port was exercised.

`author-declared`

Means optional `@covers` declared a relation.

It does **not** mean runtime observation.

`@proof`

May label scope such as host/unit/component/integration/e2e.

It does not promote the evidence into a trace.

`generated-law`

Means a matching ProductSpec evaluator accepted the declaration for the exact model digest.

### Product compiler laws

Generated laws are fail-closed.

- known producer + exact evaluator = evaluate
- unknown producer = skip
- version mismatch = skip
- never silently use Studio's newer compiler

Examples:

AMUX Link:

```bash
node studio.mjs laws   --product amux-link   --kernel-root android/audio-inbox/product-spec   --output test-results/link-laws.json
```

Expected product kernel: ProductSpec 0.3.64.

ai-dsl:

```bash
node studio.mjs laws   --product video-activity   --kernel-root ui   --output ui/test-results/activity-laws.json
```

Expected product kernel: ProductSpec 0.3.65.

## 6. Local-only verification policy

This rule overrides any older text/logs from development:

**Do not create GitHub Actions or other CI for this work.**

Do not:

- add workflow YAML
- add remote test runners
- add merge gates
- add remote hardware jobs
- add cross-repository CI credentials

All verification is manual on the user's hardware.

The current takeover branch heads were checked after cleanup and do not contain the temporary `.github/workflows/studio-contracts-takeover.yml`.

The old workflow may still exist in Git history. Do not revive it.

## 7. Recommended local verification order

Use sibling checkouts where possible:

```text
work/
  circlekit/
  agentmux/
  skydive-altimeter/
  skyvw-web/
  ai-dsl/
```

### A. CircleKit bit 2 first

Checkout PR #276 branch.

```bash
cd circlekit/product-studio
npm ci
npm run verify
node ../studio.mjs help
```

Then inspect/fix only concrete failures.

### B. SKYVW native bit 2

With CircleKit #276 and AMUX #412 compatible sibling checkouts:

```bash
cd skydive-altimeter
node studio.mjs check
node studio.mjs doctor --product skyvw --pretty
node scripts/verify-studio.mjs
node studio.mjs
```

Acceptance:

- real generated SKYVW ProductSpec artifact loads
- 8 local service contracts validate
- recording service exposes real declared facts
- legacy `LIVE_SHARE.reason` remains separate

### C. SKYVW web bit 2

```bash
cd skyvw-web
npm ci
node studio.mjs check
node scripts/export-studio.mjs
node studio.mjs doctor --product skyvw-web-logbook --pretty
node scripts/verify-studio.mjs
node studio.mjs
```

Acceptance:

- product compiler remains 0.3.52
- export succeeds
- exact source identity matches
- 7 service contracts validate
- graph remains `product-spec-graph`
- wrong-version simulation stays disabled

### D. Resolve AMUX old-base integration

Inspect #410 versus current master before trying to land #412.

#412 is the cleaner continuation layer. Preserve its work while resolving/retargeting the old #410 base.

### E. Resolve ai-dsl bit-2 review path

Inspect why #412 was closed.

Do not start with #413. First establish a clean review/merge path for branch:

```text
feat/studio-contracts-takeover-20260922
```

Then keep #413 stacked above it.

### F. CircleKit optional evidence

Checkout #277 branch only after bit 2 is sane.

```bash
cd circlekit/product-studio
npm ci
npm run verify
node ../studio.mjs help
```

Pay special attention to:

- `test-source.mjs`
- Kotlin parser / brace matching
- generated Kotlin alias resolution
- JUnit timestamp handling
- Vitest public reporter API
- exact model-digest correlation
- product-local kernel selection

### G. AMUX optional evidence

After the bit-2 branch is stable:

```bash
cd agentmux
node studio.mjs check
node studio.mjs laws   --product amux-link   --kernel-root android/audio-inbox/product-spec   --output test-results/link-laws.json
node scripts/verify-studio.mjs
```

Optional owner-selected Vitest run may add the reporter documented in CircleKit `EVIDENCE.md`.

JUnit import should consume an already produced real XML result. Studio must not start Gradle/JUnit itself.

### H. ai-dsl optional evidence

```bash
cd ai-dsl
node studio.mjs check
node scripts/export-studio.mjs
node studio.mjs laws   --product video-activity   --kernel-root ui   --output ui/test-results/activity-laws.json
node scripts/verify-studio.mjs
```

Acceptance includes 36 finite activity points and exact-model declaration laws.

### I. SKYVW native optional JUnit evidence

Only after a real native test owner has produced JUnit XML:

```bash
node studio.mjs junit   --input path/to/REAL-TEST.xml   --source-root app/src/test   --repository adelost/skydive-altimeter   --output test-results/skyvw-junit.json

node scripts/verify-studio-evidence.mjs
```

Do not invent timestamps/results.

## 8. Likely hotspots

Because the latest evidence layer was prepared but intentionally not executed, check these first:

1. syntax in `product-studio/lib/test-source.mjs`
2. Kotlin function/source matching
3. generated Kotlin aliases:
   - AMUX nested `GeneratedLinkNativeLegoCatalog.PortIds.X`
   - SKYVW `X_VALUE` plus `val X = X_VALUE`
4. Vitest 4 public reporter interfaces on the actually installed versions
5. JUnit XML timestamp/timezone shape from real Gradle output
6. source line matching for Kotlin backtick test names
7. `@covers` ambiguous/unknown diagnostics
8. raw ProductIr embedded `productSpecVersion` compatibility
9. `--kernel-root` lockfile validation
10. all-skipped declaration laws must never look like a successful proof
11. ai-dsl old/closed PR topology
12. AMUX #410 current-master conflict

## 9. What NOT to do

Do not:

- create GitHub CI
- create ProductSpec `tests: []`
- require `@covers` everywhere
- infer coverage from test names
- call source references coverage
- call unit/host evidence runtime proof
- copy WHAT/WHY onto every service instance
- add ProductSpec prose for ports/cells/bindings
- remove SKYVW `reason`
- upgrade product compiler pins for Studio
- run product applications from Studio
- make evidence mandatory to open Studio
- create a second contract grammar
- add product-name special cases to generic Studio code without unavoidable evidence

## 10. Definition of done

### Usable living documentation

Done when:

- CircleKit core passes local verification
- native SKYVW smoke passes
- SKYVW web export/smoke passes
- AMUX service check passes
- ai-dsl bit-2 review path is repaired and its export/smoke passes
- PR stack is clean/reviewable

Evidence PRs may remain deferred.

### Optional evidence done

Only call step 3 done after local owner-run verification shows:

- CircleKit evidence tests pass
- Vitest reporter works with real installed Vitest versions used by selected products
- JUnit importer works on a real result
- Kotlin generated IDs associate correctly
- declaration laws use the product's locked ProductSpec version
- exact-model law correlation works
- no false runtime/coverage labels appear in Studio

## 11. Source documents

Read together:

- `product-studio/LIVING-DOCUMENTATION.md`
- `product-studio/HANDOFF-LIVING-DOCUMENTATION.md`
- `product-studio/EVIDENCE.md`
- this file

This file is the current canonical takeover map if older files disagree on branch SHA or PR state.
