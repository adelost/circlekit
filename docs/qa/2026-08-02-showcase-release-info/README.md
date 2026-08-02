# Showcase release publication presentation

Source APK commit: `dc987243f660a9918d1e97ebd8eb8eb1caedc8f7`.
All navigation used `tools/showcase-probe.sh`; no coordinate taps or fabricated
network response were used.

## Inventory

- Phone and Wear each instantiate the real shared `UpdateController` through
  `ShowcaseUpdateController`; auto-update, checking, download and install
  callbacks remain owned there.
- Their source is GitHub's raw Releases API at
  `https://api.github.com/repos/adelost/circlekit/releases`.
- The newest compatible release observed during QA was `v0.3.17`, with Phone
  and Wear APKs and source-owned `published_at=2026-08-02T05:33:20Z`.
- The separately publishable `releasekit-ui` module owns the exact UPDATE row,
  optional PUBLISHED row, icons, typed check/install action mapping, progress,
  failure colour, and locale/timezone boundary. Showcase consumes that module
  directly and has no local release-row adapter.
- Showcase is a same-repository laboratory and intentionally consumes project
  modules. Replacing them with Maven dependencies would test different code
  from the repository under development.

## Pixel contract and result

The named `flow.update/available` fixture carries that fixed absolute instant.
Before inspection, each image was required to show `UPDATE FLOW`, the shared
available update projection, and a separate `PUBLISHED` row containing
`v0.4.0` plus device-local time. All requirements were checked against the
captured pixels and the named probe surface dump:

- [`phone-responsive.png`](phone-responsive.png): 1080 × 2400 portrait;
  probe dump reported `PHONE_COMPACT`; the publication instant renders as
  `Aug 2, 2026, 7:33 AM` in the emulator's Europe/Stockholm zone and default
  English locale.
- [`phone-wide-rotated.png`](phone-wide-rotated.png): 2400 × 1080 after named
  `DEG_90`; probe dump reported `PHONE_WIDE`; version and identical local time
  remain visible without changing update state.
- [`phone-watch-exact-216.png`](phone-watch-exact-216.png): named
  `WATCH_EXACT` plus diameter `216`; probe dump reported `ROUND`; the narrow
  preview visibly ellipsizes the update detail as `v0.4.0 AVAIL…`, while the
  complete publication value wraps across two lines and AUTO remains visible.

Screenshot SHA-256 values, in the order above:

- `80e9672c2c2a78d6308e425466b77a03de9778324d6a98e45e65440b7866e7c5`
- `84d17954e0b6354edd8b0f25551ba451c13498b7ed89ab9e3bd49db00bf8c202`
- `37029576451f9b4cb4e7e1ffe2bac28b8eefb57c1f0a29ca14da864c6cdc0f4d`

## Bounded checks

- `:releasekit:testDebugUnitTest`: shared UTC→New York/Tokyo, DST and null
  presentation tests pass.
- `:releasekit-ui:testDebugUnitTest`: row structure, Download/Calendar icons,
  typed actions, progress, failure colour, New York/Tokyo localization and
  null-time omission pass.
- `:releasekit-ui:assembleRelease` and
  `:releasekit-ui:generatePomFileForReleasePublication`: the publishable AAR
  contains `ReleaseUpdateRowsKt`; its POM carries the releasekit/ringkit graph.
- `:showcase-catalog:testDebugUnitTest`: real host-product mapping carries the
  absolute instant and the shared rows are exposed in the deterministic flow.
- `:showcase-phone:compileDebugKotlin`, `:showcase-wear:compileDebugKotlin`,
  both debug APK assemblies, `scripts/check-file-length.sh`, and
  `scripts/check-adaptive-contract.sh`, `bash -n` for edited scripts, and
  `git diff --check`: pass.

No polling, auto-update, download, installer, feed URL, workflow or hook was
changed.
