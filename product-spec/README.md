# @v1d/product-spec

Product-neutral TypeScript authoring and compiler core shared by v1d apps.
Apps own their declarations; this package owns the
closed ProductSpec vocabulary, graph validation, deterministic IR and output
manifest mechanics.

The package contains no product names or native Kotlin/Swift/Monkey C symbols.
Native emitters and bindings remain in their platform repositories.
