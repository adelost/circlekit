# Product Studio 0.4: experience and performance slice

Base: PR #274, commit `740d3c3a7b33c55f4ebb07de0d05215b73c147fd`.
This is a separate, stacked implementation PR. Merge or integrate the base first.
All changes remain under `product-studio/`; ProductSpec, product runtimes and dependency versions are unchanged.

**Verification:** source/identity review and JavaScript parse-only checks. No application, package installation, compiler, unit test, browser journey or performance benchmark was run. New tests are acceptance source, not passing results. No 8/10 or 9/10 runtime score is claimed.

## First useful session

```bash
cd product-studio
npm ci
npm run verify
npm start -- /path/to/your/product
```

Open the printed local address. A real attached project opens its overview, not an unrelated sample. With no workspace, labelled examples remain available. Start with `Commands` or `Ctrl+Shift+P`; search for an object, open its source or focus its neighbors. `More views` contains Overview, saved views, local links and Compare. Problems names diagnostics and missing provenance separately.

A typical external-agent workflow:

1. Inspect the current generated model and its source.
2. Let the agent change ordinary source and run the product's existing generator.
3. With `Follow builds` enabled, Studio observes declared files. It never starts that generator.
4. After two stable observations of a changed bundle, Studio can adopt it only when correlation/diagnostics pass and no local source/scenario draft is pending.
5. Selection is retained where IDs still exist; run results are cleared. Compare shows the prior loaded model against the new one.

Source-only changes show `waiting for the product owner to regenerate`; changed workspace selection requires restart. Invalid/partially-written bundles do not replace a usable snapshot. A saved-but-unapplied draft also blocks automatic adoption. Open it as a candidate, export it, or undo it back to its source before replacing the view.

## Checklist against the requested 22 improvements

“Implemented” below means code exists, not that runtime acceptance has passed.

| # | Requested improvement | Delivered / boundary |
|---|---|---|
| 1 | Immutable model snapshot | Implemented: one cached, deeply frozen model/provenance graph per loaded project object. Trace/evidence overlays do not rebuild it. |
| 2 | Lazy API | Implemented for source text, entity details, catalogs and trace pages. Initial summaries still include compiled finite facets and a lightweight entity index; fully paged model loading is deferred. |
| 3 | Avoid full DOM replacement | Implemented keyed incremental DOM patching with retained controls and managed graph islands. Existing string-template construction remains; no framework rewrite. |
| 4 | Stable viewport/focus | Implemented retained graph instances, validated camera/layout storage, zoom anchored to pointer, fit-to-content, keyboard node movement and input focus retention. Cross-file cursor restoration still needs user testing. |
| 5 | Watch generated builds | Implemented active-client bounded polling, coalesced scans, two stable observations, candidate validation and draft protection. No daemon, recursive watcher or build executor. |
| 6 | Compare models | Implemented prior-load or explicitly selected loaded-model comparison keyed by semantic identities. No automatic Git checkout or affected-test inference. |
| 7 | Back/forward | Implemented browser history with model, selection, source and trace identity. |
| 8 | Deep links | Implemented local identity-only links. Different model/trace revisions warn rather than silently replaying another event. |
| 9 | Command palette | Implemented keyboard entry, local actions and indexed entity/source search. No AI call or arbitrary command text execution. |
| 10 | Progressive disclosure | Implemented overview, selected-entity loading, collapsed raw properties and More views menu. Existing advanced forms remain. |
| 11 | Distinct modes | Implemented explicit textual modes plus subtle declared/simulation/recorded/candidate accents. Color is not the only signal. |
| 12 | Debugger timeline | Implemented paged event browser, sequence lanes, exact absolute event indices and causal navigation. Lanes are not proportional time or live debugging. |
| 13 | Trace privacy | Existing bounded-summary/no-raw-payload contract retained. Links/bookmarks contain no source text, facts or capture payload. No redaction guarantee for producer-supplied text. |
| 14 | Performance budgets | Added synthetic 100/1000-owner profile script and structural acceptance checks. Timing targets below are proposals until measured, not claimed results. |
| 15 | Search index | Implemented private per-snapshot token/substring index; no second model registry. |
| 16 | Intentional auto-layout | Implemented explicit Arrange action and fit; selections do not rearrange the graph. No ELK dependency or guarantee of optimal large-graph layout. |
| 17 | Focus mode | Implemented bounded two-level upstream/downstream focus using existing query semantics. Hidden scope is explicit. |
| 18 | Bookmarks | Implemented versioned, bounded local saved views with exact-model warnings; unavailable IDs are not replaced by guesses. |
| 19 | Problems view | Implemented diagnostic/source navigation plus separately labelled missing provenance. Disconnected runtime is not a warning about a broken port. |
| 20 | Semantic quick fixes | Existing source/transition/split-region commands retained. Problems can navigate to real source; automatic policy/deadline invention is intentionally not added. |
| 21 | Proof strip | Implemented source/declaration/model/scenario/runtime scope indicators. Candidate edits do not inherit old scenario/runtime passes. |
| 22 | First five minutes | Implemented real-product overview, detected capabilities and command entry; original examples still demonstrate finite logic. One-command product detection remains manifest/preset based. |

