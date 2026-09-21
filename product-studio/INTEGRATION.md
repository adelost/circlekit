# Connect a product to Product Studio

Status: implemented inspection/export/trace interfaces in this package. They are development-tool interfaces, not new ProductSpec language shapes. All examples below use existing compiled data; none authorize a product run, model call or deployment.

## 1. Start with an existing checkout

```bash
cd /path/to/circlekit/product-studio
npm ci
npm run verify
npm start -- /path/to/product
```

`bin/studio.mjs` is also exposed as the package's `v1d-studio` executable. It is not globally installed by this PR. Use `node /path/to/circlekit/product-studio/bin/studio.mjs ...` when no executable has been registered.

The existing SKYVW, AMUX, video and Showcase path presets remain convenient fallbacks. A new product does not need a preset or a branch in the UI. Put this small file-selection manifest at its root:

```json
{
  "version": 2,
  "projects": [
    {
      "id": "my-product",
      "label": "My Product",
      "bundle": "generated/my-product.studio.json"
    }
  ]
}
```

The filename is `studio.workspace.json`. With that file present, running `v1d-studio` from the product directory discovers it. The manifest selects already-generated data and the bundle names source files; it contains no shell command, executable plugin, callback, or second definition of product behavior.

To diagnose attachment without opening a browser:

```bash
node /path/to/circlekit/product-studio/bin/studio.mjs doctor /path/to/product
```

The report shows model identity, source correlation, compiler compatibility, facets, owners, source locations and diagnostics. It is not a live-runtime health report.

## 2. Package existing compiled JSON today

This path requires no source execution by Studio and no changes to the product's generator. The output directory must already exist.

```bash
node /path/to/circlekit/product-studio/bin/studio.mjs bundle \
  --root /path/to/product \
  --product generated/product.json \
  --facet generated/recording.machine.json \
  --source src/app.ts \
  --source src/recording-machine.ts \
  --compiler-version 0.3.65 \
  --source-revision YOUR_ACTUAL_SOURCE_REVISION \
  --output generated/my-product.studio.json
```

Replace all paths and the version with real inputs. Omit `--facet` when there is no separately exported machine/table. A machine-only product can omit `--product` and supply `--product-id`. The command prints the corresponding workspace manifest entry. It never guesses the producer version from the Studio version and never imports a repository module to find an export.

This packages existing output; it does not prove that output matches current source. Source digests record the inputs you supply. The product's real compile/check-generated path remains the authority for that relationship.

## 3. Preferred integration: export inside the existing trusted build

The implemented `adapter.mjs` exports `prepareInspection` and `writeInspectionBundle`. Call them from the product's already-owned build/export path, after its real compiler and invariants have run. Pass the actual objects rather than copying their cells into a Studio registry.

This package is not published to npm by this PR. During tool development, a build adapter may explicitly load its installed local tool module through an owner-configured path. Do not replace a product's immutable ProductSpec dependency with a sibling worktree. Package/distribute the Studio development tool through the existing owner workflow before adopting a bare package import in multiple repositories.

The following is the body of that build integration, with `product`, `recordingMachine`, `productRoot`, `sourceRevision`, `producerPackageVersion` and the imported helper supplied by the existing build:

```js
const receipt = await writeInspectionBundle({
  root: productRoot,
  output: 'generated/my-product.studio.json',
  productId: product.id,
  compiler: {
    name: '@v1d/product-spec',
    version: producerPackageVersion,
  },
  sourceRevision,
  product,
  facets: [
    {
      id: recordingMachine.id,
      kind: 'machine',
      compiled: recordingMachine,
    },
  ],
  sourceFiles: ['src/app.ts', 'src/recording-machine.ts'],
});
```

This is not a new ProductSpec export or an automatically installed compiler hook. `writeInspectionBundle` writes one generated inspection file. `prepareInspection` returns the same bundle without writing, suitable for incorporation into an existing output-manifest owner. No tool-owned generator is run on every editor keystroke.

A table already carried in `ProductIr.decisionTables` need not be copied into `facets`. Standalone facets are for definitions not present in the full IR. Matching duplicates are merged; conflicting definitions are refused. Unknown facet kinds stay visibly inspect-only.

### What is automatic and what still needs a real owner

Automatic: source digests, exact model/envelope digests, indexing unique literal IDs, typed graph extraction, table/machine views and generic queries.

Explicit when meaningful: semantic groups, facet-to-runtime associations, source maps for computed declarations, opaque payload codecs, actual runtime observation hooks, and native/media preview adapters.

The helper does not recover arbitrary source from JSON. A TypeScript runtime constructor does not magically know the original source span. Syntax indexing can find unique literal locations; ambiguous/computed identities need an explicit map from a source-aware build adapter. Unresolved fields remain inspectable, not silently writable.

## 4. Groups and relationships without a second graph

Groups are presentation metadata with explicitly selected owners. Reuse an existing product grouping source where one exists. Do not infer domain membership from the first component of an ID.

