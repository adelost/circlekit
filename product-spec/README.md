# @v1d/product-spec

Product-neutral TypeScript authoring and compiler core shared by v1d apps.
Apps own their declarations; this package owns the
closed ProductSpec vocabulary, graph validation, deterministic IR and output
manifest mechanics.

The package contains no product names or native Kotlin/Swift/Monkey C symbols.
Native emitters and bindings remain in their platform repositories.

The authoring vocabulary has four executable building blocks:

- `service(...)` owns external IO, persistence, a resource or platform
  lifecycle. Its non-empty `runtime.effects` tuple is structural proof; an
  effect-free service does not type-check.
- `derive(...)` performs effect-free domain computation and may feed services
  or presentations. It cannot feed a component directly.
- `present(...)` is the final effect-free immutable model before one or more
  components. It may feed components only; presentation chains are rejected
  with an error that names `derive(...)` as the correction.
- `defineComponentType(...)` declares a dumb renderer's mandatory named inputs
  and typed events.

`node` is compiler/IR vocabulary for the first three kinds, not a fifth
authoring choice. There is no parallel `role` taxonomy and no opt-in UI list.
Products declare `nodeTypes`, `nodes`, component types, component instances and
mounts; every edge and demand path is compiled from that one graph.

Reusable node types may declare typed `configInputs` with field names,
primitive types and units. ProductConfig supplies the concrete values;
compilation rejects missing, extra or wrongly typed values before emission.

Finite node values use `finiteValueRef` and a product-owned `finiteValues`
catalog. The catalog is emitted in Product IR, while opaque record/list types
continue to use `valueRef`. Compilation rejects both unknown finite references
and catalog declarations that no mounted contract consumes. `finiteProduct`
builds a typed cartesian state space from literal axes, and `mapFiniteCases`
generates an exhaustive case object from it; products do not copy dozens of
operation-by-data case ids by hand.

Every UI-reaching closed state discriminator uses one
`defineStateAuthority(...)`. Its source is an exact output port, contract,
finite discriminator field and finite value declaration; a service may own
multiple independent state axes. `defineStatePresentation(...)` declares one
required payload schema and an exhaustive case for every canonical state id,
so it cannot invent a private tier, omit a state, or vary fields between cases.
`defineStateAuthority(...)` also creates a final `present(...)` adapter type
and instance. Its presentation-bound output is consumed directly by components;
another handwritten presentation node cannot intercept it or re-author its
copy. The compiled IR therefore carries executable adapter wiring plus its
exhaustive case data, not a parallel inspector-only registry.

Coverage is derived transitively from data bindings across service and derive
nodes. Every UI-reaching presentation-bound finite discriminator is eligible
regardless of whether its author labeled the contract `state` or `snapshot`.
Missing authorities, duplicate canonical reads, missing component bindings,
and ancestor/descendant authorities consumed by the same component fail before
Product IR is emitted, even if the competing state space was renamed.
Independent sibling axes remain legal. `context` ports may tune services only;
derive/present context inputs are rejected so a cadence hint cannot become a
second UI truth. Products with no eligible closed state write
`stateAuthorities: []` explicitly; that empty declaration cannot hide an
eligible state because compilation derives eligibility from the graph.

Reusable node and component types own named contracts. Product instances
bind every required input and UI event explicitly; the compiler derives one
closed port registry and rejects missing, extra, incompatible, internal or
orphan edges before emission. App- and session-lifecycle demand enters that
same graph rather than bypassing it through native surface lists.

Every service instance selects one structural activation form. A `leased`
instance names the selected node type's single `purpose: "demand"` input and
may list closed `app-active` or `session-active` lifecycle sources. A
`lifetime` instance has no demand input and is never activated itself, though
its data dependencies may lead to leased services. Mounted components,
explicit demand bindings and lifecycle roots all traverse the same data graph;
the emitted demand edge names the reached leased input as `targetPortRef`.
Lifecycle declarations whose closure reaches no leased service are rejected.

Each artifact selects its screens from the product's typed component-family
catalog. Required mounts must be supported by its renderer, while an optional
`omit` mount is recorded as an explicit artifact-scope outcome in Product IR.
