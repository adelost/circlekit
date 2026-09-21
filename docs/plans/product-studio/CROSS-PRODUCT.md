# Cross-product usefulness and adapter acceptance

Status: **design and implementation requirements, not delivered integrations**.
Updated: 2026-09-21. All new documentation and GUI copy is English.
Read [README](README.md), [ARCHITECTURE](ARCHITECTURE.md), [UX](UX.md), then the applicable [worker card](WORKERS.md). This adds requirements to D0-D8; it is not another workstream or a new DSL.

## 1. Decision and boundary

Build **one Product Studio workbench with product-owned adapters and task-appropriate views**. Share the model explorer, selection, source provenance, table/machine tools, diagnostics, scenarios and changes UX. Reuse each product's real preview, document commands and execution owners. Do not create four copies of the workbench or force all products into SKYVW's state-machine screen.

Three capabilities are different:

1. Inspect the portion a product actually declares or exports.
2. Edit supported source expressions or issue supported document commands.
3. Execute/simulate the implementation through a supported adapter.

Using ProductSpec establishes none of the other capabilities automatically. A registered table can be simulated without a full product graph. A graph can be inspected without a native preview. A code leaf is valid and can remain opaque. A native renderer is not automatically executable in a browser. The UI must display the distinction for the selected object, not advertise universal visual editing.

The target is broader than a graph viewer: start from an ordinary product task, inspect its cause, change supported inputs or source, then see the actual supported result. The graph is one view of that task, not the mandatory interaction for everything.

## 2. Sources reviewed and existing assets

CircleKit main was rechecked at `464f432fab90947c26b0e170c0ed6014504b654d`. The video repository `adelost/ai-dsl` master was checked at `949a66fcecedc15dbc5b7d7410367f44713d2068`. SKYVW `be4a4685fbb1ee83b0847a7008b73fee4ad96e01` and AMUX `1413687782c83305455efd2e98c0ca36994568be` are the prior source baseline in README, not new live observations in this review. Recheck all active pins at D0.

| Source | What it establishes | Integration consequence |
| --- | --- | --- |
| CircleKit `showcase-product/src/product.ts` | `compileCircleKitShowcaseProduct` returns ProductIr plus `showcase.sections`, `showcase.cases` and release metadata; artifact profiles include Android, Apple and a limited Garmin scope | Load the original product and catalog extension. Do not redraw or flatten it into a second catalog. Declared profiles are not proof of installed previews. |
| CircleKit `README.md`, Using Showcase | Existing Phone/Wear laboratory, debug probe and DEV / STRUCTURE; actual APP UPDATE facility checks/downloads when enabled | Reuse real hosts; suppress or isolate update/network effects in fixture runs. A harmless demo does not make the whole host side-effect-free. |
| `ai-dsl/ui/scripts/lib/studio-activity-product.mjs` | Imports the real ProductSpec table and state-presentation APIs; six status values x two wait values x three phase values form 36 points and nine cells | A real, bounded third-product Logic fixture is already available. No need to wait for the whole video editor to become ProductSpec. |
| `ai-dsl/ui/scripts/generate-studio-activity.mjs` and `ui/package.json` | Published ProductSpec 0.3.65 pin, provenance checks and generated activity decisions consumed by the UI; frontend is Svelte | Do not require a React migration or import compiled Node dependencies into the browser blindly. The generated activity lookup carries output values, not a full observed decision trace. |
| `ai-dsl/docs/lego-lab.md` | Existing `#/sandbox`; catalog derives from TOOLS, WORKER_MANIFEST, OPERATIONS and flow contracts; distinct inspect/preflight/run modes, existing resolve path | Extend/integrate Lego Lab instead of creating a second block catalog, worker transport or scheduler. This is documentation of existing seams, not a live test of all routes. |
| `ai-dsl/docs/SYSTEM_MAP.md` | Backend owns job snapshots/timing; execution modes have distinct owners; UI submits intent through owned gateways | Route future execution through those current owners. Do not translate all Python behavior into a second ProductSpec job engine. |
| `ai-dsl/ui/src/lib/studio/editProjectState.js` | Project-keyed edit-session snapshots; montage playhead stored in integer frames, mounted playback authored in seconds; v1 snapshots are memory-only | Preserve media clock/frame meaning and dirty editor state. A saved layout or source Git commit is not a saved video project. |
| `ai-dsl/REPO_GUIDE.md`, Current Operating Contract | One designated coding writer and no new repository copies/worktrees; preserve WIP | Product Studio cannot treat source-edit isolation as permission to clone that repository or bypass its writer policy. |
| SKYVW source baseline in README | Product graph, recording machine, aggregate port ledger, QA scenes and native component-body pilot | Reuse those exact seams; distinguish recorded snapshot, synthetic scenario and native preview. |

