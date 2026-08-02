# Host preview and release parity

Status: active cross-repository execution contract (CircleKit → Skyvw →
Agentmux Link). This file owns the shared vocabulary and proof checklist; each
product keeps only its native wiring and release evidence.

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

- [ ] `HP-A01` Inventory current Skyvw/Showcase/Link seams and record reused
  versus replaced ownership.
- [ ] `HP-A02` Add the closed host-mode, watch-diameter and DEV-orientation
  vocabulary plus one shared host surface; keep bounds-derived classing in
  `resolveCircleSurfaceLayout`.
- [ ] `HP-A03` Prove compact/wide derivation, state/navigation identity across
  host switches, Wear override rejection and ROUND rotation invariance.
- [ ] `HP-A04` Mount the shared DEV control from Showcase's main menu; default
  DEV ON; prove fullSensor plus deterministic 0/90/180/270.
- [ ] `HP-A05` Add real ReleaseKit Phone+Wear update controllers alongside the
  existing deterministic update fixture; default AUTO-UPDATE ON.
- [ ] `HP-A06` Build both signed Showcase APKs from one SHA with identical
  `versionName`, host-specific monotonic codes and verified manifests/signers.
- [ ] `HP-A07` Pixel-proof Phone portrait/landscape/WatchExact 216/400 and real
  Wear; prove the same named menu reflows through `MenuGridSpec`.
- [ ] `HP-A08` Merge CircleKit PR, publish immutable `0.3.13` Maven artifacts,
  verify HTTP 200/provenance, then publish GitHub Showcase release and feeds.

### B — Skyvw adoption and release

- [ ] `HP-B01` Pin published CircleKit and replace local frame/metrics policy
  with the shared seam without changing product state/navigation/flight logic.
- [ ] `HP-B02` Keep only Responsive/WatchExact in DEV, expose shared presets and
  0/90/180/270 while preserving Skyvw's manual orientation policy.
- [ ] `HP-B03` Prove Phone portrait/landscape/216/400, Wear smoke, same-state
  host switch and Compact/Wide menu reflow through named QA.
- [ ] `HP-B04` Publish equal-version Phone/Wear APK assets from the same Skyvw
  release SHA; verify updater feed and remove visible 0.3.0/0.5.x skew.

### C — Agentmux Link adoption and release

- [ ] `HP-C01` Pin published CircleKit in every Android module; no local UI or
  updater implementation.
- [ ] `HP-C02` Mount one shared Link state/navigation tree through Responsive or
  WatchExact on Phone; Wear remains WatchExact; DEV is main-menu reachable and
  defaults ON.
- [ ] `HP-C03` Enable system/fullSensor plus shared deterministic orientation;
  prove Phone portrait/landscape/216/400 and real Wear with named QA.
- [ ] `HP-C04` Align Phone/Wear `versionName`, keep monotonic channel codes,
  publish both signed APKs and verify each ReleaseKit feed/manifest.

### D — terminal attestation

- [ ] `HP-D01` Record CircleKit/Skyvw/Link PRs, SHAs, rollback SHAs, Maven URL,
  GitHub releases, direct Phone/Wear APK links, hashes and updater-feed proof.
- [ ] `HP-D02` Confirm no workflows/hooks/gates/full suite were added, no stale
  WIP was ported, and every worktree/feature branch is cleaned after delivery.

