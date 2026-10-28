# @v1d/web-kit

Cutkit's kit for web pages, published from Cutkit's one source: `tools/studio_static/kit` in the Cutkit repository stays the only copy, and Cutkit's own studio keeps importing it directly.
`dist/` is built by Cutkit's `tools/dev/publish-web-kit.mjs` (it writes `dist/SOURCE.json` with the Cutkit commit and the files) and published through this repository's npm path (`scripts/publish-web-kit.sh X.Y.Z`).
This repository holds the manifest and the gate (`npm run check`), never the files.

## Use

A consumer locks one version, as `@v1d/product-emit` does, and keeps no copy:

```json
"@v1d/web-kit": "https://circlekit.pages.dev/npm/v1d/web-kit/0.1.0/v1d-web-kit-0.1.0.tgz"
```

```css
@import "@v1d/web-kit/tokens.css";
:root { /* a page's own values go here, after the kit's */ }
```

## Versions

- 0.1.0: `tokens.css` only (the colours, sizes, radii and motion tokens as custom properties on `:root`).