These sources establish code/documentation boundaries, not installed-runtime correctness or completion of this handoff. No new product adapter or test execution is claimed here.

## 3. Four acceptance journeys, not four decorative dashboards

### SKYVW: Why did recording not start?

Open `recording.session` from System or Logic. Inspect the relevant input and guard facts, step the shared machine in Simulation, and show the exact cell or refusal. Jump to the source expression. Load a compatible port dump to compare actual activity without pretending aggregate counts are an event trace. Preview through the owned debug renderer only when that capability is connected.

**First complete task:** reproduce `ARMED + AltitudeObserved -> BUFFERING` through `gps-height` with supplied guard facts, explain why a changed fact prevents it, then inspect a validated source diff. Existing D2/D4 tests apply.

### Showcase: Does this component behave on the required surfaces?

Open the real component catalog as a searchable gallery in Interface. Each case opens its declared parameters, source, supported artifact scopes and available real preview adapters. Pin Phone and Wear side by side where supported. Use the same fixture identity across views, but preserve platform-specific layout and renderer versions.

A host capture must identify artifact, renderer/build, fixture, viewport and capture time. `Schematic preview` remains an honest fallback. A preview of Apple/Garmin is unavailable until its actual adapter is available, regardless of declarations or emitter filenames.

**First complete task:** inspect one existing control case, exercise its fixture through an owned host, compare Phone/Wear behavior and navigate from the case to its real declaration. A missing required host is not silently removed from the requirement. The case must prove the real behavior it claims, not only that two images appeared.

### Video editor: Why is this analysis waiting, and what result am I applying?

Enter from the existing editor or Lego Lab with an exact workspace/source/clip/job selection. Logic can show the existing `ai-tools.studio-activity` table: `status=queued, wait=resource` yields the `waiting-resource` cell, mapped by the existing presentation to `waiting_resource`. Source/media preview stays in the real video renderer, not a new generic player.

System shows a worker/artifact dependency slice derived from the backend manifest. It is explicitly an external catalog facet, not a claim that the Python engine has become ProductSpec. Scenarios can preflight or inject a supported fake boundary; they do not resubmit GPU/model work while the user scrubs.

**First complete tasks:** inspect a selected blocked job using canonical status plus recorded reason when present; preflight one existing Lego Lab block with zero paid execution; select its resolved artifact at the correct source frame. Later document changes use the editor's command/undo owner and named compatibility checks, never an AST patch or a new undo stack.

### AMUX: Why is this delivery or model transition blocked?

Open the actual policy facet with separate `Raw observations` and `Policy facts` panels. Show the exact deciding cell for a simulated point. An operational queue/lease reason comes only from a supported evidence adapter; the table does not know who holds a real lock.

**First complete task:** compare the same facts on the current and proposed table in Simulation, retain exact cell identity and source revision, and produce no compact, launch, resend or provider call. Existing D2 table tests apply.

These journeys define usability acceptance. The old HTML storyboard still demonstrates only the SKYVW example; it does not pass any cross-product integration acceptance.

## 4. Small adapter contract, not a plugin platform

Extend the existing InspectionBundle/Facet contract only as needed. Keep `ProductIr | null`: standalone tables and foreign catalogs must not require a fabricated full ProductIr.

A product-owned adapter supplies references to real exports/artifacts, provenance, registered decoders, available preview/test seams and writable operations. These interfaces are proposed pseudocode, not ProductSpec exports:

```ts
interface StudioAdapter {
  id: string;
  version: string;
  inspect(snapshot: AuthorizedSnapshot): Promise<InspectionBundle>;
  support(selection: SelectionRef, context: ViewContext): CapabilityReport;
  prepare(operation: RegisteredOperation, base: RevisionSet): Promise<Proposal>;
}

interface SelectionRef {
  workspaceId: string;
  productId: string;
  bundleDigest: string;
  facetKind: string;
  entityId: string;
  instanceId?: string;
  documentId?: string;
}

type OperationTarget =
  | { kind: "source-draft"; lensId: string }
  | { kind: "product-document"; commandId: string }
  | { kind: "scenario"; fixtureAdapterId: string };
```

