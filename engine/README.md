# @v1d/engine

Video in the browser, for any app, on the browser's own APIs (WebCodecs, media elements) and on what the caller hands in. Published from Cutkit's `packages/engine`, which stays the only copy of the code: `dist/` is built by Cutkit's `tools/dev/publish-engine.mjs` (it writes `dist/SOURCE.json` with the Cutkit commit and each file's sha256) and published through this repository's npm path (`scripts/publish-engine.sh X.Y.Z`). This repository holds the manifest and the gate (`npm run check`), never the files.

## Use

A consumer locks one version and keeps no copy:

```json
"@v1d/engine": "https://circlekit.pages.dev/npm/v1d/engine/0.1.0/v1d-engine-0.1.0.tgz"
```

```js
import { mediaFacts, videoEditWindow, editWindowOf, frameIndex, framePlan } from "@v1d/engine/boxes";   // no browser API: a Worker and a server read it too
import { stillFrame, stillsWith, firstFrameOf, encodeSupport, supportWords, supportedEncoderConfig } from "@v1d/engine/decode";

const facts = await mediaFacts(read, size);              // codec, size, frame clock, rate, sound; or {unknown: why}
const clock = await editWindowOf(file);                   // {start, end} of the shown pictures, or {unknown}
const still = await stillFrame(url, 4.03, 960);           // {picture (a JPEG's object URL), pts}: one byte range of the original, decoded here
```

## Parts

- `boxes`: an MP4 or QuickTime file's boxes in bounds (the movie box up to 8 MB), its video's codec and clock, the edit window, and the byte range a paused frame needs. Pure.
- `decode`: the paused frame at a second (`stillsWith` hands in the app's store of made pictures), a picked file's first frame, and what this browser encodes (`encodeSupport`, `supportedEncoderConfig`, `encoderTakes`, `aacEncodes`) and how fast it decodes a preview (`previewDecode`).
