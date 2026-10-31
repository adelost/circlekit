# @v1d/api-client

What the v1d API runs on the person's own device, so that a file never leaves it and nothing is charged: `waveform` (a file's sound drawn as peaks and three bands), `cuts` (where a video changes scene) and `encode` (a preview or an Optimized copy of a video, H.264 and AAC in an MP4, through WebCodecs).
Published from the ai-gateway repository's `packages/api-client`, which stays the only copy of the code. `dist/` is built by that repository's `scripts/publish-api-client.mjs` (it writes `dist/SOURCE.json` with the gateway commit, the version and each file's SHA-256) and published through this repository's npm path (`scripts/publish-api-client.sh`).
This repository holds the manifest and the gate (`npm run check`), never the files. The one dependency is `mediabunny`, pinned.

## Use

A consumer locks one version and keeps no copy:

```json
"@v1d/api-client": "https://circlekit.pages.dev/npm/v1d/api-client/0.5.1/v1d-api-client-0.5.1.tgz"
```

```js
import { waveform, encode, encodeSupport, supportWords } from "@v1d/api-client/device";

const wave = await waveform(file, 50);                       // {audio:false} or {audio:true, hz, duration, peaks, bands:{low, mid, high}}
const words = supportWords(encodeSupport());                 // null, or what to tell a browser that cannot encode
const copy = await encode(file, "browser-960-v1", { signal, trace, progress, target });
// copy.file is the MP4 as a Blob, or null when `target` ({ write({position, data}) }) took it piece by piece
```

`encode` takes the hooks a caller that stores and shows copies needs (`store` {begin, finish, discard}, `ids`, `window` for a part as a fragmented MP4, `identity`, `twin`, `curve`, `allowOriginal` for a source that is its own preview), and `encodeSoundPart` makes a part of the sound.
The profiles and the rules about which copy an export reads are also a dependency-free entry, `@v1d/api-client/profile`, for pages, the edge and checks that need only names and numbers.

`@v1d/api-client/cuts` is the scene analysis: `cuts(file)` reads a video's picture on the device and answers `{fps, duration, frames, cuts: [{t, frame, kind, score}]}` (`kind` is `cut`, or `dissolve` with `{slow: 0.45}`); it also exports Cut's own picture curve (`CURVE`, `createPictureScorer`, `deriveSmall`, `hardPeaks`, `cutTimes`, `candidates`), the two files as Cut wrote them.

`@v1d/api-client/media` builds the two bodies an app's own server sends the files store: `startBody` (a new upload, or a file derived from another) and `registerBody` (a file whose bytes stay on the person's computer), with their types generated from the gateway's records, so an app keeps no copy of the shapes. The owner label {app, project, tags} is the type `MediaOwner`; `MediaRef`, its name in 0.5.0, stays as a deprecated alias for this version.

`@v1d/api-client/upload` is the one module that sends a file to storage in parts (each part hashed before its address is signed); it has no dependency and no page code.

`encode` throws a `Refusal` (`code` "encode-unsupported", `reason` says why) when the device cannot or should not make the copy. A copy is never larger than its source.
The profiles are `browser-960-v1` (long side 960), `browser-1920-v1` (1920), `browser-2560-v1`, `browser-3840-v1` and the alpha preview `browser-960-alpha-v1`.