## Core changes

`lib/snapshot.mjs` owns freezing, the search index, compact transport projections and identity-keyed model comparisons. `Workbench.view()` reuses the snapshot and decorates it with current observations. Indexing computes a source digest once rather than once per literal/field. Graph dependency indexes are cached only for frozen inputs.

`lib/changes.mjs` observes the selected workspace's declared input set on active-client requests. Metadata changes trigger content hashing. It also observes known missing inputs such as a manifest created after startup. Reads are coalesced and cached for two seconds. The browser requests a scan roughly every three seconds while visible and idle. This favors WSL/virtualized-file-system reliability without creating a watcher daemon. Metadata observation is not a filesystem security guarantee; source writes still use their own content/revision checks.

`public/dom.js` updates keyed elements and leaves managed SVG islands intact. Existing render bindings use an abortable registration scope to prevent duplicate listeners on retained nodes. `graph.js` redraws only a moved node and its incident edges once per animation frame. The passive trace recorder now uses a ring buffer rather than shifting its entire retained array for each new event.

`public/experience.js` contains navigation, command discovery, view bookmarks, passive build refresh and focused status pages. It cannot write source, run shell commands or start product work. The existing source/draft owner is unchanged.

## API additions

All read operations require the same existing local-session token and project/view identity:

- `GET /api/project?id=...&mode=summary`: compact initial transport; legacy full response remains compatible.
- `POST /api/source`: exact attached source file/digest, no arbitrary path reader.
- `POST /api/entity`: selected entity details and direct relations.
- `POST /api/interface`: catalog/mount/evidence details when opened.
- `POST /api/search`: bounded entity/source index query.
- `POST /api/changes`: passive observation of declared inputs.
- `POST /api/compare`: previous loaded model or an explicit already-loaded comparison source.
- `POST /api/trace-page`: at most 600 events; GUI requests 200, with absolute cursor indices.
- `POST /api/trace-export`: explicit exact-trace export, not automatic payload transfer.

The initial finite-facet payload is not fully lazy. Artifact scopes/catalogs and large source/trace content no longer need to accompany every view request. A full transport response over 40 MB is refused; source attachment is bounded to 32 MB per project. These limits are tool resource policy, not DSL semantics.

## Acceptance checks for the next model

```bash
npm run verify
npm run profile
npm start
# Another terminal, ordinary Playwright installation:
python test/browser.py
python test/browser_experience.py
python test/browser_extended.py
```

The historical flattened HTTP-bridge browser harness is rejected for this modular UI. Use ordinary browser loading; do not bypass a browser administration policy or count injected modules as a direct-path pass.

New unit contracts cover snapshot reuse/immutability; compact/lazy content; exact revision refusal; indexed search; trace page indices; model comparison; stable build observation; invalid generated output retention; route validation; and protection of saved-but-unapplied drafts. New browser acceptance covers retained graph identity/camera, navigation, lazy source, command search and saved views.

Then test the failure paths deliberately: edit while a reload is in flight; switch products before an entity/source request resolves; replace a bundle with invalid JSON; change the manifest; reopen a link with the wrong trace; import a 20,000-event capture; and visit a foreign inspect-only facet. Check the original model and draft are never silently replaced or relabelled.

### Proposed measurements, not promised performance

On one recorded reference machine and locked package set, record three cold loads and at least 20 warm interactions. Suggested targets are warm focused query p95 below 100 ms, input response below 100 ms, and no long graph redraw on selection. Inspect p95 and payload bytes; do not reduce tests or silently trim evidence to hit a target. `npm run profile` reports synthetic build/query medians and memory but does not gate release or verify browser frame rate.

## Deliberately not done

No Svelte/Lit/React rewrite, new DSL, package publication, active runtime connection, native/media preview, product build executor, general quick-fix policy engine or authenticated trace transport. Full graph virtualization, general dependency-closure discovery, full IDE language service and automatic source-schema migrations remain separate measured investments. Old exact model/evidence identities are never aliased by guesswork.

External references used for implementation choices: [Node file-watching caveats](https://nodejs.org/download/release/v22.16.0/docs/api/fs.html#caveats), [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), and [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API). These justify mechanisms, not claims that this implementation has run.
