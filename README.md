# CircleKit

Shared Android foundations used by Skyvw and Agentmux Link.

- `designkit`: adaptive phone and round-Wear visual language.
- `ringkit`: spec-driven phone/watch screens and controls.
- `releasekit`: update state, download, APK verification and install flow.
- `releasekit-ui`: canonical ReleaseKit rows for Phone and round Wear hosts.
- `servicekit`: bounded telemetry used by the shared modules.
- `product-spec`: product-neutral TypeScript authoring, validation and output
  manifests, published as the versioned `@v1d/product-spec` npm tarball.
- `showcase-product`: CircleKit-owned, data-only Showcase ProductConfig. Its
  one generated descriptor drives both Android Showcase hosts.
- `circlekit-assets`: CircleKit-owned portable vector geometry, published as
  the separately referenced `@v1d/circlekit-assets` npm tarball.

Consumers pin released Maven artifacts. Product data and business logic stay
in their owning applications; CircleKit owns rendering and update mechanics.
TypeScript consumers pin the immutable product-spec tarball from the same
CircleKit version; every app declaration remains in its product's owning
repository.

The stable `com.adelost.*` package namespaces describe the five library
modules. Since `0.2.0`, shared types and functions use the product-neutral
`Circle`/`circle` prefix; product names, storage keys and business behavior
do not belong in CircleKit.

The non-published `showcase-catalog`, `showcase-phone`, and `showcase-wear`
modules form an installable component laboratory over the same source. Debug
builds expose named, side-effect-safe navigation through
`tools/showcase-probe.sh`; release builds do not register the probe receiver.
Regenerate or check its shared product descriptor with `npm run generate` or
`npm run check-generated` from `showcase-product/`. Those commands write,
check and log one ProductSpec output manifest containing the deterministic IR
JSON and typed Kotlin descriptor.

Build installable release hosts from one exact source revision with:

```bash
scripts/build-showcase-release.sh X.Y.Z
```

The command emits signed Phone/Wear APKs, SHA-256 digests and a provenance
report under `build/showcase-release/X.Y.Z/`. The showcase uses the stable
Android developer signer intentionally: it is a side-effect-free laboratory,
never a trusted product/update authority.
