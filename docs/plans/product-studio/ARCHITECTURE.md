# Architecture and implementation pseudocode

Read [README](README.md) first. All new names below are **proposed Studio interfaces**, not existing ProductSpec exports. Pseudocode is an implementation contract, not a claimed executable implementation. Reuse the real ProductSpec compiler, `decide` and `step`; do not implement their semantics again in the GUI.

## 1. Components and ownership

```text
Existing TS/MJS declarations + pinned packages + configuration
                  |
      product-owned inspection adapter
      in an explicitly trusted local build process
                  |
       validated inspection bundle
                  |
       Studio local workspace service
          /           |            \
     System view   Logic view   Interface view
          \           |            /
       one selection by stable declaration/port identity
                  |
     source index + supported edit lenses
                  |
    isolated draft -> compiler -> diff -> branch commit

Separate evidence inputs:
  fixture scenario -> pure simulator / owned fake-service harness
  recorded dump    -> identity verifier -> observation overlay
  debug runtime    -> authorized debug adapter -> bounded trace
```

The web canvas owns viewport, selections, collapse state and temporary drafts. It does not own domain state, service truth, invariants, retries or source files. Node positions belong in a separate workspace layout file keyed by stable IDs. Moving a node must not reorder a first-match machine or alter a mount.

The local service resolves allowlisted workspace roots, loads bounded artifacts and prepares source edits. Build entrypoints are explicit product adapters, not arbitrary browser-supplied shell commands. Existing product generators with side effects are not blindly run for every pointer movement.

Suggested implementation boundary: a Studio application/package in CircleKit, with thin product-owned adapters in SKYVW and AMUX. Confirm the repository owner and suitable app shell in D0. Do not move product declarations into CircleKit or reorganize the monorepo to start a viewer.

## 2. Inspection contract

A bundle is a derived, disposable view of compiler output. Its schema is an **inspection protocol**, not another DSL or another authority for the product.

```ts
interface InspectionBundle {
  bundleVersion: 1;
  identity: {
    productId: string;
    sourceRevision: string;
    dirtyContentDigest: string | null;
    packageLockDigest: string;
    configDigest: string;
    productSchema: number | null;
    productDigest: string | null;
  };
  // Keep original compiler output; do not flatten it into a lossy editor model.
  product: ProductIr | null;
  facets: readonly Facet[];
  origins: readonly SourceOrigin[];
  diagnostics: readonly StudioDiagnostic[];
}

type Facet =
  | { kind: "decision-table"; id: string; compiled: DecisionTable }
  | { kind: "machine"; id: string; compiled: Machine }
  | { kind: "component-body"; id: string; compiled: unknown }
  | { kind: "qa-scene"; id: string; compiled: unknown };

interface SourceOrigin {
  declarationId: string;
  semanticPath: readonly string[];
  file: string;             // validated repo-relative path
  sourceDigest: string;
  span: { start: number; end: number } | null;
  exportName: string | null;
  owner: "product" | "library";
  editing:
    | { kind: "editable"; lens: string }
    | { kind: "shared"; lens: string; affectedIds: readonly string[] }
    | { kind: "derived"; upstreamIds: readonly string[] }
    | { kind: "external" | "unsupported"; reason: string };
}
```

`ProductIr` schema 9 does not contain every machine/body/scenario. SKYVW's adapter exports the existing `skyvwRecordingMachine` separately. AMUX may export only its two existing tables with `product:null`; do not invent a full AMUX graph. Register only references to real exports. Never duplicate their states/cells into a hand-maintained Studio catalog.

Relations between a standalone facet and a runtime node must come from an existing declared relation or an explicit product-adapter association labelled as such. An ID prefix or matching name is not proof of a runtime binding. Fields with no source mapping remain inspectable but not visually editable.

Library-owned definitions are read-only by default. Visual creation of an instance selects the library's actual type and fills required inputs; it does not clone reserved identities. Unknown facet versions can be shown as unavailable with metadata, not executed or silently treated as current.

