# @v1d/web-kit

Cutkit's kit for web pages, published from Cutkit's one source: `tools/studio_static/kit` in the Cutkit repository stays the only copy, and Cutkit's own studio keeps importing it directly.
`dist/` is built by Cutkit's `tools/dev/publish-web-kit.mjs` (it writes `dist/SOURCE.json` with the Cutkit commit and the files) and published through this repository's npm path (`scripts/publish-web-kit.sh X.Y.Z`).
This repository holds the manifest and the gate (`npm run check`), never the files.

## Use

A consumer locks one version, as `@v1d/product-emit` does, and keeps no copy:

```json
"@v1d/web-kit": "https://circlekit.pages.dev/npm/v1d/web-kit/0.7.0/v1d-web-kit-0.7.0.tgz"
```

```js
import "@v1d/web-kit/tokens.css";   // the tokens, as custom properties on :root
import "@v1d/web-kit/web-kit.css";  // the looks of the parts below, from those tokens only
import { searchField, filterChips, panel, codeBlock } from "@v1d/web-kit";
```

A page sets its own values after the kit's, for example `:root { --bg: #101114; --accent: #f2c14e; }`. Every colour, size and radius in `web-kit.css` is a token, so a page changes the look by changing tokens and never by overriding rules.

## Parts

Each part is a function that returns a DOM node: no framework and no bundler is needed. Icons are nodes the page gives (any SVG element).

- `searchField({ placeholder, label, icon, onInput, value, id })`: the icon and an input. `onInput(words)` gets the whole text on every change, and Escape clears a field that has text. `label` is the accessible name and defaults to the placeholder. The input is `field.input`.
- `filterChips({ kinds: [{ id, label, icon, count, color }], iconOnly, words, size, pressed, onChange, label })`: a toggle per kind, showing its icon and count. Under 900 px, or with `iconOnly`, a chip is a 44 px round button with the icon alone; `label, count` is its tooltip and its name for a screen reader. `onChange(ids)` gets every id that is on; `row.setPressed(ids)` sets them from outside. `color` is a CSS value for the icon, such as `var(--kind-item)`. With `words` a chip shows its word beside the icon at every width (the count as before, in the name under 900 px) and the row scrolls sideways under 900 px instead of wrapping; `size: "small"` is a card's tag, 28 px high, dim until pressed, with a 44 px box to press under a finger (`pointer: coarse`).
- `panel({ title, mark, action, lead, className }, ...children)`: one surface with a head (the mark, the title in capitals, one action at the end) when it has a `title`, otherwise the surface alone. `panelHead` is the head alone.
- `boxMeter({ lit, boxes, value, label, color })`: a reading as small boxes, as many lit as it is high (five boxes unless said), `lit` a whole number from 0 to `boxes`, or null where nothing was measured, which says "not measured" in words. `value` is the reading as words (`$0.0008`) and `label` what it is a reading of (`Cost`): together the row's name and tooltip. `color` is a CSS value for a lit box; the size is `--meter-size` on the row or above it (10 px unless set).
- `codeBlock({ title, id, icon, json, text, label })`: a small title over a hairline, what the text belongs to (`id`, with its `icon`) and the text in a monospace well that scrolls sideways. `json` is shown pretty printed.
- `el(tag, props, ...children)`: the helper the parts are made with.

Tokens the parts read: `--bg --fg --muted --card --input --border --control --hover --segment-on --sel --accent --radius --font --font-mono --type-small --type-heading` and the panel's `--panel-fill --panel-edge --panel-radius --panel-pad --panel-gap --panel-title --panel-lead-title`.

## The time view and the song row (0.4.0)

