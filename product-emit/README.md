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

`emitStatePresentationsKotlinFiles` keeps the registry API in `aggregate` and
returns typed declarations, source/presentation payloads, lookup tables and
registry entries through the existing `shards` list. Write every returned
suffix; file boundaries are not API. Complete declarations/entries are packed
below 500 lines without compressing Kotlin. A single oversized declaration or
the public accessor facade fails explicitly instead of emitting a monolith.

## Reading the product as a graph

`core` can draw any compiled product as two Mermaid files, generated from the
same IR Kotlin is generated from:

```ts
import { domainGraphEmitter, validateCapabilities } from "@v1d/product-emit/core";

const diagnostics = validateCapabilities(product, acmeCapabilityTable);
if (diagnostics.length > 0) throw new Error(diagnostics.map(({ message }) => message).join("\n"));

buildOutputManifest(product, [
  productJsonEmitter("generated/acme.product.json"),
  domainGraphEmitter({
    domains: "generated/acme.domains.mmd",
    full: "generated/acme.graph.mmd",
    productJsonPath: "generated/acme.product.json",
  }, acmeCapabilityTable),
], ["generated"]);
```

- `acme.domains.mmd` is the picture to read. Every first id segment of a node
  or component is one box; every port binding that crosses two of them is a
  solid edge labelled with the contract that crosses. A domain nothing binds
  to is drawn dashed red instead of being left out.
- `acme.graph.mmd` is every node and component inside its domain, for reading
  one subgraph at a time.

The `CapabilityTable` is the product's closed host vocabulary: every
`contextInputs` and `effects` string a node type spells must be a row. A row
has a kind; a row may be limited to the artifacts that provide it, so a node
mounted where its need is missing fails compilation
(`capability.not-provided`); and a `STATE_FEEDBACK` row names the domain whose
state is read or written without a port, which is exactly what the dashed
edges draw. That count is the distance between the declared graph and the
running app, and it is meant to fall.

Build and run the bounded contract proof with `npm test`. `npm run
verify:acme` packs the package and compiles a renamed minimal consumer from the
tarball. Publication is local-first from the exact CircleKit source SHA:

```bash
scripts/publish-product-emit.sh 0.1.0 --prepare-only
scripts/publish-product-emit.sh 0.1.0
```