### Load and build pseudocode

```ts
async function openWorkspace(request: OpenRequest): Promise<WorkspaceView> {
  const root = await roots.resolveAuthorizedRoot(request.rootId);
  const snapshot = await snapshots.captureReadSet(root, {
    include: ["declarations", "lockfiles", "compilerConfig", "adapterConfig"],
  });
  const artifacts = await boundedArtifacts.readExisting(snapshot);
  if (artifacts.match(snapshot)) return views.from(decodeBundle(artifacts));

  // Loading source is different from executing its imports.
  if (!request.explicitBuildTrust) {
    return views.readOnlySource(snapshot, "Build approval required");
  }
  const bundle = await compilerHost.buildInspection({
    snapshot, adapterId: request.adapterId,
    network: "deny", secrets: "none", output: "temporary",
    limits: budgets.for(snapshot),
  });
  await snapshots.assertStillMatches(snapshot);
  return views.from(decodeBundle(bundle));
}
```

The sandbox must be an actual OS/process isolation boundary with bounded CPU, memory, filesystem and environment access, not merely `eval`, Node `vm` or a Web Worker. If denied networking prevents a compile that requires data, show the missing build input; do not silently grant access. Precompiled, verified artifacts can still be inspected without executing arbitrary repository code.

Use the consumer's supported pinned package release. CircleKit currently exposes its package root and `./foundation`; neither proves that all needed exports work in a browser bundle. Initial simulation may run in the local service. D0 checks exports and transitive imports; ask the package owner for a narrow supported pure export only if needed. No `dist/src/...` deep imports or second local evaluator.

## 3. Source parsing is not inverse compilation

Use the pinned TypeScript parser and symbol resolver with `.ts` and `.mjs` support. Identify imported symbols by resolution, not by matching a function name string. Imported aliases, comments, `as const`, `satisfies`, shared constants and helper families need explicit fixtures.

The supported initial write lens is a literal field of a literal declaration at a unique stable identity. Expand to known helper argument patterns only with an inverse-edit contract. Never infer how to reverse arbitrary `.map()`, spread precedence, imported functions or environment-dependent expressions from their final JSON values.

For a shared family property, show the affected declarations and edit the owning family once. For a derived property, navigate to its inputs. For arbitrary code, `Open source` is the honest operation. Do not generate a new literal beside the old helper and leave two active definitions.

Prefer AST-guided minimal text edits for supported fields so unrelated source is unchanged. Recast is a possible alternative for more complex transformations, but must preserve original-node provenance to preserve formatting. D0 chooses one source-editing path; do not implement two printers or a new grammar.

### Draft edit transaction

```ts
interface EditIntent {
  operationId: string;
  baseBundleDigest: string;
  targetId: string;
  semanticPath: readonly string[];
  replacement: JsonValue;
}

async function proposeEdit(intent: EditIntent): Promise<EditProposal> {
  const base = bundles.require(intent.baseBundleDigest);
  const origin = origins.requireUnique(base, intent.targetId, intent.semanticPath);
  if (!isWritable(origin)) return refusal(origin.editing);

  const draft = await drafts.fork(base); // isolated, never the user's live files
  const before = await draft.read(origin.file);
  assertDigest(before, origin.sourceDigest);
  const ast = parser.parseAndResolve(before, draft.pinnedCompiler);
  const lens = lenses.require(origin.editing.lens);
  const edits = lens.plan(ast, origin, intent.replacement);
  edits.assertNonOverlappingAndWithin(origin);
  await draft.applyTextEdits(edits);

  const after = await compilerHost.buildInspection({ snapshot: draft.snapshot });
  const semanticDiff = compareCompiled(base, after);
  assertAllChangesExplainedBy(intent, semanticDiff);
  return proposals.store({
    operationId: intent.operationId,
    intentDigest: hash(intent), readSet: draft.readSet,
    sourceDiff: draft.diff(), semanticDiff,
    diagnostics: after.diagnostics,
    status: after.hasErrors ? "invalid-draft" : "ready",
    proposedBundleDigest: hash(after),
  });
}
```