Subpath imports, each with its types: `@v1d/web-kit/timescale` (the window's arithmetic: zoom, pan, fit, time to x), `@v1d/web-kit/timeview` (`TimeView({ span, rows, playhead, wide, onSeek, onView })`: an axis, wheel and pinch zoom, +, - and Fit, panning, a playhead, tap to seek, rows drawn by plain functions) with its sheet `@v1d/web-kit/timeview.css`,
`@v1d/web-kit/songrow` (`songRow(song, { ceilingDb, wide })`: a song as a row of a time view, its three bands and its moments), `@v1d/web-kit/songwave` (the drawing under it, for a page that draws a song on a canvas of its own) and `@v1d/web-kit/tokens` (the canvas reads the same tokens as the DOM: `token("tl-bg")`).
These draw on canvases from the `--tl-*` tokens of `tokens.css`, so a page sets those after importing it, as for the other tokens.

## The encoder (0.4.0)

`@v1d/web-kit/encode`: `encodeProxy(file, ids, progress, options)` makes a browser preview of a video file. The page passes in what is its own: `options.store` (where the MP4 is written: `begin`, `finish`, `discard`), `options.library` (loads the media library, mediabunny 1.61.6) and, to score the picture curve, `options.curve`.
The package imports no library and no storage itself: called without a store or a library it returns `{ state: 'server', reason: 'encoder-not-given-its-store-and-library' }`, as it does for any device that cannot encode (the caller then uses its other way).

## A file's identity (0.5.0)

`@v1d/web-kit/file_identity`: `fingerprint(file)` is `size:sha256 of the first 8 MiB:sha256 of the last 8 MiB`, cheap and enough to suggest that two files are one; `fullSha(file)` is the whole file's SHA-256 as lower-case hex, read in 8 MiB pieces, and only it identifies a file. Both take a `Blob` or `File`.

## Quick's preparation (0.5.0)

The picture curve and the chapter sheets, made from the same code as Cutkit's: each subpath has its types, and these files import only each other and the package's own files.

- `@v1d/web-kit/picture_curve`: `createPictureScorer({ previewFps })` scores a preview's frames (`score({ small, grid })` gives `{ hard, slow }`), `curveBytes(curve)` and `readCurve(bytes)` store and read a curve, `hardPeaks` and `cutTimes` find where the picture changes, and `CURVE` holds the profile's numbers.
- `@v1d/web-kit/preview_curve_tap`: `createCurveTap({ previewFps })` scores the frames while a preview is made: `add(canvas)` each kept frame in order, then `curve()`. Pass it to the encoder as `options.curve.tap`.
- `@v1d/web-kit/chapter_candidates`: `candidates(curve, clock, options)` lists the cuts, events and spans a chapter may start at.
- `@v1d/web-kit/chapter_sheet_layout`: `partsOf`, `frameTimes`, `pairTimes`, `layoutOf` and `manifestOf` lay the sheets out and describe them, `SHEETS` holds the profile's numbers.
- `@v1d/web-kit/chapter_plan`: `chapterPlan(curveBytes, time)` joins the curve, the candidates and the layout into the parts to draw, and `sheetsWithoutCurve(time)` says how many sheets a clip needs before its curve is kept (one per 120 s).

## A song's data (0.6.0)

`@v1d/web-kit/song_data`: `songData(file, { hz })` is `{ duration, hz, peaks, bands: { low, mid, high } }` of an audio file (a `File` or a `Blob` the browser decodes), made with Web Audio and nothing else, ready for `songRow(song, ...)`. `peaks` is the loudest sample of each 1/`hz` second as linear amplitude 0 to 1, each band is measured the same way after its filter (low under 250 Hz, mid 250 to 2000 Hz, high above 2000 Hz), all `Float32Array`s of one length. `hz` is a whole number that divides 8000 and defaults to 50. A file the browser cannot decode, or one longer than 30 min, rejects with an Error.
The numbers are the ones Cutkit's studio draws from an original in the browser: the file is decoded to 8 kHz and measured by the studio's own code. Against the server's waveform (ffmpeg to 8 kHz) the peaks agree to 0.004 under 500 Hz and differ more for sound near 3 kHz, where the browser's decoder rolls off more (0.24 against 0.35 for a 3 kHz tone): up to 0.13 for such a tone, 0.04 for a song with hi-hats.

## Versions

- 0.1.0: `tokens.css` only (the colours, sizes, radii and motion tokens as custom properties on `:root`).
- 0.2.0: `searchField`, `filterChips`, `panel`, `codeBlock` and `el` in `index.js` with `index.d.ts`, and `web-kit.css`.
- 0.4.0: the time view, the song row and the song drawing (`timescale`, `timeview`, `songrow`, `songwave`, `tokens`, `timeview.css`) and the encoder (`encode`), with types. There is no 0.3.0: its song view is in 0.4.0.
- 0.5.0: a file's identity (`file_identity`) and Quick's preparation (`picture_curve`, `preview_curve_tap`, `chapter_candidates`, `chapter_sheet_layout`, `chapter_plan`), with types.
- 0.6.0: a song's data from an audio file (`song_data`: `songData`), with types.
- 0.7.0: `boxMeter`; `filterChips` gets `words` and `size: "small"`; the time view's + - and Fit are a row of their own under its rows and 44 px under a finger; the search field draws one focus ring, not a second from a page's `input:focus-visible`.