`RegisteredOperation` is an allowlisted adapter action with a validated payload. It is not arbitrary shell text, a URL to execute, a function serialized in a bundle or a second generic effects language. Existing source-origin capability remains the authority for a source field.

Each selected item explicitly reports support for inspection, source editing, document commands, pure simulation, fixtures, observation and preview. Use `available`, `blocked` with an English cause, or `unsupported`. A declaration of availability is still not proof a renderer is currently connected or a command is authorized. Check prerequisites on invocation at the owner boundary.

Keep built-in ProductSpec facets on the shared codec/kernel. Foreign facets use a namespaced schema ID, schema version and bounded payload/reference, decoded by an explicitly registered trusted adapter. Unknown schema means metadata-only inspection with `Adapter required`, not execution or a silent empty graph. A new product using already-supported shapes must not require a new product-specific branch in the Studio core.

Generated product extension data, such as the Showcase catalog, remains intact. Adapter registrations name codecs and relationships; they do not duplicate cells, ports, worker dependencies or component definitions. Do not auto-load executable plugins from imported project data. Prove two real adapters before adding extensibility machinery beyond this contract.

## 5. Same workbench, different representation

Keep the existing five views and the shared selection/source/diagnostic language. Choose the useful representation from supported facets:

| Facet/task | Representation |
| --- | --- |
| Product dependencies, typed ports | Scoped node graph and searchable list |
| Finite policy | Matrix/rows plus exact point inspector |
| Lifecycle | State-transition graph and supplied facts |
| Showcase cases | Gallery, property inspector and preview comparison |
| Media artifacts/results | Owned frame/track/mask/timeline viewer with source identity |
| Job/attempt evidence | Status/reason table and ordered trace only when recorded |
| Source/document change | Appropriate diff and owner-specific Apply/Save action |

A thumbnail, waveform, mask, 360 view or native component is a product renderer contribution over a real artifact/fixture. Do not implement a universal media or native renderer merely to place something inside a node card. Generic JSON inspection remains a fallback, not the entire media UX.

Add `Inspect in Product Studio` at useful existing selections: a selected component, failed test, chosen video job/artifact, or policy decision. Start with a standalone workbench and an exact deep link. A docked/embedded inspector can follow using the same built UI and protocol. Do not port the workbench to React and Svelte independently or rewrite the Svelte editor for embedding. The existing React Flow suggestion is not a mandate to migrate consumers; D0 selects the shell once.

A selection link carries identifiers/revisions, not credentials, local absolute paths, video bytes or private logs. If a host-window bridge is later used, use exact origins, verify source window and schema, and scope a revocable session to the allowed product/workspace. Messages from arbitrary pages cannot request source writes or live execution. MDN's postMessage guidance is linked below.

## 6. Source code, video documents and scenarios are different write owners

The earlier source-draft workflow applies to supported DSL code changes. It is not the default persistence model for every product object.

| Editing target | Owner | Successful result means |
| --- | --- | --- |
| ProductSpec source | Repository's allowed source-edit workflow and compiler | Validated source change/draft, not deployed product |
| Video timeline/recipe/project | Existing editor command, document revision and undo owner | Domain edit accepted at its owner; durability reported separately |
| Scenario/fixture | Studio scenario document | Synthetic inputs changed, not application state |
| Canvas layout | Studio workspace preferences | View changed, no semantic change |
| Native/live process | Runtime owner, separately authorized action | Only the observed receipt, never implied by Save |

For ai-dsl, do not create worktrees/clones under ARCHITECTURE's isolated-draft wording. Use the existing permitted source-preview/edit mechanism, or read-only inspection plus a reviewable patch through its designated writer. In-memory supported text edits may be a preview mechanism, not a new full repository copy. Product-document edits stay with the actual editor. If an owner cannot apply safely, report that limitation; do not bypass it.

A declaration may own rules for a video command without becoming the document store. Changing a selected clip is not changing the application's DSL implementation. This distinction must be explicit in the GUI action label.