A transient incomplete graph is a valid **draft** UX state, not a valid runnable product. Keep the last validated graph visible but marked `Out of date` while source is invalid. Do not silently run it against a new device snapshot.

### Save and publish boundary

Start with an isolated Studio draft branch. `Save draft` produces a commit on that branch; it does not deploy, push, merge, restart a process or invoke a provider.

```ts
async function saveValidatedDraft(proposalId: string): Promise<SaveReceipt> {
  return draftOwner.exclusive(async () => {
    const p = proposals.require(proposalId);
    const prior = receipts.find(p.operationId);
    if (prior) return requireSameIntentOrConflict(prior, p.intentDigest);
    requireStatus(p, "ready");
    await snapshots.assertReadSetMatches(p.readSet);
    await branch.requireHead(p.baseDraftHead);
    const tree = await draftTree.createFromValidatedProposal(p);
    const commit = await git.createCommit(tree, p.baseDraftHead);
    // Compare-and-swap only the Studio-owned ref, never force-update main.
    await git.updateRefIfUnchanged(p.draftRef, commit, p.baseDraftHead);
    return receipts.recordOrRecoverFromCommit(p.operationId, p.intentDigest, commit);
  });
}
```

The operation ID and intent digest must be recoverable from the committed result: a lost client reply must not produce another edit. Source/lock/config changed after preview means `Source changed. Review a refreshed diff.` No blind retries or forced updates.

Publishing into the user's working tree needs an existing transactional workspace-edit facility or an explicit conflict-checked patch workflow. A rename is not a multi-file transaction, and a mutex in Studio does not stop an external editor. Do not claim atomic replacement of arbitrary live worktree files. Undo/redo operates on drafts; a post-apply undo is a new inverse patch with current revision checks, not restoration of an old directory over new work.

Run the real compiler against the changed source, including original product invariant functions. Revalidating JSON with only invariant descriptions is insufficient. User-invalid drafts can be retained as drafts but not labelled validated or exported as runnable output.

## 4. System graph and visual composition

```ts
function buildCanvas(bundle: InspectionBundle, filter: GraphFilter): Canvas {
  const graph = bundle.product?.portRegistry;
  if (!graph) return standaloneFacetIndex(bundle.facets);
  const visible = graphQuery.slice(graph, filter); // derived, not another registry
  return {
    nodes: visible.owners.map(ownerToCard),
    edges: visible.bindings.map(bindingToTypedEdge),
    overlays: evidence.compatibleWith(bundle.identity),
  };
}

async function connectPorts(from: PortRef, to: PortRef) {
  const result = existingGraphRules.checkConnection(currentBundle, from, to);
  if (!result.ok) return ui.showDiagnostic(result.diagnostic);
  return proposeEdit(bindingLens.intent(from, to));
}
```

Port type compatibility is necessary but not sufficient: retain direction, boundary, purpose, mandatory bindings, state-authority, lifecycle and capability laws. Connection highlights are a preview; compilation is authoritative. Do not auto-wire all compatible ports. Unsupported analysis never shows a green success badge.

Creation workflow: select a real catalog type, assign a stable explicit instance ID, fill required config, bind inputs/events, select an explicit artifact/surface, then validate. A missing implementation yields `Implementation required`, not a hidden autogenerated callback. Preserve externally stable IDs and saved wire names. Duplication generates a new proposed identity and an explicit shared-resource choice; it must not clone an external state owner accidentally.

## 5. Table and machine simulation

### Decision table

