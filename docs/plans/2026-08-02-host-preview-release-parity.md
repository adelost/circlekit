# Host preview and release parity

Status: terminally delivered across CircleKit → Skyvw → Agentmux Link. This
file owns the shared vocabulary and proof checklist; each product keeps only
its native wiring and release evidence.

## Product contract

- `RESPONSIVE` and `WATCH_EXACT` are the only user-visible Phone host modes.
  `PHONE_COMPACT` and `PHONE_WIDE` remain derived `CircleSurfaceClass` values,
  never product choices.
- Responsive resolves from real bounds: portrait/narrow → `PHONE_COMPACT`,
  landscape/wide → `PHONE_WIDE`. Products do not duplicate this threshold or
  branch their state, navigation or callbacks.
- WatchExact mounts the same product surface as Wear inside one round exact
  viewport. Phone exposes `AUTO`, 192, 216, 240, 280, 320, 360 and 400 dp.
  `AUTO` is the always-reachable return to Responsive.
- Wear is always WatchExact and never shows a meaningless host-mode choice.
- The shared DEV host control exposes 0/90/180/270. On a Phone responsive
  viewport, 0/180 produce portrait/Compact and 90/270 produce landscape/Wide
  by changing actual bounds. A round WatchExact/Wear viewport remains ROUND at
  every rotation.
- Menu capacity comes only from `CircleSurfaceClass` plus
  `MenuGridSpec`/`MenuGridRole`; no product hard-codes orientation names,
  columns or capacity.
- DEV and AUTO-UPDATE default ON during the current development phase.
- A coordinated product release gives Phone and Wear the same visible
  `versionName`. Their package/channel identity and monotonic `versionCode`
  remain host-specific where required.
- CircleKit provides host composition and ReleaseKit. Product state,
  navigation and callbacks remain native. No runtime JSON, second renderer,
  local updater or stale-WIP port is allowed.

## Pixels that count as proof

For every Phone product, one named scenario must visibly show:

1. Responsive portrait with a `PHONE_COMPACT` menu;
2. the same state/navigation after rotation to Responsive landscape with a
   `PHONE_WIDE` menu and shared capacity-derived reflow;
3. WatchExact at 216 dp with round clipping and an obvious AUTO exit;
4. WatchExact at 400 dp with the same content/state scaled, not reauthored.

Wear proof must show the real Wear entry screen as ROUND. Rotation may move
content/chrome but must never produce a two-column Phone layout. Each capture
is inspected against this list before upload; QA invokes names/debug bridges,
never raw coordinates.

## Execution checklist

Evidence format for a completed row: owner, source SHA/PR, direct artifact or
Maven URL, targeted tests and named visual proof. A checked box without those
facts is invalid.

### A — CircleKit API, Showcase, Maven and GitHub release

- [x] `HP-A01` Inventory current Skyvw/Showcase/Link seams and record reused
  versus replaced ownership.
- [x] `HP-A02` Add the closed host-mode, watch-diameter and DEV-orientation
  vocabulary plus one shared host surface; keep bounds-derived classing in
  `resolveCircleSurfaceLayout`.
- [x] `HP-A03` Prove compact/wide derivation, state/navigation identity across
  host switches, Wear override rejection and ROUND rotation invariance.
- [x] `HP-A04` Mount the shared DEV control from Showcase's main menu; default
  DEV ON; prove fullSensor plus deterministic 0/90/180/270.
- [x] `HP-A05` Add real ReleaseKit Phone+Wear update controllers alongside the
  existing deterministic update fixture; default AUTO-UPDATE ON.
- [x] `HP-A06` Build both signed Showcase APKs from one SHA with identical
  `versionName`, host-specific monotonic codes and verified manifests/signers.
- [x] `HP-A07` Pixel-proof Phone portrait/landscape/WatchExact 216/400 and real
  Wear; prove the same named menu reflows through `MenuGridSpec`.
- [x] `HP-A08` Merge CircleKit PRs, publish immutable `0.3.17` Maven artifacts,
  verify HTTP 200/provenance, then publish GitHub Showcase release and feeds.

### B — Skyvw adoption and release

- [x] `HP-B01` Pin published CircleKit and replace local frame/metrics policy
  with the shared seam without changing product state/navigation/flight logic.
- [x] `HP-B02` Keep only Responsive/WatchExact in DEV, expose shared presets and
  0/90/180/270 while preserving Skyvw's manual orientation policy.
- [x] `HP-B03` Prove Phone portrait/landscape/216/400, Wear smoke, same-state
  host switch and Compact/Wide menu reflow through named QA.
- [x] `HP-B04` Publish equal-version Phone/Wear APK assets from the same Skyvw
  release SHA; verify updater feed and remove visible 0.3.0/0.5.x skew.

### C — Agentmux Link adoption and release

- [x] `HP-C01` Pin published CircleKit in every Android module; no local UI or
  updater implementation.
- [x] `HP-C02` Mount one shared Link state/navigation tree through Responsive or
  WatchExact on Phone; Wear remains WatchExact; DEV is main-menu reachable and
  defaults ON.