```ts
async function prepareChange(request: ChangeRequest): Promise<Proposal> {
  const adapter = registry.requireTrusted(request.adapterId);
  const base = identity.requireMatchingSelection(request.selection);
  const capability = adapter.support(request.selection, request.viewContext);
  requireSupportedAndAuthorized(capability, request.operation);
  // The adapter routes to a known owner/lens, not a global catch-all writer.
  return adapter.prepare(request.operation, base.revisions);
}

async function applyProposal(id: string): Promise<OwnerReceipt> {
  const proposal = proposals.require(id);
  const owner = owners.require(proposal.ownerRef);
  // Recheck at mutation; a UI preview or disabled button is not concurrency control.
  return owner.applyWithCurrentRevisionChecks({
    operationId: proposal.operationId,
    payloadDigest: proposal.payloadDigest,
    expectedRevisions: proposal.expectedRevisions,
    payload: proposal.payload,
  });
}
```

Reuse an existing atomic apply facility where it exists; the pseudocode is not evidence one exists for every owner. Same operation ID plus different input is a conflict. A lost reply is resolved from the owner's receipt where supported, not automatically repeated. Memory-only editor snapshots are not reported as saved to disk. Preserve dirty state when changing projects and label document-history versus source-draft undo separately.

## 7. Identity, clocks, large data and evidence

There are at least four separate identities to correlate: source/compiled revision, runtime session/instance, scenario/run, and product document/media revision. A Git SHA alone does not identify a changed video edit or an old running app. Scope selections by product and workspace as well as local entity ID. Two products may both have a node called `settings` without sharing it.

Use existing owner version/generation fields instead of inventing one universal token that invalidates everything. A result from source A may remain valid in A's cache after the user selects B; it must not enter B's inspector. For A -> B -> A, distinguish the new selection generation from the old in-flight request.

```ts
async function inspectSelected(selection: SelectionRef) {
  const ticket = view.beginSelection(selection); // generation, not just entity ID
  const result = await adapters.inspectEntity(selection);
  if (!view.isCurrent(ticket)) return; // do not publish into another selection
  requireSameArtifactIdentity(result, selection);
  view.show(result);
}
```

Cancelling an old request is an optimization, not the correctness test. Durable job outcomes remain with the backend even if a UI request is cancelled.

Distinguish wall time, monotonic runtime time, virtual scenario time, source-media time and montage frames. Store/transport their kind and authoritative conversion data. The video code already stores integer montage frames while the mounted engine uses seconds. Never assume constant frame rate, reuse the current playhead for a prior clicked frame, or equate one frame across differently trimmed clips. A 360 coordinate or mask must retain the source/projection/orientation identity its owner requires.

Keep media and large traces behind bounded artifact references with lazy, scoped resolution. Do not put whole videos, full-resolution masks or unbounded journals into the graph JSON. Preserve supplied truncation/dropped-event information. Query only the focused slice; rendering a smaller graph must not manufacture a claim of complete program coverage.

Keep the five evidence modes in UX.md. In particular:

- Real-case definitions and conformance expectations are not native execution receipts.
- A generated lookup value is not an observed deciding-cell trace. Simulation can call the actual table to obtain its cell; runtime correlation requires actual provenance.
- A port dump with counts/latest summary cannot provide historical event order or source freshness.
- Any recorded/live payload is redacted/bounded at its owner; private media and transcripts are not shipped to a third-party diagram service by default.

## 8. Mocking and previews without accidental work

Distinguish `Inspect`, `Preflight`, `Simulate`, `Preview`, and `Run real operation`. They must not share a button whose behavior changes silently after connecting a runtime.

Offline scenarios have no fallback to live worker/GPU/network/model calls. Mock upstream output to test downstream behavior only when that exclusion is shown. Prefer the existing Lego Lab preflight and resolve seams for video; inspect-only operations remain inspect-only. Do not create new workers or second progress/retry heuristics inside Studio.

Showcase needs special care: its documentation identifies a real APP UPDATE facility with default automatic check/download behavior. Opening a native host can have effects outside the selected harmless case. Establish a tested no-network fixture host configuration or sandbox before claiming `No external calls`. Do not reconfigure the user's installed app as a side effect of opening the workbench. The same rule applies to any QA scene containing explicitly live operations.