```ts
function evaluatePoint(table: DecisionTable, facts: unknown): DecisionResult {
  const point = validateExactPoint(table.axes, facts);
  // Reuse ProductSpec; no UI if/else approximation of its cells.
  const decision = productSpec.decide(table, point);
  return { ...decision, evidenceKind: "simulated", effectsExecuted: false };
}
```

A fully specified point uses exactly the declared axes. Unknown is a declared axis value only where the table says so. Elsewhere missing facts remain missing. A "Why not?" view compares the selected point to each region and reports mismatches; it is an explanation derived from the same cells, never another policy evaluator.

AMUX's numeric-to-axis adapter is separate code. Provide two panels: `Raw observations` and `Policy facts`. A direct fact selection simulates only the table. To test tokens/idle thresholds, invoke the actual `contextCostDecision` in an isolated test adapter with an explicit policy snapshot. Never call compact or launch from this panel.

### State-transition machine

```ts
function advanceMachine(run: MachineRun, input: string, facts: GuardFacts) {
  const required = relevantGuardNames(run.machine, run.state, input);
  const unknown = required.filter(name => facts[name] === "unknown");
  if (unknown.length) {
    // Do not turn unknown observations into absent/false guards.
    return { kind: "needs-facts", guards: unknown };
  }
  const held = new Set(knownTrueGuards(facts));
  const result = productSpec.step(run.machine, run.state, input, held);
  return run.append({
    from: run.state, input, guardFacts: facts,
    to: result.to, cellId: result.cellId,
    sequence: run.nextSequence(), evidenceKind: "simulated",
  });
}
```

A missing guard in a fully specified synthetic fixture may mean false only under an explicit fixture convention. Live/replayed unknown evidence must not inherit that convention. For advanced exploration, enumerate unknown assignments under a cardinality budget and show multiple possible outcomes; that is exploration, not a recorded transition.

`step` does not compute altitude thresholds, execute `updates` field arithmetic or emit deadlines itself. Show those as external caller responsibilities. A virtual clock advances explicit scenario events; it cannot invent a deadline duration absent from declarations/adapter configuration.

Each run has an immutable bundle digest, fixture digest, seed, initial snapshot, ordered inputs and adapter versions. Editing the source while paused creates a new candidate run; old history remains bound to the old digest. Backward stepping restores a simulator snapshot only. It never rewinds a real device or undoes an external effect.

## 6. Mocking services and requests

Mock **owned boundaries**, not arbitrary edges that secretly bypass the owner being tested. Distinguish:

1. `Port fixture`: inject a typed value at a declared boundary to test downstream behavior. Upstream behavior is explicitly excluded.
2. `Fake service`: replace the existing service collaborator through its supported test seam. Contract checks still run.
3. `Recorded replay`: consume captured payloads only if a replay-capable, versioned codec exists.
4. `Live debug`: observe a real connected runtime. Write/injection capability is disabled until separately implemented and authorized.

```ts
interface Scenario {
  id: string;
  bundleDigest: string;
  seed: number;
  clock: "virtual";
  boundaryBindings: readonly {
    boundaryId: string;
    contractDigest: string;
    adapterVersion: string;
    fixtureId: string;
  }[];
  events: readonly ScheduledInput[];
  assertions: readonly NamedAssertion[];
}

async function executeMockRequest(request: TypedRequest, run: ScenarioRun) {
  const boundary = run.bindings.require(request.boundaryId);
  const codec = codecs.requireExact(request.contractDigest);
  codec.validateRequest(request.payload);
  const fixture = fixtures.resolveExact(boundary.fixtureId, request);
  if (!fixture) throw failure("No mock configured. External calls are disabled.");
  return run.scheduler.enqueue({
    at: run.clock.now + fixture.delayMs,
    tieBreak: run.nextSequence(),
    operationId: request.operationId,
    outcome: codec.validateOutcome(fixture.outcome),
  });
}
```

