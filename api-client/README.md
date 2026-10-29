# @v1d/api-client

What the v1d API runs on the person's own device, so that a file never leaves it and nothing is charged: `waveform` (a file's sound drawn as peaks and three bands) and `encode` (a preview or an Optimized copy of a video, H.264 and AAC in an MP4, through WebCodecs).
Published from the ai-gateway repository's `packages/api-client`, which stays the only copy of the code. `dist/` is built by that repository's `scripts/publish-api-client.mjs` (it writes `dist/SOURCE.json` with the gateway commit, the version and each file's SHA-256) and published through this repository's npm path (`scripts/publish-api-client.sh`).
This repository holds the manifest and the gate (`npm run check`), never the files. The one dependency is `mediabunny`, pinned.

## Use

A consumer locks one version and keeps no copy:

```json
"@v1d/api-client": "https://circlekit.pages.dev/npm/v1d/api-client/0.1.0/v1d-api-client-0.1.0.tgz"
```

```js
import { waveform, encode, encodeSupport, supportWords } from "@v1d/api-client/device";

const wave = await waveform(file, 50);                       // {audio:false} or {audio:true, hz, duration, peaks, bands:{low, mid, high}}
const words = supportWords(encodeSupport());                 // null, or what to tell a browser that cannot encode
const copy = await encode(file, "browser-960-v1", { signal, trace, progress, target });
// copy.file is the MP4 as a Blob, or null when `target` ({ write({position, data}) }) took it piece by piece
```

`encode` throws a `Refusal` (`code` "encode-unsupported", `reason` says why) when the device cannot or should not make the copy. A copy is never larger than its source.
The profiles are `browser-960-v1` (long side 960) and `browser-1920-v1` (1920).
