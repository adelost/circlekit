# @v1d/product-emit

The consuming product owns the `@v1d/product-spec` version. ProductEmit uses
one compatible peer (`>=0.3.64 <0.4.0`) and pins 0.3.83 only for its own build
and tests. Its existing skydiving-legos 0.1.5 dependency is unchanged; that
legacy package's private 0.3.52 copy is not ProductEmit's public type boundary.

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

`emitDecisionCellsKotlin` and `emitDecisionLookupKotlin` write a product-spec
decision table as Kotlin fragments the product places in its own file: one
constant per cell with its id first, and a lookup that is an exhaustive `when`
per axis in declared order. A branch that one cell covers returns that cell, so
a region over several values is one line. The product names every axis enum and
column argument, and writes record values itself; nothing is guessed.

`emitLanesKotlin` writes a product-spec `defineLanes` declaration as one Android
object. A dedicated lane is a HandlerThread named with the product's prefix and
the lane, a shared lane a single-thread executor on a thread with that name,
and the UI lane the main looper. A process lane is built on first use; an owner
lane is an `open<Lane>()` its owner calls and closes with `close()`. A rider
registers with the handle its lane hands out, and `require()` throws off the
lane only when the product's debug expression is true. `fulfilment()` lists, per
lane, its isolation and ordering, what Android built and how fully.

`sceneKotlinEmitter` writes each product's declared ordered scene layers as
`Generated<Product>Scenes.kt`. Renderer, style, source and layer-id enums
implement the platform's shared scene ABI. A layer enum value is emitted per
declared layer so several layers can share one source while having separate
provider keys. Camera alternatives and layer filters remain ordered data, and
visibility toggle defaults/grouping are emitted unchanged. The generated file
contains data only, not drawing or provider code. Each layer carries its
declared `raster`, `world` or `upright` pass. Set `sceneRuntimePackage` to the
shared package for `GeneratedScenePass`, `GeneratedSceneLayerId` and
`GeneratedSceneLayerToggle`; it is required when the product declares scenes
and unused by scene-free products.

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
- `acme.graph.mmd` is every node, component and decision table (one hexagon
  listing its cell ids) inside its domain, and each declared lane as a subgraph
  with its riders inside, for reading one subgraph at a time.

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
