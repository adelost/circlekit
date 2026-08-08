# @v1d/product-spec

Product-neutral TypeScript authoring and compiler core shared by v1d apps.
Apps own their declarations; this package owns the
closed ProductSpec vocabulary, graph validation, deterministic IR and output
manifest mechanics.

The package contains no product names or native Kotlin/Swift/Monkey C symbols.
Native emitters and bindings remain in their platform repositories.

Reusable LegoSpecs may declare typed `configInputs` with field names, primitive
types and units. ProductConfig supplies the concrete values; compilation
rejects missing, extra or wrongly typed values before emission.

Finite service values use `finiteValueRef` and a product-owned `finiteValues`
catalog. The catalog is emitted in Product IR, while opaque record/list types
continue to use `valueRef`. Compilation rejects both unknown finite references
and catalog declarations that no mounted contract consumes.

Reusable service and component types own named contracts. Product instances
bind every required input and UI event explicitly; the compiler derives one
closed port registry and rejects missing, extra, incompatible, internal or
orphan edges before emission. App- and session-lifecycle demand enters that
same graph rather than bypassing it through native surface lists.

Each artifact selects its screens from the product's typed component-family
catalog. Required mounts must be supported by its renderer, while an optional
`omit` mount is recorded as an explicit artifact-scope outcome in Product IR.
