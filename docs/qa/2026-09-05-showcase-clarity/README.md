# Showcase: useful examples, not a second product

Owner: skyvw:4. Requested by Mattias; independent read-only inventory by
showcase_ux_review at 7f2f08c; final clarity review f75c3d4: 9/10, no blockers.
Owner clarity rating: 9/10 for these demonstrated scenarios, not every possible host.

## Decisions

Keep all 15 cases / 79 scenarios: each exercises a distinct public atom,
layout or data edge. Remove three single-choice intermediate menus and all
duplicate ID subtitles. Explain purpose and expected result in the canonical
TypeScript catalog, consumed by generated Kotlin/JSON. No second copy map.

Actual APP UPDATE is separate from DATA / UPDATE DEMO. ReleaseKit owns real
checks, signature/hash/package checks, download and Android confirmation.
Its shared `ReleaseUpdatePort`/`releaseUpdateScreen` works on Phone and Wear;
Showcase's TypeScript release declaration supplies repository and artifact
names. The demo graph does not claim native updater runtime coverage.

DEV / STRUCTURE is a declared catalog drill-down, not a live graph. It
groups existing ports by owner and shows actual declared connections, with
scope/limitations visible. No new graph or diagnostics registry.

## Inventory and rationale

Scores are design judgements, not automated quality or safety claims.
V = usefulness; C = previous clarity. Retain all useful cases; remove only
unnecessary navigation and fake actions. Candidate clarity target is 9/10,
subject to the native lap and independent follow-up.

| Case | V/C before | Change |
|---|---:|---|
| Colors | 8/6 | Actual shared black/warm-white/muted roles plus palette samples |
| Geometry | 7/4 | Label calculated metrics; real viewport remains DEV/HOST |
| Icon actions | 8/4 | Static looks named; every live icon runs the demo toggle |
| Action rows | 9/7 | Explain timing; failure really starts failed |
| Choices | 9/7 | Units/day names, no meaningless A–G |
| Adjustment | 9/8 | Explain limits and intentional hold |
| Progress | 9/7 | Unknown vs measured; local step, never invented percent |
| Press lifecycle | 9/5 | Visible DEMO / NO AUDIO |
| Text | 9/7 | Purpose and length limit; local submission only |
| Capture waveform | 8/4 | Fixed sample explicitly a no-audio demonstration |
| Playback | 8/4 | Fixed position explicitly a no-audio demonstration |
| Page layouts | 9/5 | Correct source detail, real local use/clear/toggle/adjust |
| Data age | 9/6 | Retained data, age and error separate; next example during loading |
| Update demo | 9/3 | Visible simulation, next step outside disabled busy control |
| Work/cache | 7/4 | Local simulation, next step outside disabled busy control |
| Three one-case intermediate menus | 1/4 | Removed; no component deleted |
| Technical graph page | 6/2 | Honest catalog structure and connection drill-down |
| Real app updater | 10/6 | Root access; automatic vs manual install explained |

## Proof contract

Before accepting native screenshots, verify visible purpose rather than only
a successful navigation receipt: SOURCE list must show useful descriptions,
update demo must say no installation, real updater must show installed version
and actual feed outcome; structure must explain scope, media must say NO AUDIO.
One small Phone/Wear lap; no full suite, no UI matrix, no new test framework.

Icons: actual existing CircleKit Grid and Link geometry, black background,
warm-white action pigment. Phone/Wear share each product's launcher resource.
Vector preview was inspected and posted separately; it is not a native proof.

## Delivery

Link icon PR #329 merged 7e90c4a9862c554ae228ec2bf766782c28763f6d.
Released by the existing PTT owner with Link 1.2.12 / #330 / c212b7e008b6741dcbe45fab947c28abd0aaa016.
No parallel Link publisher or audio changes in this icon work.

## Native verification at f75c3d4

Existing Phone/Wear packages replaced without clearing data; no density,
font, location or other product changes. Candidate version 0.3.58, current
public feed 0.3.57 during this check; do not call the candidate already released.

- `wear-data.png`: actual 192 dp round view; readable short purpose and
  SOURCE OFF explanation. Further scenarios scroll; fonts not reduced.
- `phone-connections.png`: actual owner detail with READS FROM/SENDS TO,
  exact declared bindings. No runtime health or whole-app graph claim.
- `wear-update-demo.png`: SIMULATION / No download or installation is visible.
  Next lies below this crop; its actual callback is covered by the focused unit,
  not falsely attested by the picture. Production busy controls remain disabled.
- `wear-audio-demo.png`: DEMO / NO AUDIO is visible above the normal player.
- `phone-real-update.png`: real ReleaseKit response, AUTO-UPDATE ON, candidate
  installed version and distinct last public release date/version, plus real instructions.

Named routes: `menu 'DATA/DATA AGE'`,
`menu 'DEV/STRUCTURE/COMPONENTS/DATA/DATA AGE'`, `menu 'APP UPDATE'`,
`open flow.update downloading`, `open media.playback playing`.
The debug-only receiver invokes the normal launcher callbacks. The script
now quotes paths correctly through adb's second shell parsing layer.

The first native structure pass caught a real 17-entry launcher overflow;
that candidate screenshot showed the previous app and was rejected. The root
fix groups by existing catalog family (not ad hoc pagination), with one
existing integration test traversing every actual owner screen. The earlier
long watch intro and clipped real update status were also rejected and fixed.

After fresh-main rebase: ProductConfig 2/2 + generated check, focused Showcase
15/15 + ReleaseKit UI 5/5, Phone/Wear compileReleaseKotlin, debug APK packaging,
assets generation check and diff whitespace check PASS. No full suite or CI.
All touched handwritten files remain below 500 lines.

Release 0.3.58 publication/anonymous byte verification: PENDING.
