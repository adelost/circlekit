# Product Studio 0.3: static-review record

Date: 2026-09-21. Base PR head: `fa75a2c7b3d3563c3cb6f3d19a752fc694204718`.

**No code execution in this pass.** The user explicitly requested implementation without running the code. No npm install, Node invocation, compiler, application, test suite, browser or live product was run. The new tests below are authored acceptance cases, not passing results. No 9/10 or 10/10 runtime-quality score is asserted.

## What changed

Q0-Q5 have source implementations: headless loading with explicit product selection; inspect/query/source/simulate/scenario/trace commands; one JSON envelope and defined exit statuses; bounded file input/output; pagination; existing Workbench reuse and model preconditions. No dependency version, ProductSpec semantics, product runtime, user session, permission or deployment was changed. The local unpublished tool version is 0.3.0.

Static review also identified and addressed:

- `path.reverse()` caused the old missing-ancestor flag to inspect the selected event instead of the oldest retained ancestor.
- Empty/malformed `expect` objects could be counted as successful assertions, and an empty scenario could bypass runnable/initial-state validation.
- Missing recorded outcome fields could be presented as a contradiction instead of unknown evidence.
- Matching source IDs could relink an old model to changed source without matching its exported digest.
- Grouped architecture views could reintroduce edges excluded by a focused query.
- Duplicate manifest IDs could replace an earlier project silently.

Each has regression source. These are code-review findings, not reproduced runtime incidents in this pass. To claim a tested fix, run the applicable regression on the previous implementation, observe the named symptom, then run it on this revision.

## Static verification scope

Read the actual PR metadata, relevant branch files and existing tests. Local source copies were compared to current Git blob identities before modification. Review covered imports/exports, call signatures, command-specific options, output/exit behavior, identity boundaries, read-only ownership, existing GUI call paths and documentation examples. Publication checks compare committed file identities and the intended diff. File identity and source review do not prove correctness of runtime behavior.

Node's official v22 file-system reference was consulted for bounded descriptor reads and optional `O_NONBLOCK`; availability differs by platform. The implementation retains regular-file checks and uses the nonblocking flag only when defined. Reference: https://nodejs.org/docs/latest-v22.x/api/fs.html#file-open-constants

## Required runtime checks by the next owner

```bash
npm ci
npm run test:cli
npm run verify
node bin/studio.mjs inspect --examples --product workflow-example --pretty
npm start
# In another terminal:
python test/browser.py --url http://127.0.0.1:4317
python test/browser_extended.py
```

Then attach two actual products through the same core, verify a known path and policy result, test a wrong model/evaluator identity, inspect a real short trace and preserve normal source-edit/build ownership. Do not make a private compiler harness or the previous HTTP-driver bridge the release runtime. Keep PR #274 draft until normal install and direct-browser proof exists.

---

# Historical evidence for earlier revisions only

The following record predates 0.3. Its test counts and environmental limitations are retained as history; none is a claim that this revision has run successfully.

# Verification boundary: Product Studio 0.2

Date: 2026-09-21. Scope: the `product-studio/` application, not all of CircleKit or an installed product.

## Source baseline

Implementation began at PR #274 head `db013d1fa1e1c90b8b659f18a6b3d5c96031da52`, package subtree `998a6ed6563fcc445a4f5864155ec54c50c2ba33`. Main was rechecked at `464f432fab90947c26b0e170c0ed6014504b654d`. Only the development tool directory changed.

The current package manifest still pins published ProductSpec **0.3.65** and TypeScript **5.9.3** with the existing lock integrity values. Version 0.2.0 names this tool's changes, not a published npm release or a new ProductSpec version.

## Actual local results

| Check | Result | Environment / limitation |
| --- | --- | --- |
| Pure architecture, inspection and trace tests | **24 passed**, no skips | Actual new pure modules on Node 22.16.0; no compiler harness or TypeScript dependency needed. |
| Entire Node suite plus module syntax checks | **112 passed**, no skips | Node 22.16.0, TypeScript 5.8.3 and the separate temporary source-check harness described below. Not a locked-release package integration test. |
| Existing real-app browser journeys | **28 assertions passed**, 0 JavaScript errors | Exact UI modules plus actual HTTP server via explicit test-driver bridge. |
| Added architecture/source/trace journeys | **20 assertions passed**, 0 JavaScript errors | Same bridge; generic synthetic compiled bundle and passive synthetic trace, not a connected native app. |
| Direct browser navigation | **Blocked** | Managed Chromium returned `ERR_BLOCKED_BY_ADMINISTRATOR` for localhost. No administrator policy was changed. |
| Clean locked install | **Blocked / unverified** | DNS could not resolve package hosts; offline install returned `ENOTCACHED`. |

