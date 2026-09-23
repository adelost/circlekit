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
  and typed events. Ports are an object, name to contract, in order:
  `inputs: { model: statusContract, phase: phasePresentation }`, where a
  presentation means its `.contract`. `requiredCapabilities` defaults to
  `["ui.component-tree"]` and is written only when a type needs something else.
  The list of `componentPort(name, contract, { required })` calls stays valid,
  and is the form for an optional port.
- `family(shared)` states fields many rows share once: `const conditions =
  family({ category: "CONDITIONS", shape: "WHOLE_JUMP", edit: "DERIVED" })`, then
  `conditions({ id: "night", label: "NIGHT" })` is the full record. A row that
  restates a field its family fixes is refused, in the editor and at build.

`node` is compiler/IR vocabulary for the first three kinds, not a fifth
authoring choice. There is no parallel `role` taxonomy and no opt-in UI list.
Products declare `nodeTypes`, `nodes`, component types, component instances and
mounts; every edge and demand path is compiled from that one graph.

Reusable node types may declare typed `configInputs` with field names,
primitive types and units. ProductConfig supplies the concrete values;
compilation rejects missing, extra or wrongly typed values before emission.

Reusable domain packages declare their contracts, node types and finite values
with `defineProductLibraryCatalog(...)`. A product passes those catalogs as the
third argument to `defineProduct(...)` and may place the exact imported values
in its normal declaration arrays. The compiler preserves their library origin
without changing Product IR ordering. A local copy of any reserved contract,
node-type or finite-value id fails even when its schema is byte-for-byte equal.
Two libraries may not reserve the same id.

Finite node values use `finiteValueRef` and a product-owned `finiteValues`
catalog. The catalog is emitted in Product IR, while opaque record/list types
continue to use `valueRef`. Compilation rejects both unknown finite references
and catalog declarations that no mounted contract consumes. `finiteProduct`
builds a typed cartesian state space from literal axes, and `mapFiniteCases`
generates an exhaustive case object from it; products do not copy dozens of
operation-by-data case ids by hand.

A decision over a few finite axes (which values hold in this phase and this
display state) is one `defineDecisionTable(...)`: `axes` list every value,
`columns` type the answers (`choice`, `bool`, `integer`, `record`,
`perChoice`), and each `on(id, region, values)` cell names the region it
covers. The shape itself refuses a point no cell covers, two cells on one
point, a region naming an undeclared axis or value, a value of the wrong
column type and any function inside a cell or region; a product can only add
laws with `invariants: [{ refuse, when }]`, which run once at definition and
are not part of the returned table. An axis the platform derives from events
(a window after a touch) is declared in `derived` with its source, window and
start, restart and end events. `decide(table, point)` returns the
values with the id of the cell that decided. A product passes its tables to
`defineProduct` as `decisionTables`, so they reach the IR, the product JSON and
the product graph; product-emit writes the same
lookup as an exhaustive Kotlin `when`.

