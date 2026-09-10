# Reading pigment stays with its value

`RowSpec.semanticColor` already declares explicit product pigment. A passive
row previously applied it only to the icon, leaving the actual reading grey;
its INFO cue then lost the pigment entirely. That creates different visual
meaning for the same reading depending on where it is opened.

Keep the same optional pigment on passive value text and carry it through
`CircleActionCue` into the existing explanation icon/value. Labels remain
neutral. Ordinary action subtitles, confirmation state colours and default
rows retain their prior policy. No product palette or wind threshold belongs
in this shared module; applications supply the resolved semantic colour.
Custom native cue adapters must preserve the new optional field.

## Focused proof

- Existing CircleActionCueTest10 and RingActionCueHostTest6 pass; release
  Kotlin and Android test packaging compile. No new test file or test suite.
- Existing RingRowAccessibilityTest direction case now checks actual value
  pixels before and after named INFO, plus the preserved direction/pigment.
  Compiling mutation restoring grey value text fails the exact pigment
  assertion; restored production passes1/1 in2.038s on Phone5556 with the
  shared192dp round host. The first no-hierarchy capture is a rejected test
  timing attempt; the test now waits for its real row, not a fixed sleep.
- The picture uses explicit synthetic Magenta, **not any product's wind
  palette**. Neutral120m label, coloured8m/s and right arrow,FROM270° visible.
  This proves shared rendering, not the downstream Skyvw palette adoption.
- Only the self-targeted test APK was installed/removed. Existing Skyvw APK,
  density and font were read before/after and unchanged. No user settings,
  location, data, other apps or Wear state modified. Phone released explicitly.

Raw evidence is preserved privately at
`~/lsrc/.artifacts/skyvw-menu-function-audit-2026-09-10/colour/` and the
`reading-colour-proof.tar.gz` attachment on the release/PR terminal receipt.
No binary evidence in source, no physical-device or all-app UX claim.
