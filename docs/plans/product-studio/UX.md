# Product Studio UX specification

Status: proposed product experience. The accompanying [concept.html](concept.html) is a disconnected English design reference. It plays a short scripted example; it does not parse a repository, call ProductSpec, write source, contact a device or run a provider.

All product-authored copy is **English**: navigation, controls, tooltips, empty states, diagnostics, accessibility names, sample descriptions and documentation. Show original source identifiers and raw imported logs verbatim; do not silently translate evidence or turn translated names into a second identity system.

## 1. Visual direction

A focused engineering workbench, not a marketing dashboard. Near-black canvas, quiet blue-gray panels, high-contrast text, restrained cyan for selection, purple for simulation and amber for uncertainty. Errors include an icon and text, never color alone. Keep user controls distinguishable from simulated product controls. Avoid decorative metrics, fake green checks and animated edges without actual events.

Default desktop arrangement:

```text
+ Project / revision -------- System | Logic | Scenarios | Interface | Changes -- Mode +
| Explorer            | Breadcrumb / selected scope                | Inspector        |
| Search              |                                           | Properties       |
| Domains / machines  | Domain graph, table or machine canvas      | Why / Source     |
| Tables / components |                                           | Capability       |
| Saved scenarios     |                                           | Evidence         |
|                     | Timeline / inputs / source diff            |                  |
+ Source identity ---- Draft / validation status ---- Runtime disconnected ----------+
```

Graph position is workspace metadata, not program order. Preserve the user's view when values update. Use semantic zoom: domains first, then node/port detail on selection. A focused slice can be legible without claiming the rest of the program is absent. Always show the scope filter and hidden-element count when known.

At narrow widths, use one main panel with Explorer and Inspector drawers. Do not shrink six columns into unreadable text. Diagram manipulation is desktop-oriented; source, evidence and read-only inspection remain accessible on narrow screens.

## 2. Navigation and view responsibilities

| View | User question | Main representation |
| --- | --- | --- |
| System | What is connected, and who owns the value? | Domain clusters, typed ports, explicit edges, upstream/downstream slice |
| Logic | Why did this decision or transition occur? | Table matrix or state machine, exact facts, selected cell |
| Scenarios | What happens with these inputs or failures? | Input/fixture editor, deterministic sequence, assertions and comparison |
| Interface | Where is it mounted and what can I preview? | Artifact/surface composition, supported body preview or native adapter |
| Changes | What will my edit change? | Source diff, compiled semantic diff, diagnostics and guarded save |

A global selection is a stable declaration/port/cell ID. Selecting in the graph highlights the same source and inspector entry, not an independently named GUI object. Project selection changes the scope: SKYVW and AMUX do not become connected merely because they share a language.

## 3. Persistent evidence mode

Exactly one primary mode is visible at all times:

| Mode label | Meaning | Primary controls |
| --- | --- | --- |
| `Declared` | Validated structure, no runtime claim | Inspect, edit draft, open source |
| `Simulation` | Synthetic inputs through a supported simulator | Step, pause, reset, branch scenario |
| `Recorded snapshot` | Verified historical dump with aggregate observations | Inspect counts/quality, no invented event playback |
| `Recorded trace` | Ordered events from a compatible trace adapter | Step through captured events; gaps visible |
| `Live observation` | Authorized current debug connection | Read-only observation initially |

Paused simulation is still Simulation. A frozen captured dump is not Live. A changed source digest invalidates old overlays until the user selects the matching build. `Run scenario` never means `Run production`.

## 4. Primary journeys

### A. Understand the recording path

Open SKYVW, System. Search `recording`. Display declared incoming pressure/position bindings and downstream consumers. Open the associated `recording.session` facet with a label identifying its adapter association if that relation is not in ProductIr.

In Logic, show STOPPED, ARMED, BUFFERING and RECORDING with 17 declared cells. Collapse or filter edges deliberately; the reference shows a three-transition focus, not the whole machine. Selecting `gps-height` reveals:

```text
From: ARMED
Event: AltitudeObserved
To: BUFFERING
Requires: AUTOMATIC, ABOVE_GPS_HEIGHT
Forbids: LEASE_EXPIRED, ABOVE_RECORDING_HEIGHT
Source: appspec/products/skyvw/jumps/recording-machine.ts
```

The inspector has separate **Definition** and **Scenario facts** sections. Editing a required guard is a DSL draft change; toggling a synthetic guard value only changes a scenario. Do not use an unlabeled toggle that could mean either.

### B. Ask why it did not start recording

Load a fixture, send `AltitudeObserved`, and inspect `Why this result?`. Show the exact observed/synthetic facts, chosen cell or no-match outcome, and mismatching conditions for alternative cells. Unknown guards show `Unknown`, never a default false checkbox.

A breakpoint pauses before a simulated transition. The selected event is tied to a run sequence and bundle digest. The UI should let the user branch a counterfactual with a changed guard while preserving the original run. No real process is paused or rewound.

### C. Edit a rule without losing the code

Choose an editable literal field. Update it in the property editor, receive local validation, then `Review diff`. Show source changes, affected declarations, changed compiled outputs and any new hole/overlap or unreachable-state diagnostics.

