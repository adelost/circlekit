# CircleKit Showcase on Garmin

The `garmin-limited-ui` artifact is part of the same Showcase ProductConfig as
Android and Apple. Its renderer, entry screen and surface select a one-component
ROUND tree. The Monkey C emitter reads that tree, its first declared scenario,
the artifact-scoped icon ref and the optional ProductSpec palette directly from
the compiled ProductIr. An empty product palette explicitly inherits the shared
CircleKit style.

The plugin only attests what the native proof can render: ROUND, the progress
component and the download icon. Moving the artifact to an unsupported tree or
removing its icon binding fails generation instead of silently selecting local
fallback data. The segmented ring, primitive glyph and Garmin colour
quantisation remain native level-2 approximations.

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
- Product artifact/screen/surface/component/scenario/palette/icon identities
  survive unchanged, while colour quantisation and glyph geometry remain native
  renderer concerns. This validates level-2 semantic parity, not pixel parity.
- The local mirrored device definition lacks its system font files, so the
  proof uses a tiny native 5x7 renderer. This is a spike constraint, not a new
  ProductSpec feature.
- Garmin's authenticated SDK Manager is still required for an official device
  package and reproducible release provenance. No CIQ Store release is made.
- Sensors, navigation, persistence, input and live state are intentionally out
  of scope. Missing renderer capability fails during generation.