Where streams and services run is one `defineLanes(...)`: each lane says
`isolation` (`dedicated` for one owner's work, `shared` for unrelated riders),
`ordering` (`serial`), `lifetime` (`process`, or `owner` for a dedicated lane
that lives and closes with its owner instance), a dedicated lane's `owner`,
and a reason. `streams` lists every stream the product declares, and `rides`
maps each `stream.<id>` or `service.<id>` to a shared lane or `ui` by name, or
to a dedicated lane as `{ lane, owner }`. The shape refuses a stream on the UI
lane, a rider on a dedicated lane that works for another owner, a dedicated
lane with no rider, a shared lane that claims an owner's lifetime, a declared
stream that rides nothing and a ride to an undeclared lane. A product passes its
lanes to `defineProduct` as `lanes`, so the IR and the product JSON carry them
with every ride as an edge; product-emit builds each lane once for a platform,
reports its fulfilment (full, degraded or unsupported) and draws each lane in
the product graph.

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

Navigation reuses that catalog rather than declaring another page list.
`defineProductNavigation(componentFamilies, ...)` requires only `guard` and
closed `back` semantics for every derived screen id. Each artifact's existing
`entryScreen` is its sole default authority; the compiler derives `root`
restore for that page and `process` for the artifact's other `screenRefs`.
Different artifacts may therefore have different entries and subsets without
a global default or restore copy.

There is one `navigationRouteContract(id)` for the product. It is a UI event
whose sole target is the finite `target: PageId` payload; there is no second
target in its id or metadata. UI events may originate only at mounted component
outputs and must bind a service input. The navigation service publishes the
finite active PageId to one declared page-host component input. Typed route and
ordinary event outputs on every mounted component compile into neutral `actionGroups`;
menus are ordinary component types, instances and mounts, not a second catalog.
Guards are service-output state contracts wired into the same navigation
service, never node-role strings or TypeScript predicates.

Native binding manifest schema 5 requires actual host navigation registrations:
artifact entry/page semantics, the active-page publisher/page-host edge, and
every action source, service target and effect. Shared conformance compares all
of these in both directions. Native exporters must build this section from
their registered ports and hosts; copying expected Product IR into the manifest
does not constitute an implementation proof.

Consumers can run `v1d-check-pins [package-directory]` after install. It scans
every direct `@v1d/*` dependency section, requires the immutable versioned
HTTPS tarball URL, and verifies the exact resolved URL, version and sha512
integrity in `package-lock.json`. Local `file:`, `workspace:` and project-path
dependencies are rejected.

## Browser and Node entries

The ordinary `@v1d/product-spec` root contains only portable declarations, finite evaluators and runtime binding types. Node-only generation and pin tools such as `productJsonEmitter`, `buildOutputManifest`, `writeOutputManifest` and `checkV1dPinsAt` live at `@v1d/product-spec/node`. Browser code can import `bindPortImplementations` from the root without pulling in `node:fs` or `node:path`. An emitted-import-graph test holds this boundary.

## Test-run observation

`v1d-studio record` selects the `studio-trace` package condition only for its child test process. In that condition, `decide` and `step` record their real cell outcomes. Normal imports use the unchanged pure functions and load no tracing module. A host binding can pass its named functions through `bindPortImplementations`; normal execution receives the same object, while the test condition observes calls by their declared port names. Studio, not the product, attaches model identity and writes the trace file.

`@v1d/product-spec/observation` is the optional transport-free development seam. `createObservationScope({ onObservation })` returns `decide`, `step` and `bindPortImplementations` wrappers. Its events say `evaluated` for logic and `returned` for ports; they never claim that a state was applied or a Promise succeeded. Port calls keep their receiver, return value and thrown error, including when the owner is frozen or replaces a method later. The callback must only enqueue bounded data. Its failure cannot change the application's return value or exception. No network, file writer or viewer is imported by the normal ProductSpec entry.

An explicit `v1d-observe` package condition makes ordinary root imports use those observed wrappers. A process bootstrap installs one callback with `installObservationSink` from the `/observation` entry and disposes it on exit. Without that condition, the normal root remains pure. This is a development capture hook, not an application state owner or transport.

For a local Vite page, add `observationVitePlugin({ bundle: "path/to/product.studio.json" })` from `@v1d/product-spec/vite` to the dev config. The plugin is active only under `vite serve`: it resolves ordinary ProductSpec calls through the browser-safe observed entry, checks the bundle's source hashes, and adds a small explicit pairing button. A synced source tree can set `sourceRoot` and `sourcePrefix` in the same call. The browser connector from `/browser` sends only bounded declared observations after a one-time ticket is supplied in memory. A production Vite build contains no connector or pairing UI. The matching Studio receiver must be started separately with `--live` and approve the exact local page Origin; the plugin never generates a ticket or starts Studio.
