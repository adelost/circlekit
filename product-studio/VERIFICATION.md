# Verification boundary

Date: 2026-09-21. This record concerns `product-studio/`, not the whole CircleKit repository or an installed product.

## What was checked

- Source reviewed against CircleKit `464f432fab90947c26b0e170c0ed6014504b654d` and the Product Studio handoff in PR #273.
- New application code is isolated to `product-studio/`. No product source, dependency pin outside this directory, runtime, queue, user session, permission or deployment was changed.
- Package manifest/lock pin ProductSpec 0.3.65 and TypeScript 5.9.3. Integrity values were read from existing consumer locks, not fabricated.
- Automated Node tests cover real expected outcomes, refusals, static source handling, draft persistence, API boundaries and Git operations in freshly created temporary test repositories.
- Browser checks exercise the actual application modules and server, including stepping, unknown guards, policy evaluation, source edits, validation, draft switching, candidate creation, patch export, mocks, catalog inspection and responsive layout.
- Source/fixture publication review: only public AMUX/Showcase excerpts and newly authored synthetic examples are included. No private SKYVW/video source or media is copied into this public package. Local presets read those checkouts only when supplied by the operator.

## Material environment limitations

Container DNS prevented access to npm and the CircleKit release host. Consequently, a clean install of the declared lockfile was **not verified**.

Local tests used Node 22.16.0, the available TypeScript 5.8.3, and a separate temporary source-extraction harness for the table/machine/family functions reviewed at CircleKit `464f432`. This was not the released `@v1d/product-spec` tarball. It supports provisional checks of the adapters and workflows, not an assertion that the published package integration is tested. The temporary harness and all node_modules links are excluded from the commit and source archive. Production code imports `@v1d/product-spec` normally and has no fallback evaluator.

The installed Chromium blocked direct localhost navigation with an administrator-policy error. Browser tests therefore used `--http-bridge`: the same UI module bytes ran in-memory, while their API requests were carried by the test driver to the actual running HTTP server. This is not a replacement for a direct-browser CSP/module-loading test on the user's machine. HTTP Host, Origin, session-token, CSP response headers and route refusals were separately exercised by Node HTTP tests. No administrator policy was disabled.

## Results

At the implementation checkpoint: **65 Node tests passed**, none skipped, and **28 browser assertions passed**, with **0 JavaScript runtime errors**. The browser run covered 1600, 1024, 720 and 390 CSS-pixel widths without document-level horizontal overflow in Logic view. This is not a complete accessibility or all-view responsive audit.

Several checks were written and observed failing before the corresponding correction: order-independent mock matching; ambiguous mocks; an ignored top-level source mutation; invalid-source correction; snapshot unknown/duplicate identities; corrupted local draft reuse; and tablet overflow. New Git-draft functionality also had failing acceptance tests before implementation. Two bad test assumptions were corrected rather than weakening implementation: removing a state's only incoming transition must fail; Node fetch did not send the intended custom Host header, so that test now uses a raw HTTP client.

The app's optional Git tests proved: HEAD, normal index and working source unchanged; only a new draft branch holds the changed file; duplicate save returns the same commit; absent authorization, invalid source and changed source refuse.

## Required next checks on a normal development machine

```bash
cd product-studio
npm ci
npm run verify
npm start
# In another terminal, with Playwright installed:
python test/browser.py --url http://127.0.0.1:4317
```

Then attach the actual products one at a time. Check their installed pins, current source/artifact identities, registered preview/transport seams and normal build paths. Full private product loading, native rendering, media editing, GPU work, live runtime connection and whole-product code generation were not exercised here and are not claimed as delivered.

Do not upgrade this evidence to “all integrations passed” because the viewer displays their names, an example compiles or a package installation command exits. Record the actual consumer path and independent outcome.
