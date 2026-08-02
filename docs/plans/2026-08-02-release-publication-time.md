# Release publication time

Status: implemented in CircleKit ReleaseKit and stopped at the unpublished
review boundary. Maven and product adoption wait for an exact-SHA review score
of at least 9/10.

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

## Bounded proof before publication

- Parser: valid GitHub timestamp, explicit null, sanitized absence and malformed
  present value.
- Presentation: one UTC instant in New York and Tokyo, New York DST transition,
  and null omission.
- Flow: publication instant, version, changelog and size survive every
  release-bearing state and install retry; the row receives raw epoch data.
- Run only `:releasekit:testDebugUnitTest`, inspect the diff for network/polling
  changes, then commit, push and open a draft PR at the exact review SHA.