Real execution, native installation, sending data and quota-consuming work require the existing product authorization path and a visible effect summary. A connected transport or adapter availability is not such authorization. The documentation work here performs none of those actions.

## 9. Amendments to D0-D8 and proof of usefulness

Do not add nine more infrastructure phases. Amend the existing cards:

- **D0/D1:** include Showcase catalog and the actual video activity table as cross-product fixtures beside SKYVW and AMUX. Probe installed versions separately. No hardcoded product name is required in core selection, graph, error or table handling.
- **D2:** exercise the 36 video table points using the real installed kernel and an independent `queued/resource -> waiting-resource` case. Keep the distinction between finite classification and real worker scheduling.
- **D3-D5:** identify source versus document ownership before offering edits. Test the ai-dsl no-copy/writer-policy boundary and preserve WIP. Do not require document edits to go through Git.
- **D6:** reuse Lego Lab's appropriate preflight/fake seam and validate artifact resolution. Keep live routes outside offline simulation.
- **D7:** scope job/device evidence by build, document and session as applicable; test delayed selection results and A-B-A.
- **D8:** one actual Showcase fixture through its host and one existing video artifact/frame viewer. Real preview requires real renderer evidence. Broader surfaces come only when supported.

| Acceptance ID | Required observation |
| --- | --- |
| CROSS-01 | SKYVW and Showcase load through the same core without losing Showcase extension/catalog data. |
| CROSS-02 | AMUX and video table-only adapters work with `product:null`; no fake application graphs or private evaluator copies. |
| CROSS-03 | A fifth fixture product using supported facet schemas registers without edits to shared view/kernel behavior. Unknown schemas are visibly unsupported. |
| CROSS-04 | Identical local IDs in two workspaces/products do not share selection, edits, overlays or history. |
| CROSS-05 | Source edit, video-document edit, scenario edit and canvas move route to the correct distinct owner. Canvas move changes zero program facts. |
| CROSS-06 | Late A/B/A responses cannot overwrite the active inspector or current document; an old valid result can remain in its owner's cache. |
| CROSS-07 | One actual Showcase case has matching fixture/build identities across required connected previews; absent renderer is unavailable, not green. |
| CROSS-08 | One video preflight and artifact view reuse the current catalog/gateway/resolver, with no second scheduler and zero model/GPU calls. |
| CROSS-09 | A mock miss, automatic updater or live QA step cannot leak external effects into offline mode. Verify the real boundary, not only a mock counter. |
| CROSS-10 | Clicked source-frame identity survives a scrub; media time/frame conversions use owner data and correct source/document revisions. |
| CROSS-11 | A valid source change reaches its compiler; a valid video change reaches its existing undo owner; stale/ambiguous applies preserve both source/document and evidence. |
| CROSS-12 | English labels explain unsupported preview/edit/simulation capabilities and distinguish persisted, draft, memory-only, simulated and observed states. |

These are acceptance requirements, not tests executed by this documentation review. Implement one small shared vertical slice, then validate a different product before expanding the first product's editor features. Showcase is the next full-product consumer; the video and AMUX policy tables are inexpensive early checks against SKYVW-specific assumptions. Native preview and domain-document writes remain later capabilities.

## 10. Scope controls and technical references

Not selected: a plugin marketplace, four frontend rewrites, a generic GPU scheduler, a new project-document/undo format, whole-program inverse compilation, or transferring all Python/native logic into TypeScript. Do not make a framework-wide migration a prerequisite to a useful inspector.

This work adds an inspection/adapter protocol and product integrations. Only a specific missing semantic shape should change ProductSpec, with its existing ownership and laws. Basic graph inspection does not need another language revision.

Primary tooling references, not proof of our implementation:

- [xyflow](https://xyflow.com/) exposes React and Svelte node-editor libraries. Select the shared shell's renderer once; consumer framework is not a reason to fork semantics or duplicate the complete workbench.
- [MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) explains exact target origins and validation of sender/source/data for embedded-window communication. An embed is not a security boundary for native execution.

**Completion boundary:** this document makes cross-product behavior explicit. No adapter, actual editor integration, native preview, mock transport or cross-product acceptance test was implemented or run in this review. The result to implement is one reusable workbench connected to real product owners, not a standalone picture of each product.
