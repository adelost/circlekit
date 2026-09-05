# Showcase: useful examples, not a second product

Owner: skyvw:4. Requested by Mattias; independent read-only inventory by
showcase_ux_review at 7f2f08c. Native proof and release receipt pending below.

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

Showcase native screenshots, focused checks and publication: PENDING.
