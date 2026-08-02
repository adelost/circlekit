# Host preview and updater proof

All captures below were inspected against the declared pixel truth before they
were committed. They come from the real CircleKit Showcase surfaces; there is
no preview-only renderer and no coordinate-tap script.

## Host-preview pixels

- `showcase-phone-responsive-0-compact.png`: Responsive at 0°, portrait bounds,
  `PHONE_COMPACT`, one-column menu.
- `showcase-phone-responsive-90-wide.png`: the same menu and state at 90°,
  landscape bounds, `PHONE_WIDE`, capacity-derived two-column reflow.
- `showcase-phone-watch-exact-216-rotated-90.png`: WatchExact 216 remains round
  and single-column at 90°; it never fabricates a Phone Wide surface.
- `showcase-phone-watch-exact-400.png`: the same Watch surface and navigation at
  400 dp with an always-reachable `AUTO` return to Responsive.
- `showcase-wear-watch-exact.png`: the actual Wear product is round WatchExact
  and exposes no meaningless Phone layout choice.

The shared contract is `RESPONSIVE | WATCH_EXACT`; 0/180 resolve to Compact and
90/270 to Wide only when the live Phone bounds change. Menu columns and
capacity come from `CircleSurfaceClass` plus `MenuGridSpec`/`MenuGridRole`.

## ReleaseKit proof

The first real signed updater run exposed a root bug: Showcase mounted the
ReleaseKit controller but its Phone and Wear manifests lacked Android's
`INTERNET` permission. PR
[#34](https://github.com/adelost/circlekit/pull/34) fixed the manifests and made
the release builder verify that permission in every output APK.

`phone-updater-detected.png` and `wear-updater-detected.png` show the actual
signed `0.3.16` apps reading the public GitHub release feed and reporting
`v0.3.17 READY · TAP`. Both then installed through ReleaseKit and Android's
package installer without uninstall or clear. After updater-driven restart,
`phone-updater-after.png` and `wear-updater-after.png` show
`v0.3.17 · UP TO DATE · TAP`.

Semantic UiAutomator selected the named DEV/UPDATE row and Android's named
confirmation control. The host-preview QA used the product's named host and
orientation seams. No raw coordinate taps were used.

## Exact CircleKit artifacts

- Source: `de3e20c93a35f82d6f058f92ca2056a279da3733`; rollback:
  `21a3ca42da5f1f84e33e75444000ed40d6aeec61`.
- Release: [v0.3.17](https://github.com/adelost/circlekit/releases/tag/v0.3.17).
- [Phone APK](https://github.com/adelost/circlekit/releases/download/v0.3.17/circlekit-showcase-phone-v0.3.17.apk):
  version `0.3.17` (`30171`), size `6,357,081`, SHA-256
  `1988bfa516ebbfc82477b9f44a8923d978bde928928651d3ae139e69a1589987`.
- [Wear APK](https://github.com/adelost/circlekit/releases/download/v0.3.17/circlekit-showcase-wear-v0.3.17.apk):
  version `0.3.17` (`30172`), size `6,477,303`, SHA-256
  `8f0023c01936cf02293a15d702b92c215d32e7f4814548df6e00fbe99782bda7`.
- Both APKs share signer certificate SHA-256
  `ef51d7e088897d2175c331404b54c69a05ba9f3d4e90cb394a82b5231fbf099f`.
- The live updater feed is the public
  [CircleKit releases API](https://api.github.com/repos/adelost/circlekit/releases).
- Immutable Maven artifacts returned HTTP 200 for
  [designkit](https://circlekit.pages.dev/io/v1d/circlekit/designkit/0.3.17/designkit-0.3.17.aar),
  [ringkit](https://circlekit.pages.dev/io/v1d/circlekit/ringkit/0.3.17/ringkit-0.3.17.aar),
  [releasekit](https://circlekit.pages.dev/io/v1d/circlekit/releasekit/0.3.17/releasekit-0.3.17.aar), and
  [servicekit](https://circlekit.pages.dev/io/v1d/circlekit/servicekit/0.3.17/servicekit-0.3.17.aar).
