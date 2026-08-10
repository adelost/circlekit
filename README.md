# CircleKit

Shared Android foundations used by Skyvw and Agentmux Link.

- `designkit`: adaptive phone and round-Wear visual language.
- `ringkit`: spec-driven phone/watch screens and controls.
- `releasekit`: update state, download, APK verification and install flow.
- `releasekit-ui`: canonical ReleaseKit rows for Phone and round Wear hosts.
- `servicekit`: bounded telemetry used by the shared modules.
- `product-spec`: product-neutral TypeScript authoring, validation and output
  manifests, published as the versioned `@v1d/product-spec` npm tarball.
- `product-emit`: deterministic ProductSpec emitters with separate
  product-neutral `/core` and skydiving `/skydiving` entrypoints.
- `showcase-product`: CircleKit-owned, data-only Showcase ProductConfig. Its
  one generated descriptor drives both Android Showcase hosts.
- `circlekit-assets`: CircleKit-owned portable vector geometry, published as
  the separately referenced `@v1d/circlekit-assets` npm tarball.

Consumers pin released Maven artifacts. Product data and business logic stay
in their owning applications; CircleKit owns rendering and update mechanics.
TypeScript consumers pin an immutable `@v1d/product-spec` version on its own
semver axis; every app declaration remains in its product's owning repository.
`@v1d/circlekit-assets` follows the Maven/design-system axis because its paths
are consumed by DesignKit. ProductSpec does not.

## Local-first publication

Both release axes publish cumulative snapshots to the same Pages project, so
neither command may remove historical npm or Maven payloads:

```bash
# Pure TypeScript: tests and packs ProductSpec; never invokes Gradle or AAR publication.
scripts/publish-product-spec.sh X.Y.Z --prepare-only
scripts/publish-product-spec.sh X.Y.Z

# TypeScript emitters only; never invokes Gradle or AAR publication.
scripts/publish-product-emit.sh X.Y.Z --prepare-only
scripts/publish-product-emit.sh X.Y.Z

# Android/design-system axis: publishes the five AARs plus circlekit-assets.
scripts/publish-maven.sh X.Y.Z --prepare-only
scripts/publish-maven.sh X.Y.Z
```

Each command requires a clean tracked worktree and an exact matching version
in only the package it owns. `--prepare-only` reconstructs and checksum-verifies
the complete remote snapshot without deploying it. It also permits an already
published version only when a freshly packed tarball is byte-identical, which
is the safe smoke path when no new release is warranted.

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
