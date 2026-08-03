# CircleKit Showcase Garmin checkpoint

This is a **non-mergeable SVW-0087 checkpoint**. It proves that the Connect IQ
compiler, simulator and native limited renderer work, but the current emitter
still selects `section.controls`, `control.progress`, `half` and `sea-glass`
locally. It therefore does not yet prove that a declared Showcase artifact
drives Garmin from the same ProductConfig.

The current ProductSpec `ArtifactProfile` declares renderer references and
capabilities, while `ProductUiEntry` declares artifact and port references.
Neither owns a screen/component/surface/scenario/palette selection, and a
component family is not bound to an artifact. Until that product-owned
selection exists, moving the Showcase config cannot move the Garmin output
without editing `emit-monkeyc.ts`.

The renderer checkpoint still establishes the intended platform boundary: a
segmented ring, primitive glyphs and Garmin MIP colours are native concerns.
The final emitter must only attest renderer capabilities and read every
selection reference from the compiled artifact.

## Local smoke

```sh
npm --prefix showcase-product run generate
monkeyc -d fenix7pro -f showcase-garmin/monkey.jungle \
  -o showcase-garmin/bin/circlekit-showcase.prg \
  -y "$CONNECTIQ_DEVELOPER_KEY" --build-stats 0
connectiq
monkeydo showcase-garmin/bin/circlekit-showcase.prg fenix7pro
```

## Spike findings

- Monkey C can consume generated constants and render a native approximation;
  it does not execute the TypeScript DSL or load JSON at runtime.
- Product component/scenario/palette/icon identities survive unchanged, while
  colour quantisation and glyph geometry remain native renderer concerns.
- The current product IR carries semantic palette and icon references, not a
  portable raster/vector payload. This proof therefore validates level-2
  semantic parity, not pixel parity.
- The local mirrored device definition lacks its system font files, so the
  proof uses a tiny native 5x7 renderer. This is a spike constraint, not a new
  ProductSpec feature.
- Garmin's authenticated SDK Manager is still required for an official device
  package and reproducible release provenance. No CIQ Store release is made.
- Sensors, navigation, persistence, input and live state are intentionally out
  of scope. Missing renderer capability fails during generation.
