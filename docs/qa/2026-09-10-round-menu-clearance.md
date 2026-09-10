# Round status and choice rows

The real round renderer must reserve its chrome before measuring content.
STATUS uses the existing chrome-aware grid with full-sized reading atoms,
not a separate three-column shrink rule. Details use the same stable reading
band for hero, supporting copy and actions. Long declared choice identities
retain `RowSpec.multiline` through both host renderers. Directional readings
can rotate their catalog icon without rotating the text or touch target.

## Bounded evidence

- `RingRowLogicTest` + `CircleGridPolicyTest`: 19 cases; release Kotlin and
  self-targeted Android test APK compile.
- Existing `RingRowAccessibilityTest` on Phone5556: 5/5 in 6.399s, including
  real 192dp STATUS → PRESSURE and a long finite-choice row. Mutations that
  discard multiline and remove hero clearance both fail (2/2 in 2.936s).
- The first captures included Android's test-Activity title bar; rejected.
  With a product-like chrome-free test window the same two renderers pass
  2/2 in 3.443s and their actual pixels show X clearance and full choice text.
- Pressure's combined number/unit wraps as two large lines. This is not an
  overlap, but the app consumer should present the unit as supporting copy;
  these library pictures are not a completed Skyvw pressure-page claim.
- All fixture values are synthetic. No product APK, data, density, font or
  location was changed. The RingKit test package was removed. No physical
  watch, sensor, calibration, TalkBack traversal or full-menu certification.

Commands and original PNG/logs are retained in
`~/lsrc/.artifacts/skyvw-menu-function-audit-2026-09-10/shared/`.
The bounded proof archive is attached to the
[0.3.67 release](https://github.com/adelost/circlekit/releases/tag/v0.3.67)
as `round-menu-clearance-proof.tar.gz` after publication. It contains no
user photographs, locations or saved records. Skyvw adoption is a separate
consumer commit after its canonical writer handover.

## Direction follow-up (0.3.68)

Skyvw's actual menu proof found that opening a rotated reading as INFO reset
its arrow to upright. `CircleActionCue.iconRotationDeg` now carries the same
finite presentation value from the existing row into both cue renderers;
native host adapters must preserve it. No direction or weather is calculated
by the framework. Ordinary cues keep zero rotation by default.

Existing `RingRowAccessibilityTest.directionIsPreservedWhenTheReadingOpensInformation`
uses the actual passive row → named INFO pointer → shared disclosure, asserts
the published rotation and captures its pixels. One Wear192dp synthetic case
passed in 1.835s: FROM270° shows a right-facing arrow. The first test harness
recreated its navigator during observation; that failed run is not evidence.
The corrected harness observes only the explicit information publication.
No product app/data/settings were modified by this self-targeted test.

Proof is in the existing private archive's `shared/direction/`, attached as
`menu-direction-proof.tar.gz` to the
[0.3.68 release](https://github.com/adelost/circlekit/releases/tag/v0.3.68).