- [x] `HP-C03` Enable system/fullSensor plus shared deterministic orientation;
  prove Phone portrait/landscape/216/400 and real Wear with named QA.
- [x] `HP-C04` Align Phone/Wear `versionName`, keep monotonic channel codes,
  publish both signed APKs and verify each ReleaseKit feed/manifest.

### D — terminal attestation

- [x] `HP-D01` Record CircleKit/Skyvw/Link PRs, SHAs, rollback SHAs, Maven URL,
  GitHub releases, direct Phone/Wear APK links, hashes and updater-feed proof.
- [x] `HP-D02` Confirm no workflows/hooks/gates/full suite were added, no stale
  WIP was ported, and every worktree/feature branch is cleaned after delivery.

## Terminal delivery matrix

### CircleKit / Showcase

- PRs [#30](https://github.com/adelost/circlekit/pull/30),
  [#31](https://github.com/adelost/circlekit/pull/31),
  [#32](https://github.com/adelost/circlekit/pull/32),
  [#33](https://github.com/adelost/circlekit/pull/33), and
  [#34](https://github.com/adelost/circlekit/pull/34) culminate in source
  `de3e20c93a35f82d6f058f92ca2056a279da3733`; rollback is
  `21a3ca42da5f1f84e33e75444000ed40d6aeec61`.
- Final release: [v0.3.17](https://github.com/adelost/circlekit/releases/tag/v0.3.17),
  with direct [Phone](https://github.com/adelost/circlekit/releases/download/v0.3.17/circlekit-showcase-phone-v0.3.17.apk)
  and [Wear](https://github.com/adelost/circlekit/releases/download/v0.3.17/circlekit-showcase-wear-v0.3.17.apk)
  APKs from the same SHA and visible version. The actual signed `0.3.16` →
  `0.3.17` ReleaseKit upgrade is recorded in
  `docs/qa/2026-08-02-host-preview-release-parity/`.
- Maven 0.3.17 provenance was fetched with HTTP 200 for `designkit`, `ringkit`,
  `releasekit`, and `servicekit` from `https://circlekit.pages.dev/`.

### Skyvw

- Product PR [#626](https://github.com/adelost/skydive-altimeter/pull/626)
  merged as `c1811bc008676f3ea43ac9bd6a00b90751061575`; final CircleKit pin PR
  [#628](https://github.com/adelost/skydive-altimeter/pull/628) merged as
  `f8cd1823b7a1cf6e56516fdd96bf7b20e6f55a8c`; rollback is
  `b28c4797dd8a2db5bd361c447762095e2485f5d2`.
- Final auto-release: [v0.5.681](https://github.com/adelost/skydive-altimeter/releases/tag/v0.5.681),
  source `8eb289a6472c76d595aa18113b7fe0dff2019acf`, direct
  [Phone](https://github.com/adelost/skydive-altimeter/releases/download/v0.5.681/skyvw-mobile-v0.5.681.apk)
  and [Wear](https://github.com/adelost/skydive-altimeter/releases/download/v0.5.681/skydive-altimeter-v0.5.681.apk)
  assets. Both are `0.5.681`, byte-identical, size `7,058,457`, SHA-256
  `9a33d24de8afb810366becfc9f98c4b674820f9cbf8489838357d697d91d1ced`.
- The live [Skyvw feed](https://sky.v1d.io/downloads/releases.json) names both
  channel assets and the same version/hash.

### Agentmux Link

- Product PR [#249](https://github.com/adelost/agentmux/pull/249) merged as
  `5aca7246a20ff376da26b3633eac53844fc84968`; final CircleKit pin/release PR
  [#251](https://github.com/adelost/agentmux/pull/251) merged as
  `2cb3a8ea5e8282d991d2a392da3ad2b4f9b4e9e4`; rollback is
  `2143b051ccea29bfae5e77f95691f31f07c873f9`.
- Final release: [agentmux-link-v1.2.1](https://github.com/adelost/agentmux/releases/tag/agentmux-link-v1.2.1),
  direct [Phone](https://github.com/adelost/agentmux/releases/download/agentmux-link-v1.2.1/Agentmux-Link-Phone-1.2.1.apk)
  and [Wear](https://github.com/adelost/agentmux/releases/download/agentmux-link-v1.2.1/Agentmux-Link-Wear-1.2.1.apk)
  assets. Both expose `1.2.1`; codes are Phone `9`, Wear `7`.
- The signed public [Phone](https://link.v1d.io/releases/agentmux-link/phone/manifest-v1.json)
  and [Wear](https://link.v1d.io/releases/agentmux-link/wear/manifest-v1.json)
  feeds point to immutable [phone code 9](https://link.v1d.io/releases/agentmux-link/phone/app-9.apk)
  and [wear code 7](https://link.v1d.io/releases/agentmux-link/wear/app-7.apk).
  The actual signed `1.2.0` → `1.2.1` updater/restart proof is committed in the
  Link repository's host-preview QA directory.

No GitHub workflow, Gradle/release gate, hook, alternate renderer, local updater,
or full-suite dependency was added. Only focused unit/compile/manual named QA
was used; the first real Showcase updater run found and fixed the missing
network permission before terminal attestation.
