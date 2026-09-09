# Touch feedback and information

CircleKit base3d61eee, tests-only baselinead63467, production checkpointf0b477f
plus the closeable renderer extraction in this change. Product consumer adoption
is explicitly separate; this is not an installed Skyvw fix.

Two real defects reproduced on the handed-over Phone emulator5556 using only
the self-targeted test packages:

| Existing native case | Before | Corrected |
| --- | --- | --- |
| Accepted pointer feedback | missing TextHandleMove,1/1 red | safe-tap class8/8 |
| INFO pointer→explanation→CLOSE | explanation absent under deliberate timing,1/1 red | readable-cue class2/2 |
| Confirmation hold / ON–OFF | existing hold test extended | hold class4/4 |

The INFO regression invokes the named ABOUT AUDIO target and exercises both
IMMEDIATE and DELIBERATE. It checks the full explanation after recomposition,
closes it, and proves no setting change. The feedback probes inject the existing
Compose HapticFeedback port; they prove requests and suppression, NOT physical
vibration. Altitude, hard-deck and vario policy are outside this library/UI seam.

## Reproduce

Build `:designkit:assembleDebugAndroidTest :ringkit:assembleDebugAndroidTest`.
Install those two self-targeted APKs on an explicitly handed-over device, then:

```sh
adb -s emulator-5556 shell am instrument -w -r \
  -e class com.adelost.designkit.ui.CircleSafeTapAccessibilityTest \
  com.adelost.designkit.test/androidx.test.runner.AndroidJUnitRunner
adb -s emulator-5556 shell am instrument -w -r \
  -e class com.adelost.ringkit.ui.ReadableActionCueTest,com.adelost.ringkit.ui.HoldFillBoxAccessibilityTest \
  com.adelost.ringkit.test/androidx.test.runner.AndroidJUnitRunner
```

Targeted JVM: CircleActionCueTest10, CircleTapSafetyTest7,
RingActionCueHostTest6; all23 green. Release Kotlin compilation and existing
assets generation check also pass. No broad suite/CI or layout matrix.

The API/WHY contract is in [README](../../../README.md#touch-feedback-and-information).
An instrument host must honor `event.updateOnly` by owner identity and may
reuse RingActionExplanation; otherwise it can still overwrite the answer.
The app setting gates touch acknowledgement, not its independently owned alarms.

Raw logs and baseline APKs are retained in the private artifact archive
`/home/adelost/lsrc/.artifacts/circlekit-touch-feedback-2026-09-09/`.
[PR162](https://github.com/adelost/circlekit/pull/162) carries the exact source and
outcome receipt. Fresh-main source7a92cee: native8/8 in7.920s plus6/6 in6.752s;
both isolated test packages removed and absence read back. No user image, GPS
trace or existing app data is in this change.
