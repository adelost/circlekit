# Living documentation takeover handoff

## Outcome

The implementation is intentionally split by owner:

- **CircleKit / Product Studio** owns generic service-intent discovery, AMUX grammar delegation, inspection metadata, the Intent & behavior UI, and bounded product-owned graph export.
- **SKYVW native** owns its local service comments, workspace selection and manual smoke.
- **SKYVW web** owns its local service comments, ProductSpec 0.3.52 graph export, workspace selection and manual smoke.
- **AMUX** remains the single WHAT/WHY wording grammar owner.

Do not add a second prose schema, test registry, product-name branch in Product Studio, or CI/release dependency just to finish this work.

## Branches and PR stack

Use these branches together until the stack lands:

| Repository | Branch | Relationship |
|---|---|---|
| `adelost/circlekit` | `feat/studio-contracts-takeover-20260922` | PR #276, stacked above Product Studio #275 |
| `adelost/skydive-altimeter` | `feat/studio-contracts-takeover-20260922` | continuation of the existing living-doc companion |
| `adelost/skyvw-web` | `feat/studio-contracts-takeover-20260922` | web companion |
| `adelost/agentmux` | `feat/studio-contracts-takeover-20260922` | grammar/wake-word companion |

The other agent's original branches were not force-pushed or rewritten.

## Expected sibling checkout

```text
work/
  circlekit/
  agentmux/
  skydive-altimeter/
  skyvw-web/
```

Install only the owners that need packages:

```bash
(cd circlekit/product-studio && npm ci)
(cd agentmux && npm ci)       # if not already installed
(cd skyvw-web && npm ci)      # needed only for the web graph export
```

Studio never installs these on startup.

## Native SKYVW manual smoke

From `skydive-altimeter`:

```bash
node studio.mjs check
node studio.mjs doctor --product skyvw --pretty
node scripts/verify-studio.mjs
node studio.mjs
```

The smoke must establish:

- the existing generated `appspec/generated/skyvw/skyvw.product.json` loads as ProductSpec IR,
- all eight local ProductSpec services have valid WHAT/WHY,
- `recording.foreground-ingestion` exposes its real `position` and `pressure` inputs plus declared runtime facts,
- `LIVE_SHARE.reason` remains a separate legacy reason and is not guessed into ProductSpec identity.

Do **not** add a SKYVW workflow merely for this smoke. The native repository explicitly keeps this as an owner-run check.

## SKYVW web manual smoke

From `skyvw-web`:

```bash
node studio.mjs check
node scripts/export-studio.mjs
node studio.mjs doctor --product skyvw-web-logbook --pretty
node scripts/verify-studio.mjs
node studio.mjs
```

The export must use the web repository's installed and locked ProductSpec **0.3.52**. It writes `generated/logbook.studio.json`, which is an ignored local inspection artifact.

The exported object is deliberately `product-spec-graph`, not full ProductIr. A newer Studio may inspect its real owners, ports and bindings, but it must not silently simulate it with a different ProductSpec evaluator.

## Known verified facts before final owner-run tests

The native takeover branch contains eight local documented `service()` declarations. The checked-in generated SKYVW artifact is ProductSpec schema 9 and contains the real `recording.foreground-ingestion` service with `position` and `pressure` inputs. The legacy app-service source still contains `LIVE_SHARE.reason`.

The web takeover branch contains seven documented service boundaries: logbook, details, people, sharing, devices, settings and manual editor. Replay remains presentation-only.

CircleKit's public core verification has already exercised the generic scanner, AMUX grammar integration and browser workbench. Private product execution remains deliberately owner-run.

## If something fails locally

Fix in this order:

1. **Missing module / package**: run the owning repo's normal locked install. Do not copy Studio's ProductSpec into the product.
2. **Compiler version mismatch**: keep the product pin. Inspection may be read-only. Do not upgrade the product to make Studio green.
3. **Stale generated native artifact**: regenerate through SKYVW's existing generator, then rerun the smoke.
4. **Web export missing relative source**: add the actual imported declaration to `scripts/export-studio.mjs`'s explicit source closure. Do not make the exporter crawl arbitrary imports.
5. **Contract warning/error**: change the adjacent WHAT/WHY or the shared AMUX grammar only when the wording rule itself is wrong. Do not add a second linter.
6. **Source identity mismatch**: regenerate the inspection. Never relabel stale prose as current intent.

## Intentionally deferred

These are not required for usable bit 2:

- automatic JUnit/Kotlin evidence import,
- generated-law reports,
- `@covers` / `@proof` annotations,
- automatic test-to-service coverage claims,
- live runtime observation.

If implemented later, keep them as optional evidence. A test result is not runtime proof, and a source reference is not executed coverage.

## Architectural invariants

- WHAT/WHY belongs to the **service type source**, not every instance.
- ProductSpec remains the source of declared ports, effects, ownership, lifecycle and bindings.
- `AppServiceDeclaration.reason` remains legacy/user-facing copy until an explicit migration proves identity.
- Product Studio does not execute product code while browsing.
- The explicit web exporter is a trusted authoring command and is separate from the read-only viewer.
- Product compiler pins remain authoritative.