Opaque `valueRef` fields need product-owned fixture codecs; an ID alone is not enough to generate a valid payload. Artificial latency, out-of-order replies, timeout, disconnect, duplicate receipt and cancellation are explicit fixture behaviors. Test their actual adapter path; a visual animation is not a transport test.

Unmatched requests fail closed. No fallback to network, real filesystem mutation, live AI, account credentials, ADB injection or production data. Some existing SKYVW QA scenes explicitly use live services; do not include them in an offline scenario catalog merely because they are called QA.

A counterfactual branch can compare two policy versions on the same synthetic inputs. Show `Counterfactual`, not `Observed`. Assertions name independent expected behavior; copying simulated output into an expectation does not prove correctness.

## 7. Runtime evidence and debugging

Initial runtime support imports the existing SKYVW dump. Validate product/schema/artifact and product/graph hashes before overlaying it. Reuse existing decoder/verifier behavior instead of reconstructing hash rules in the UI.

```ts
function attachEvidence(bundle: InspectionBundle, dump: unknown): EvidenceView {
  const verified = existingDiagnosticVerifier.verify(bundle, dump);
  if (!verified.ok) return ui.refused("Snapshot does not match this build.");
  return {
    kind: "recorded-snapshot",
    takenAt: verified.takenAtMs,
    readings: existingPortClassifier.classify(bundle.product, verified.ledger),
    limitation: "Port activity, not source freshness or a complete trace.",
  };
}
```

The current ledger carries counts, first/last timestamps, mean period and last quality/summary. It cannot reconstruct every event, exact payload, transition, request/reply correlation or old lease state. Do not animate invented historical steps from aggregate statistics.

A future ordered trace adapter must record a run ID, per-instance sequence, monotonic clock domain, event kind, stable port/cell/operation identity, bundle identity, payload or redacted summary, and dropped-event counters. Wall time across devices is not a reliable total order. Version the trace independently; gaps remain visible. Full payload capture requires explicit privacy/size policy and a replay codec. Hash matching is not authentication.

Logical breakpoints pause isolated scenarios or pause the UI's reading of a trace. A real breakpoint in a native flight/recording process needs a dedicated safe debug runtime; do not block sensor loops with an editor breakpoint. A silent port is not automatically a defect, and recent delivery is not proof of fresh source data.

## 8. Interface preview and extension policy

The first Interface view is structural: artifacts, surfaces, component mounts and available body declarations. For an implemented web renderer, run its actual preview adapter with typed fixtures. For native code, use an explicitly connected debug/emulator preview and the existing scene owner. A generic DOM box is labelled `Schematic preview`.

The current HOME action body is a pilot, not proof that every Compose screen can be rendered in the browser. Extend previews by adding owned renderer adapters, never by recreating UI state in Studio. Apply to a device is a separate build/install action, not the meaning of `Save draft`.

Small additions likely needed: derived inspection bundle export, provenance/edit-capability index, supported source lenses, fixture codecs and runner adapters, and later bounded ordered trace hooks. These are tool/runtime boundaries, not a new grammar. No requirement to move all services, guards or algorithms into DSL expressions.

## 9. Technical references

Primary references consulted for tooling choices; they do not prove our implementation exists:

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API): AST, symbols, program and language-service facilities. Pin the compiler version; do not assume future major-version compatibility.
- [React Flow handles](https://reactflow.dev/learn/customization/handles): multiple named connection points. ProductSpec still validates semantic compatibility.
- [Monaco Editor](https://github.com/microsoft/monaco-editor): source editor component, not a ProductSpec semantic engine.
- [Recast](https://github.com/benjamn/recast): original-node-aware printing. A candidate only if minimal edits cannot cover the supported lenses.
- [Stately export](https://stately.ai/docs/export-as-code): inspiration for visual machines and code exchange. Our current emitter remains export-only; do not import arbitrary XState semantics into ProductSpec.

See [WORKERS](WORKERS.md) for the cases that must be proved before each capability is declared complete.