For a shared constant, show `Shared value: affects N declarations` only when N was resolved. Offer `Edit shared source`; do not materialize independent copies. Unsupported source displays `Visual editing is not supported for this expression. Open source instead.`

The draft can remain invalid while the user works. `Save validated draft` stays disabled until the real compiler accepts it. Applying a stale proposal displays a conflict and preserves both edits. A successful save shows branch and commit, not `Deployed`.

### D. Mock a request or a delayed result

Select a service boundary, inspect its actual contract, select an owned fixture adapter, and choose success, error, delay or cancellation only when that adapter supports it. Display both what is replaced and what remains real.

`Port fixture` means upstream behavior is excluded. `Fake service` means the service's supported test collaborator is replaced. Opaque payloads without a codec display `Fixture adapter required`. An unmatched request stops the scenario with `No mock configured. External calls are disabled.`

Save scenario inputs and independent assertions. The reproduction includes product digest, seed, adapter versions and event order. Do not capture secrets or private payloads by default.

### E. Create a small application visually

`Add from catalog` shows implemented node/component types with required configuration, ports and supported platforms. Drag to place, connect ports explicitly, choose mounts, configure a table or machine and validate.

A new code leaf can be declared but is marked `Implementation required`. It is not runnable until its implementation and conformance evidence exist. A declared UI is not pixel-accurate merely because the graph compiles. This is progressive visual assembly, not automatic synthesis of unknown algorithms.

### F. Inspect a real debug dump

`Import snapshot` validates identity before showing data. Nodes can read `Recent delivery`, `Seen earlier`, `Active, no recorded delivery`, or `No observed activity`, with the raw quality summary shown separately. Recency is evaluated against capture time.

Do not show a historical event timeline from count-only snapshots. `Trace not available in this snapshot` is a first-class state. `Open matching build` is the action for an identity mismatch; ignoring the mismatch is not an option.

## 5. Exact English copy contract

Implementation should place shared GUI copy in one existing/local English copy module rather than scatter alternatives across components. Do not add translation infrastructure as a prerequisite.

| Key | Text |
| --- | --- |
| app.title | Product Studio |
| nav.system | System |
| nav.logic | Logic |
| nav.scenarios | Scenarios |
| nav.interface | Interface |
| nav.changes | Changes |
| search.placeholder | Search nodes, ports or rules |
| action.step | Step event |
| action.reset | Reset simulation |
| action.branch | Branch scenario |
| action.review | Review diff |
| action.save | Save validated draft |
| action.source | Open source |
| action.why | Why this result? |
| action.catalog | Add from catalog |
| action.mock | Configure mock |
| mode.declared | Declared |
| mode.simulation | Simulation |
| mode.snapshot | Recorded snapshot |
| mode.trace | Recorded trace |
| mode.live | Live observation |
| state.disconnected | No runtime connected |
| state.draft | Draft changes |
| state.stale | Out of date |
| state.unknown | Unknown |
| state.unsupported | Unsupported |
| error.sourceConflict | Source changed. Review a refreshed diff. |
| error.identity | Snapshot does not match this build. |
| error.mockMissing | No mock configured. External calls are disabled. |
| error.payload | Fixture adapter required for this payload type. |
| error.unknownGuard | Supply the missing guard facts before stepping. |
| error.visualEdit | Visual editing is not supported for this expression. Open source instead. |
| empty.trace | Trace not available in this snapshot. |
| preview.schematic | Schematic preview |
| preview.native | Native debug preview |
| state.noImplementation | Implementation required |
| disclosure.prototype | Scripted design reference. No compiler, repository or runtime connected. |

Raw diagnostics from compilers/providers can be preserved verbatim and wrapped in English product copy. Do not make a translated paraphrase replace the original cause or deciding cell.

## 6. Keyboard and accessibility

All node selections, property edits and connections need keyboard alternatives. Provide a searchable list/tree and `Connect port` dialog beside pointer-based dragging. Escape closes a drawer without applying edits; focus returns to its trigger. Text inputs retain native selection and editing behavior.

Use visible focus, labeled buttons, semantic headings, readable minimum text sizes and non-color status cues. Test contrast rather than assuming dark mode guarantees it. Respect reduced motion. Never announce every high-frequency port update through a live region; aggregate and announce user-relevant state changes.

Tooltips explain but do not hold essential information exclusively. Screen-reader output names node kind, stable identity, selection and status. Pan/zoom does not change the selected program state. Large graphs use scoped rendering; a virtualized list still exposes search and reachable selection.

## 7. Prototype contract

The English HTML reference is intentionally smaller than the implementation plan. It demonstrates the workbench layout, view switching, inspector/source selection, a scripted four-state recording path and a clear disconnected/mock boundary.

Any disabled control is accompanied by a visible capability explanation. Sample timings are explicitly synthetic. The source excerpt is the real `gps-height` cell at the reviewed SKYVW SHA; the surrounding visual layout is proposed. The prototype must not claim it imports code, validates all rules, edits a repository or runs an emulator.

If a generated image conflicts with this document, current source and this English copy contract win. Future screenshots should be captured from the implemented interface/reference rather than treated as compiler evidence.
