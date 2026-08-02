# Showcase release publication presentation

Source APK commit: `a0cbb1b334e387780e160ab2bcebad4cea07ac74`.
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
- Showcase is a same-repository laboratory and intentionally consumes
  `project(":releasekit")`. This adoption therefore uses the source published
  as CircleKit `0.3.19`; replacing it with its own Maven dependency would test
  different code from the repository under development.

## Pixel contract and result

The named `flow.update/available` fixture carries that fixed absolute instant.
Before inspection, each image was required to show `UPDATE FLOW`, the shared
`v0.4.0 AVAILABLE · TAP` projection, and a separate `PUBLISHED` row containing
`v0.4.0` plus device-local time. All requirements were checked against the
captured pixels:

- [`phone-responsive.png`](phone-responsive.png): 1080 × 2400 portrait;
  probe dump reported `PHONE_COMPACT`; the publication instant renders as
  `Aug 2, 2026, 7:33 AM` in the emulator's Europe/Stockholm zone and default
  English locale.
- [`phone-wide-rotated.png`](phone-wide-rotated.png): 2400 × 1080 after named
  `DEG_90`; probe dump reported `PHONE_WIDE`; version and identical local time
  remain visible without changing update state.
- [`phone-watch-exact-216.png`](phone-watch-exact-216.png): named
  `WATCH_EXACT` plus diameter `216`; probe dump reported `ROUND`; the same
  publication row fits the round preview and the AUTO exit remains visible.

Screenshot SHA-256 values, in the order above:

- `03516b11261a242e70c48d65e7864c78b1e4b42d3f86ee62313ec59e147c5a3a`
- `2e354b94c56f6eba3764bb4e41e621d3064cbb1c17212075e1160067b37dbb94`
- `93717f18df3616df59bea42434e61bf7f1014bf48411e7ae0d4a7eac9c1cfd56`

## Bounded checks

- `:releasekit:testDebugUnitTest`: shared UTC→New York/Tokyo, DST and null
  presentation tests pass.
- `:showcase-catalog:testDebugUnitTest`: real host-product mapping carries the
  absolute instant; Showcase wiring localizes a known instant and emits no
  date row for null.
- `:showcase-phone:compileDebugKotlin`, `:showcase-wear:compileDebugKotlin`,
  both debug APK assemblies, `scripts/check-file-length.sh`, and
  `git diff --check`: pass.

No polling, auto-update, download, installer, feed URL, workflow or hook was
changed.
