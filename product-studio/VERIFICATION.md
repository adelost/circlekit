# Product Studio 0.4: verification record

Date: 2026-09-22. Base: PR #274 at `740d3c3a7b33c55f4ebb07de0d05215b73c147fd`.

## Evidence from this pass

- Read the current PR, relevant source and existing acceptance tests before editing.
- Matched the mounted 0.3 source archive against the repository's Git tree before modification.
- Reviewed snapshot/overlay ownership, source identities, lazy API requests, event-listener lifetime, graph camera retention, build adoption, drafts and navigation.
- Parsed JavaScript syntax with `node --check`, which does not execute module bodies. Parsed Python test-file syntax separately. These are syntax checks, not tests or type checking.
- Checked relative module paths, unchanged dependency versions and matching package/lock versions.
- Submission verification compares Git blob/tree identities against the intended source and delivery archive. A matching hash proves bytes, not behavior.

**Not run:** npm installation, the application, ProductSpec compilation, unit tests, browser journeys, benchmarks, native products, real devices, agents or providers. There are no new passing-test counts, frame-rate measurements, screenshots or quality scores to report.

## Authored acceptance work

`test/snapshot-experience.test.mjs` adds 12 test declarations for snapshot reuse, frozen data, lazy content, revision checks, trace paging, search, model comparison, stable file observation, invalid-build retention, route decoding and draft protection.

`test/browser_experience.py` covers ordinary direct-browser camera retention, navigation, source access, command search and saved views. Existing browser entrypoints reject the legacy flattened HTTP bridge for this modular UI. They have not been run here.

`scripts/profile.mjs` supplies synthetic 100/1000-owner graphs and records three build/query samples plus memory and platform information. It has not been run and is not a release gate.

## Code-review findings addressed

- View queries repeatedly reconstructed model/provenance data and mutated facet wrappers. Those derived objects are now built once per loaded project and frozen.
- Full view responses included source and trace payloads not needed for initial inspection. New summary/detail/page paths separate them.
- Retained UI nodes would accumulate listeners without cleanup; bindings now use one abortable registration scope.
- Graph recreation reset its camera; selection-only changes now update the existing graph, with explicit layout actions.
- Invalid/partially written bundles could replace usable views without a candidate phase. Reload now validates before publication and retains one previous build.
- Saved-but-unapplied source proposals and pending scenarios must not be treated as disposable merely because they are not the current edit tab.
- Future/foreign routes, stale async replies and trace-page indices must not silently navigate to a different object or observation.

These are static-review findings with code changes and targeted acceptance source, not reproduced-and-fixed runtime incidents. Run a symptom case against the previous version before claiming a proven fix.

## Required next-owner checks

```bash
npm ci
npm run verify
npm run profile
npm start
# Separate terminal:
python test/browser.py
python test/browser_experience.py
python test/browser_extended.py
```

Then attach two actual products and test the negative paths in HANDOFF and EXPERIENCE. Verify actual installed ProductSpec 0.3.65 and TypeScript 5.9.3; no alternative compiler harness is shipped. Keep the PR draft until normal installation and direct-browser evidence exists.

## Historical results

Earlier verification records remain in Git history on PR #274. Version 0.2 used a temporary source-check harness and an HTTP-driver browser bridge; 0.3 was statically reviewed without execution. Neither establishes runtime correctness of 0.4. Do not copy those historical passing counts into this release's report.
