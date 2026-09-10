# Shared activity pictograms

Mattias requested recognizable tag icons rather than repeated books in Skyvw.
Eleven geometry-only additions live in `circlekit-assets/src/activity-icon-assets.ts`:
tag, ram-air, canopy-carry, tandem, wingsuit, tracking, canopy-swoop, formation,
camera, balloon and helicopter. The existing generator emits native vectors
and catalogue membership. No product-local path copy or icon renderer is added.

Ram-air family shares its wing geometry; canopy-carry depicts two separate
people while tandem depicts two offset seated bodies. These are pictograms,
not technique diagrams or proof of what happened in a recording. Labels must
remain beside small images, especially where silhouettes are closely related.
Products continue to own classification, confidence, correction and colour.

## References and inspection

[ParaMag's account and original photographs](https://paramag.fr/histoire-dune-100-couve/)
establish the Mr. Bill reference: two people under one canopy, with the carried
jumper equipped separately. We do not reproduce the photo or imply the icon
teaches the maneuver. [USPA's canopy formation description](https://www.uspa.org/sim/5-5)
also reinforces why proximity of two canopies is not the same pictogram.

The actual portable vector paths were rendered through the shared test Chrome
with `agent-browser shot`, at 72, 24, 18 and 12 px. Console clean. Inspected:
tag hole remains open; canopy silhouettes distinguish single/carry/tandem;
formation has four inward heads; balloon has basket/neck; helicopter has
rotor/cockpit/skids; camera has lens. Labels retained at every scale.

The image was posted with `amux image` to the
[private proof channel](https://discord.com/channels/1478157994939387957/1502949110725218385),
10 September 2026, caption “Första gemensamma vektorikonsetet”. Working evidence:
`~/lsrc/.artifacts/skyvw-mr-bill-2026-09-10/icon-sheet.png` and `icon-preview.mjs`.
This is a vector preview, not an installed native application screenshot.
Skyvw native adoption is verified separately in its feature PR.

## Bounded checks and release

`npm run check:designkit --prefix circlekit-assets`,
`scripts/check-icon-catalog.sh`, and
`./gradlew :designkit:testDebugUnitTest --tests '*IconCatalogTest' :designkit:compileReleaseKotlin --max-workers=2`.
Five catalogue tests pass: uniqueness, native/outline parity and membership,
including all eleven additions. Changed strict lint is clean after placing the
generated class's WHAT/WHY contract in the generator itself.

Immutable Maven/assets release: 0.3.70 through the existing cumulative publisher.
Public byte verification/source receipt belongs to the PR once publishing has
completed; source being merged alone is not a publication claim.