The 24 pure tests are a subset of the 112, not additional tests to inflate the count. Browser checks are assertions, not 48 independent test processes. Four widths were checked: 1600, 1024, 720 and 390 CSS pixels. This is not a full accessibility, native-renderer, or every-view responsive audit.

The added browser path checks generic bundle attachment; exact binding path; exported groups; node-to-source span; source gutter and retained draft; exact-model trace import; compatible finite-logic comparison; explicit causal path; backward trace navigation; table-region split -> valid source -> independent candidate -> original output under the new cell; scenario save/reopen; unasserted-run labeling; and no page overflow in the tested extended view.

Architecture, source and trace screenshots were captured from the implemented UI and visually inspected. They are synthetic fixtures, not screenshots of running SKYVW or the video editor.

## Material package limitation

Container DNS prevented access to npm and the CircleKit release host. A clean `npm ci` could not be proved. An offline attempt failed because the pinned package tarballs were not cached.

For provisional application checks, a separate temporary source-check harness supplied table/machine/family behavior derived from the reviewed CircleKit `464f432` sources. It identified itself as **`0.3.65-source-check`**, not the published release. Available TypeScript was **5.8.3**, not the pinned **5.9.3**. This harness is neither the whole package nor a substitute release artifact.

The harness, symlinks and `node_modules` are excluded from the commit and archive. Shipped code imports `@v1d/product-spec` normally; no alternative semantic kernel or fallback evaluator is included. Passing provisional tests does not settle exports, dependency packaging or differences in the real locked versions.

## Material browser limitation

Managed Chromium blocked direct localhost navigation. `--http-bridge` ran the same UI JS/CSS/HTML bytes in-memory and forwarded only relative Studio API requests through the test driver to the real local server. It did not test browser enforcement of module loading/CSP over ordinary HTTP.

Separate Node HTTP tests exercised Host/Origin/session-token checks, restrictive response headers, malformed inputs and absent arbitrary-command/file endpoints. Those checks do not erase the missing normal-browser end-to-end test. Both checked-in browser runners default to the normal direct route for the next environment.

## Red/green evidence and honest scope

This pass recorded failing cases before corrections for:

- A path to one port incorrectly accepting a path ending at another port on the same owner.
- A rejected trace event consuming a sequence number and creating imaginary dropped history.
- A GUI scope caption displaying an uninterpolated template expression.
- Native source being labelled as TypeScript syntax failure instead of explicit unsupported-language indexing with usable exported positions.
- Producer diagnostics being discarded by the inspection view.
- Current source validation using a saved model's compatible version despite a different consumer package pin.

These cases passed after the specific corrections. Other new tests are feature-contract checks, not fabricated historical incidents. Scenario immutable publication/concurrent saves, unknown facets, stale source maps, exact model identity and ambiguous source location cases are covered as such.

Existing baseline tests still check declared holes/overlaps and protected AMUX outcomes, source draft persistence, mock matching, source conflicts, local HTTP boundaries and opt-in Git draft refs without modifying HEAD/index/worktree.

## Required next checks before calling this release-ready

```bash
cd product-studio
npm ci
npm run verify
npm start
# Separate terminal, Python Playwright installed:
python test/browser.py --url http://127.0.0.1:4317
python test/browser_extended.py
```

Then attach one real generated full product and a second product's standalone logic bundle. Verify actual package provenance, source maps, UI navigation and any owned trace hooks at those product boundaries. No private product loading, production job, device preview, media-document mutation, GPU operation or live-runtime adapter was exercised by this pass.

Keep PR #274 in draft until the clean install and direct-browser path have passed. Follow HANDOFF.md rather than treating this tool's feature list as evidence that all product integrations are complete.