```js
groups: [
  {
    id: 'capture',
    label: 'Capture',
    members: [entityKey('node', 'capture.owner')],
  },
],
relations: [
  {
    from: entityKey('facet', recordingMachine.id, 'machine'),
    to: entityKey('node', 'capture.owner'),
    kind: 'controls',
    label: 'Owned transition policy',
  },
],
```

`entityKey` is exported by the adapter. Use it rather than constructing colon-delimited keys by hand. Ports use `entityKey('port', actualPortRef)`. Cell keys use kind `cell` and parent `${facetKind}/${facetId}`.

Adapter associations are labelled as adapter-supplied, not native binding proof. Graph queries follow the actual compiled port bindings. Potential impact at owner granularity does not prove that every input affects every output inside native code. A facet with no explicit owner association reports unknown impact beyond itself.

## 5. Exact source navigation

An origin has `entityKey`, repository-relative `file`, `sourceDigest`, a real `{start,end}` span or null, and an `editing` classification. Offsets use JavaScript/TypeScript string positions. The digest is SHA-256 of the exact UTF-8 source content.

The exporter can locate unambiguous literals automatically. Explicit maps override syntax matches but must still match the actual source digest. A shared declaration maps to its owner; do not publish multiple independent writable copies. Native files can be opened through explicit source locations without pretending the TypeScript parser understands Kotlin/Python.

The GUI provides source selection, line numbers, graph-to-code navigation and code-to-entity selection. Source-to-graph matching applies only to the unchanged base text; an edited candidate needs fresh provenance. A new visual location must not overwrite an in-progress file draft. Several facets in one source file share one source draft.

Current editing remains limited: supported machine/table construction can be validated through the shared kernel; arbitrary native/application code cannot. A position alone does not authorize an inverse edit or validate a whole product.

## 6. Recorded traces: connect the real owner, not a second runtime

The implemented `createTraceRecorder` is a passive bounded collector. It does not open a network connection, wrap every function or run a scheduler. Existing owners explicitly report observations.

```js
const trace = createTraceRecorder({
  productId: product.id,
  modelDigest: receipt.modelDigest,
  sessionId: existingRuntimeSessionId,
  clock: 'monotonic',
  capacity: 2000,
  provenance: 'recorded',
});

const delivered = trace.record({
  atMs: existingMonotonicClock(),
  kind: 'port',
  entityKey: entityKey('port', actualPortRef),
  operationId: existingOperationId,
  summary: 'One value delivered',
});

trace.record({
  atMs: existingMonotonicClock(),
  kind: 'decision',
  entityKey: entityKey('facet', policy.id, 'decision-table'),
  operationId: existingOperationId,
  causedBy: delivered,
  summary: 'Policy evaluated',
  logic: {
    facetId: policy.id,
    cellId: decision.cell,
    facts: decision.at,
    values: decision.values,
  },
});

const dataOnlyCapture = trace.snapshot();
```

These variables denote actual owner observations, not fabricated values. Record `causedBy` only when the producer knows that causal relationship. Reusing an operation ID or having adjacent timestamps does not prove causality. Native/Python owners may produce the same versioned data format through their own hooks; those integrations have not been implemented in this PR.

Import the capture in the GUI's **Trace** view. It verifies product/model/entity identities, clock domain, event order, explicit gaps and bounded payloads. Step backward/forward, filter by operation or text, navigate to the observed entity and compare supplied finite logic evidence to the compatible kernel. Contradictory recorded evidence remains visible; the viewer does not overwrite it with what the model expected.

Record summaries and necessary finite facts, not secrets, source footage or full unbounded transcripts. Synthetic fixtures use `provenance: 'synthetic'`. The SDK is not an authentication system or an automatic redactor; the producer still chooses what is safe to capture. No live-runtime pause, mutation or whole-program replay is implemented.

## 7. Versions, scopes and changed source

- Inspection protocol: version 2. Runtime trace protocol: version 1.
- Product IR reader: schema 9. Unknown schemas fail rather than being reinterpreted.
- Producer ProductSpec version and active evaluator must match for simulation.
- A different producer version can still be inspected; it does not silently use Studio's evaluator.
- A saved model may remain simulatable even after source changes, but it remains that saved model. The UI marks changed/unavailable source. Current source editing is separately checked against the consumer package pin.
- Producer diagnostics remain visible. Error-level producer diagnostics prevent simulated execution.
- Model digest identifies compiled meaning plus declared source inputs and compiler provenance. Workspace-view identity also scopes file/read-set revision and project selection. A Git SHA alone is insufficient.
- Groups, source maps and canvas positions are not substitutes for native conformance. Hash equality provides integrity/correlation, not an assertion that a sensor, callback or device actually ran.

## 8. Cross-product adoption order

First prove one full product bundle and one standalone table bundle through the same core. Use Showcase or a current SKYVW export for structure; AMUX or the video activity table supplies the smaller independent logic case. No private product code needs to enter CircleKit.

Then attach exact source files and a trace from one owned test path. Leave native previews, real video commands and external execution unavailable until those existing product owners are integrated. There is no benefit in making a graph look runnable by duplicating their state stores, worker manifests, undo engines or schedulers.

See [HANDOFF](HANDOFF.md) for remaining work and [VERIFICATION](VERIFICATION.md) for the material local test limitations.
