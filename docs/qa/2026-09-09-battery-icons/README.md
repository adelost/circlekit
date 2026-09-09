# Shared battery glyphs

Requested by Mattias for Skyvw's compact clock/battery status row. One shell,
five quarter-level fills, one portable source in `battery-icon-assets.ts`.
The existing asset generator emits both Android vectors and catalogue entries.
No application-local battery path or per-frame bitmap/decoder is added.

`battery-empty`, `battery-quarter`, `battery-half`, `battery-three-quarters`
and `battery-full` have the same silhouette. The native outline lookup derives
membership from the catalogue and only overrides authored variants, matching
the existing renderer's fallback. This also closes the pre-existing missing
`data` membership without inventing another outline design. Products still own
percent, unknown/charging state and colour; a filled icon is not a battery-life
estimate. An exact percent accompanies the coarse fill in the Skyvw design.

## Changed-source checks

`npm run check:designkit --prefix circlekit-assets`, `scripts/check-icon-catalog.sh`
and `./gradlew :designkit:testDebugUnitTest --tests com.adelost.designkit.ui.IconCatalogTest :designkit:compileReleaseKotlin --max-workers=2`.
Four catalogue cases pass. The initial run failed both catalogue parity and
the new battery membership case before the shared outline lookup correction.
Only this focused module was compiled/tested; no new CI/release wiring.

## Visual inspection

Actual portable path data rendered at 10/12/18-unit sizes and in enlarged form;
all share the same shell, fill stays inside it and the level increases upwards.
Synthetic 87/26/14 percent examples retain distinct shell/level/percent. The
preview is not an installed native Skyvw frame. Native adoption and layout
validation belong to the consuming status-row change.

Preview, command logs, source and publication receipt are attached through the
[release assets](https://github.com/adelost/circlekit/releases/tag/v0.3.64).
Before that immutable release exists, this is banked source only. The local
working archive is `~/lsrc/.artifacts/skyvw-status-colours-2026-09-09/`.
