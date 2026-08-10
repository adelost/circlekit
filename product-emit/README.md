# @v1d/product-emit

Typed, deterministic ProductSpec emitters. Import only the layer a product
uses:

```ts
import { emitThemeKotlin } from "@v1d/product-emit/core";
import { emitSettingsKotlin } from "@v1d/product-emit/skydiving";
```

`core` is product-neutral and cannot depend on `skydiving`. The skydiving
entrypoint owns its closed Phone/Wear settings grammar and requires the product
to supply every native Kotlin symbol explicitly; the package contains no
consumer package names or fallback symbols.

Build and run the bounded contract proof with `npm test`. `npm run
verify:acme` packs the package and compiles a renamed minimal consumer from the
tarball. Publication is local-first from the exact CircleKit source SHA:

```bash
scripts/publish-product-emit.sh 0.1.0 --prepare-only
scripts/publish-product-emit.sh 0.1.0
```
