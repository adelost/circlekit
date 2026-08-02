# Release publication time

Status: terminally published in CircleKit `0.3.19`. Product adoptions remain
separate features.

## Shared contract

- GitHub Releases `published_at` is the source. It is parsed as RFC 3339 and
  carried as the absolute `publishedAtEpochMillis: Long?`; no build, download,
  install or current-clock time is substituted.
- GitHub permits explicit `null`, while Skyvw's sanitized release feed currently
  omits the field. Both mean unknown and preserve the existing update flow. A
  present malformed value fails that remote catalog closed.
- `ReleaseInfo` owns the common `versionName` display field and raw publication
  instant. `ReleaseCandidate`, every release-bearing `UpdateState`, and
  `UpdateRowModel` expose that same identity without formatting it.
- `releaseInfoPresentation` is the only presentation atom. It accepts injected
  `ZoneId` and `Locale`, defaulting to the device values. A null instant produces
  a null label, so hosts omit only the date row.
- `UpToDate` does not expose a release instant: installed-version time is not
  necessarily the remote release publication time.
- Download, verification, polling, auto-update and installer behavior are
  unchanged; persistence only gains the optional raw epoch value.

The upstream schema evidence is GitHub's REST OpenAPI release schema, where
`published_at` is a nullable `date-time` field:
https://github.com/github/rest-api-description.

## CircleKit publication

- PR [#37](https://github.com/adelost/circlekit/pull/37) was reviewed at exact
  feature SHA `0c6e767871ba74bc18880ef4174a17168d2d3661`: Codex 9.6/10 GO and
  Kimi 9.5/10 GO.
- It merged as `1e2bf7373617ba75faf33555379f77ad3cb2b7af`; rollback source SHA is
  `65768e590f3499e08398530dad3cff52cb83f9c5`.
- Immutable Maven version `0.3.19` was published from that exact merge SHA in
  Cloudflare Pages deployment
  [`ca9e84e6`](https://ca9e84e6.circlekit.pages.dev). Stable coordinates are
  served from `https://circlekit.pages.dev/io/v1d/circlekit/`.
- The remote AAR, POM and Gradle module metadata for `designkit`, `ringkit`,
  `releasekit` and `servicekit` match between the deployment and stable URLs.
  Every new payload and `maven-metadata.xml` passed MD5, SHA-1, SHA-256 and
  SHA-512 verification; metadata names `0.3.19` exactly once as latest/release.
- Published AAR SHA-256 values: designkit
  `7acb142c209f5be418da11fd646e2edb4049bd84821860f5a87419a86cb17af6`,
  ringkit `b7c7a5b4b2a1a9a02a07f2508b1ccf51249b917bd17cf20b3a0ee5da6df596ae`,
  releasekit `9a73ff1488f82d209b19e7ac0cb355f9fb2954c4ab945bc2c5e567f70137588f`,
  servicekit `90b8ae819c71caba2c9c34deb545cc15f9da43985e4772e3aaae65baeceb9c3b`.

## Separate product adoptions

### Showcase

- Raw GitHub Releases already supplies `published_at`; pin the reviewed
  ReleaseKit artifact and render `UpdateRowModel.releaseInfo` through the shared
  presentation atom on Phone and Wear.
- Give deterministic updater fixtures fixed epochs and replace the duplicated
  `ShowcaseDevScreens.updateLabel` presentation path with the shared row model.

### Skyvw

- Pin the reviewed artifact and remove the duplicate updater row model in
  `SystemSettingsRows.kt`; Phone and Wear render shared `releaseInfo`.
- The current `https://sky.v1d.io/downloads/releases.json` omits
  `published_at`. Its feed producer must copy GitHub's value in a separate
  product/release-tooling change before a date can appear. Until then the date
  row is omitted and update behavior remains identical.

### Agentmux Link

- Map the signed-manifest value in `LinkRelease.kt` only after confirming that
  its existing `createdAtMs` means release publication, not merely manifest
  issuance. If it is issuance time, evolve and sign an explicit publication
  field instead of relabeling it.
- Pin the reviewed artifact and have `LinkUpdater.kt` render the shared
  presentation on Phone and Wear; retain signature, expiry and polling policy.

## Bounded proof

- Parser: valid GitHub timestamp, explicit null, sanitized absence and malformed
  present value.
- Presentation: one UTC instant in New York and Tokyo, New York DST transition,
  and null omission.
- Flow: publication instant, version, changelog and size survive every
  release-bearing state and install retry; the row receives raw epoch data.
- Only `:releasekit:testDebugUnitTest`, diff inspection and the manual file
  ratchet ran before merge. No CI, full suite or product adoption was added.
