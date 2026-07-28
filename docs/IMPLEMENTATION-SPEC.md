# CircleKit extraction and product-neutral API contract

Status: the initial extraction is complete. CircleKit `0.2.0` replaced the
temporary Skyvw-prefixed shared API with the product-neutral
`Circle`/`circle` API. Historical product references below describe the source
and consumer requirements; they are not current library symbol names.

Owner: `skyvw:0`  
Reviewer: `skyvw:9`  
Wingman only: `lsrc:3`

## Outcome

Skyvw and Agentmux Link must consume one version-pinned Android foundation for:

1. the established adaptive phone/round-Wear visual language; and
2. the established Skyvw update workflow.

This is an extraction and replacement, not a redesign. The work is complete
only when both consumers build and run against the shared artifacts and the
superseded local copies are removed.

Target duration: two focused working days.

## Hard constraints

- One canonical source. No copied Kotlin source, sibling-path dependency,
  submodule, or consumer-local fork of shared behavior.
- Preserve the working Skyvw patterns. Do not invent a second UI dialect or a
  new updater architecture.
- Product state and business logic stay in each app.
- Keep the stable `com.adelost.*` package namespaces. Shared symbols use the
  `Circle`/`circle` prefix; production library code must contain no
  product-specific Skyvw identifiers.
- New or materially rewritten source files stay at or below 500 lines.
- Declarative data/spec inputs and callbacks are preferred over free
  composable slots.
- Never weaken Link's signed-manifest, expiry, package, version-code, digest,
  signer, host or redirect checks.
- No GitHub Actions workflow, no full test suite and no generic `test`/`ci`
  command. Use only named local tests, relevant module builds and manual
  device smoke.
- Tests are evidence, not the product. Add only tests that pin a real seam or
  previously reproduced failure.
- Rebase each consumer immediately before merge. Gate the exact rebased head
  locally, self-merge it, and report the pinned SHA.
- Maximum two active people: `skyvw:0` implements; `skyvw:9` reviews bounded
  seams. Do not create an orchestration swarm.

## Existing starting point

Public repository: `adelost/circlekit`

The initial extraction preserves Skyvw's current modules:

- `designkit`
- `ringkit`
- `releasekit`
- `servicekit`

The first public source commit is `9e38c98`. It already:

- builds Maven AAR publications under `io.v1d.circlekit`;
- lowers the shared libraries to `minSdk 26` for Link phone compatibility;
- makes the release source, product values and asset URL policy injectable;
- preserves exact-URL policy for Skyvw;
- provides host-and-path-prefix policy for Link, including redirects;
- persists release validity with a cached APK and checks it again before
  install;
- splits the only source file over 500 lines.

A Cloudflare Pages project named `circlekit` exists but no artifact has been
deployed. Treat the repository as a reviewed starting scaffold, not proof of
consumer completion.

## UI contract

Keep and reuse the established model, now exposed as product-neutral API:

- `CircleSurfaceClass`: `ROUND`, `PHONE_COMPACT`, `PHONE_WIDE`
- `resolveCircleSurfaceLayout(...)`
- canonical round canvas of 192 dp
- host scales the round canvas; atoms always remain at scale 1
- `RenderRingScreen(...)` as the single screen renderer
- `RingScreen`, `RowSpec`, action specs, state flows and callbacks as the
  public shape
- `circleHostClip()` as the only round-host clipping boundary
- Graphite tokens and round-safe geometry as the canonical visual language

Do not add a parallel slot/scaffold component system.

Link-specific conversation timeline, composer, PTT recorder and transport
remain Link-local. They should be rendered with CircleKit tokens, host
profiles, round-safe geometry and data specs. Add a shared row/action variant
only when both form factors need the same interaction. A new `RingScreen`
sealed case still requires the existing screen-case justification.

### Required UI replacement

In Agentmux Link:

- consume pinned CircleKit artifacts;
- delete `LinkVisualTokens` and copied color/shape constants;
- make phone and Wear use CircleKit's canonical tokens and host/surface rules;
- retain only thin product theme mapping and Link-specific screens.

In Skyvw:

- replace project-module dependencies with the same pinned artifacts;
- move source-contract checks that own CircleKit source into CircleKit;
- remove the extracted local module source in the same completed slice.

Do not leave a compiled local fallback. A hidden fallback recreates two
truths.

## Shared updater contract

Skyvw's current `UpdateController`, `UpdateState`, preferences, secure
downloader, local APK identity verifier and package-installer handoff are the
canonical engine.

Only these ports may vary by product:

```kotlin
data class ReleaseProduct(
    val id: String,
    val packageName: String,
    val cacheFileName: String,
    val userAgent: String,
    val telemetryServiceId: ServiceId,
    val assetUrlPolicy: AssetUrlPolicy,
    val isNewer: (ReleaseCandidate, currentName: String, currentCode: Int) -> Boolean,
)

fun interface ReleaseSource {
    fun fetchNewest(product: ReleaseProduct): ReleaseFetchResult
}
```

Skyvw uses its existing public GitHub-digest feed through a
`PublicReleaseSource` adapter and exact download-URL policy.

Link keeps its existing Ed25519 signed-manifest parser as an app-local
`ReleaseSource` adapter. It maps the verified manifest to the shared
`ReleaseCandidate` and uses an HTTPS host plus path-prefix policy for every
initial URL and redirect.

The shared candidate/persisted ready state must carry Link's:

- `versionCode`
- `versionName`
- APK URL
- byte size
- SHA-256
- changelog
- `expiresAt`

Expiry is checked when metadata is accepted, when a cached APK is restored and
immediately before installer handoff. An expired cached APK is deleted and
never installed.

The local APK verifier remains authoritative for actual package name,
version name/code and signer. Manifest verification never replaces local APK
verification.

### Required updater deletion

After Link is wired to the shared engine, remove its duplicated:

- update controller/state policy;
- APK downloader/hash loop;
- APK identity verifier;
- package-installer handoff and receiver;
- ready-update persistence.

Keep only the signed-manifest/canonical-JSON adapter, product descriptor and a
small presentation mapper if needed.

## Artifact and development model

- Publish immutable Maven artifacts with
  `scripts/publish-maven.sh X.Y.Z`. The publisher stages the complete remote
  repository plus the new version before deploying, so a Pages snapshot can
  never make older pinned coordinates disappear.
- Default consumer repository: `https://circlekit.pages.dev/`.
- Pin an exact CircleKit version in both consumers.
- A local Maven repository override may be used while developing, but it must
  be explicit and the committed default must resolve without a sibling
  checkout.
- Do not introduce GitHub Actions or JitPack.
- Publish CircleKit before consumer merges. Never merge a consumer that points
  at an artifact that is not already retrievable.

## Merge order

1. CircleKit: finish the two ports, focused gates, publish one immutable
   version and verify its AAR/POM URLs.
2. Skyvw: consume that exact version, remove its extracted local modules,
   run the relevant builds/smoke, rebase and self-merge.
3. Agentmux Link: consume the same exact version, delete UI/update copies,
   run the relevant builds/smoke, rebase and self-merge.
4. Install fresh APKs and perform the physical checks below.

If an unavoidable CircleKit correction is found, publish a new version. Never
replace bytes under an existing version.

## Bounded verification

CircleKit:

- named URL-policy tests: exact pin, Link prefix, hostile host and redirect;
- named release-selection/expiry-cache tests;
- named surface/profile/round-safe tests touched by the extraction;
- build and publish only the four library modules.

Skyvw:

- compile the app against the remote artifact;
- run only tests directly covering update state and surface selection;
- manually open one phone and one round-Wear screen;
- manually prove an existing update N to N+1 still downloads, verifies and
  reaches Android confirmation.

Agentmux Link:

- compile phone and Wear against the remote artifact;
- run only signed-manifest and update mapping tests plus directly touched UI
  policy tests;
- manually verify phone PTT/timeline and the Wear round surface;
- manually prove a signed update N to N+1 rejects expiry/tampering and accepts
  the valid release.

Do not run a full repository suite “for confidence”.

## Completion evidence

Report:

- CircleKit source SHA, version and retrievable Maven URLs;
- Skyvw merge SHA and exact CircleKit version;
- Agentmux merge SHA and exact CircleKit version;
- deleted duplicate files and net production-line change per consumer;
- exact named tests/build tasks and duration;
- phone and Wear manual observations;
- updater N to N+1 proof for both products;
- confirmation that no GitHub CI/full suite ran.

Any missing consumer switch, undeleted copy, unpublished artifact or untested
physical update means the extraction is not done.
