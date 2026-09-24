# Semantic CLI

These read/debug commands use the same `Workbench` as the GUI. Agents keep editing normal source with their existing tools. This is not another editor, DSL, runtime or MCP server. All commands below require the normal locked dependencies, except `--help` and argument-only diagnostics.

`v1d-studio export [repository] [--product ID]` explicitly compiles one workspace
project with `bundle` and `authoring: { entry, exportName, files, kind? }`.
Studio derives the nearest unambiguous installed ProductSpec; an explicit `kernelRoot` selects another product-owned package when needed.
Only the declared bundle is written; opening the viewer never runs this command.

## Start with the bundled examples

From `product-studio`, after installing with `npm ci`:

```bash
node bin/studio.mjs --help
node bin/studio.mjs inspect --examples --product workflow-example --pretty
node bin/studio.mjs simulate --examples --product workflow-example \
  --facet example.request --input '{"state":"IDLE","input":"Send","guards":{}}'
node bin/studio.mjs simulate --examples --product amux-fixture \
  --facet amux.context-cost \
  --input '{"facts":{"need":"UNKNOWN","readiness":"SAFE","attempt":"NEW"}}'
```

Expected finite results: `IDLE -> PENDING` through `send`, and AMUX `HOLD` through `unknown-evidence`. These are examples/fixtures, not connected applications. The CLI never silently replaces a missing real workspace with examples.

Install the local command as described in [README](README.md#start), then use `v1d-studio` from a product root. The explicit `node /path/to/circlekit/product-studio/bin/studio.mjs` path also works. Avoid `npm run` banners when parsing stdout: call the executable directly.

## Attach a real product

Existing `studio.workspace.json` versions 1 and 2 and existing product path presets remain supported. Generated inspection bundles are preferred; [INTEGRATION](INTEGRATION.md) describes the product-owned export.

```bash
node bin/studio.mjs doctor /path/to/product --pretty
node bin/studio.mjs inspect /path/to/product --search recording --max 50
```

Without a repository argument, read commands inspect the current directory. Several products require `--product`: choose a manifest ID, product ID, or an exact workspace `key` returned by `doctor`. If a name is ambiguous, the error includes choices. Repeated `--workspace /path` attaches more roots without cloning anything.

Every semantic result carries `schemaVersion: 1`, `ok`, `command`, product/model/view identity, producer/evaluator versions, scope, diagnostics, limitations and a command-specific result. An early argument/load failure may not yet have product identity. No source text is included in the discovery index by default.

## Ask the architecture

Copy exact entity keys from `inspect`; do not derive them from display text. These illustrative keys must exist in the selected app:

```bash
node bin/studio.mjs query /repo --kind upstream --from 'node::recording.runtime'
node bin/studio.mjs query /repo --kind downstream --from 'node::recording.runtime'
node bin/studio.mjs query /repo --kind consumers --from 'port::sensor.sample'
node bin/studio.mjs query /repo --kind owner --from 'port::sensor.sample'
node bin/studio.mjs query /repo --kind path \
  --from 'node::producer' --to 'node::consumer' --purposes data
node bin/studio.mjs query /repo --kind impact --from 'facet:machine:recording.session'
node bin/studio.mjs source /repo --entity 'facet:machine:recording.session'
```

`upstream`, `downstream`, `consumers`, `owner`, `path`, and `impact` reuse existing architecture queries. The default edge purpose is `data`; add `--purposes data,demand,context` explicitly. Exact boundary ports remain exact. Reachability through an owner is potential dependency, not evidence that its implementation used an input on a particular execution.

`source` returns actual provenance and its edit classification, not source writes. A saved model is not relinked to changed code merely because the same ID is still present. Missing/stale mapping is a refusal. A facet with no exported owner association has unknown wider impact, not an invented path.

Impact traversal stops at depth 20 or 1000 owners and marks the result truncated when further consumers may exist.

## Review, plan and converge

```bash
v1d-studio review /repo
v1d-studio plan /repo --changed src/recording.ts --changed 'node-type::recording.session'
v1d-studio converge /repo --product my-product
v1d-studio converge /repo --product my-product --tasks
```

`review` composes the Git change (or explicit `--changed`), `plan`, WHAT/WHY, `converge` and source identity into Markdown without running code. It exits 0 when the report is produced, even for an empty diff; contradictions remain explicit in RESULT. `plan` is the narrower Markdown primitive. A ProductIr facet must declare `ownerNodeTypeRef`; plan follows that owner through its instances to declared consumers. Standalone facets without an owner show `owner not declared`. Only loaded owners, ports, consumers, facets and tests appear; unknown source mappings stay explicit. `converge` reads existing laws, contracts and traces without running tests or generators. It exits 0 for Converged, 1 for Diverged and 2 for Unknown; `--tasks` includes one task per known contradiction.

## Bound the output

```bash
node bin/studio.mjs inspect /repo --fields key,id,kind --max 50 --offset 0
node bin/studio.mjs inspect /repo --entity 'node::producer' --pretty
```

Discovery supports `--search`, `--fields`, `--max 1..1000`, and `--offset`. The response reports total, returned count, next offset and truncation. `--fields` projects index rows only; it cannot remove identity, errors or limitations from the envelope. Exact `--entity --json` inspection returns the object, ports, source metadata, direct relationships, and the existing plan/review projections with declared owners, consumers and known tests in one response.

Trace event lists also support pagination. Query paths and causal chains are not silently cropped. A result over 8 MB is refused with a request to narrow the query. Paging is over the loaded snapshot; a new process reloads sources. Use `--expect-model <modelDigest>` to ensure a follow-up command targets the same model.

## Simulate a point or an event

Input can be a quoted JSON object or `@file.json`. File paths are relative to the caller's current directory, not the selected repository; absolute paths also work. Files are size-bounded ordinary JSON files, never executable scripts or URLs.

```bash
node bin/studio.mjs simulate /repo --facet my.policy --input @facts.json
node bin/studio.mjs simulate /repo --facet my.machine --input @step.json
```

Table input:

```json
{"facts":{"permission":"ALLOWED"}}
```

Machine input:

```json
{"state":"IDLE","input":"Send","guards":{}}
```

Use the selected declaration's actual axes, states, inputs and guards. The machine example works for the bundled request lifecycle; it is not an instruction to rename an application's states. Unknown relevant guards stop the operation. Undeclared input fields cannot override the selected product/facet/revision. A known evaluator mismatch blocks simulation; there is no force flag.

This evaluates a finite model, not the controller, sensors, HTTP service, native updates or provider. Producer/version information missing from legacy artifacts remains missing; revalidation by the local kernel is not proof of the original runtime version.

## Run scenarios

```bash
node bin/studio.mjs scenario /repo --file scenario.json
```

The file can be a raw existing scenario with its exact current `bundleDigest`, or a saved `product-studio-scenario` version-1 document. Saved documents must match the exact `modelDigest` and `facetId`; only then is their view digest rebound. No silent copying of assertions to a different logical model occurs.

A minimal raw scenario, using identity copied from `inspect`:

```json
{
  "facetId": "example.request",
  "bundleDigest": "REPLACE_WITH_CURRENT_BUNDLE_DIGEST",
  "events": [
    {"atMs":0,"input":"Send","guards":{},"expect":{"to":"PENDING","cellId":"send"}}
  ]
}
```

Time is virtual and ordered. `expect` is an independent expected result; `{}` is not a test. A run with no assertions returns `pass: null` and `assertionStatus: "unasserted"`. That is a successful computation, not a proven behavior. Failed expectations and missing facts fail the command and retain the available result for diagnosis.

The CLI does not save scenarios or drafts. Use an existing saved/exported file or the GUI's existing scenario owner.

## Inspect recorded traces

Run one existing focused test through Studio to capture declared execution without hand-writing entity keys, digests or output paths:

```bash
v1d-studio record /repo --product my-product
# Explicit override when needed:
v1d-studio record /repo --product my-product -- npm test -- path/to/focused.test.mjs
```

`recordCommand` is a workspace-owned argv list, not a shell string, and never runs when Studio opens. The command passes a private `V1D_STUDIO_TRACE_DIR` and Node's `studio-trace` package condition to the child. Vitest needs `ssr.resolve.conditions` selected when that variable is present; Vite SSR tests with external ProductSpec imports also need `ssr.resolve.externalConditions`. Generated Kotlin emits only in debug test runs and its release bytecode has no trace call. Studio refuses a failed command, no events, unknown cells or ports, and a model mismatch without replacing the previous trace. A successful run writes the convention-named trace atomically. This test-run evidence does not claim a live device or service session.

```bash
node bin/studio.mjs trace /repo --file capture.trace.json --cursor 12 --pretty
node bin/studio.mjs trace /repo --file capture.trace.json --operation request-7 --max 100
```

The existing trace decoder verifies product/model identity and sequence accounting. `--cursor` is a zero-based position in the whole capture, not a filtered row or sequence number. `-1` means before the first event. Activity is accumulated through the cursor; search and pagination browse the entire capture. An absent `--cursor` selects the last event.

The result includes explicit causal links, missing ancestor sequence, declared gaps, synthetic/recorded origin and the GUI's finite-result comparison. An incomplete recorded outcome is unknown, not automatically a contradiction. Real contradictions remain visible.

`causalPathComplete` means all explicitly named ancestors were retained. It does not prove the producer recorded every real cause. An event without `causedBy` is a one-event explicit chain, not evidence that it had no cause. Snapshots containing counts are not event traces. No live process is paused or replayed.

## Optional local runtime receiver

`v1d-studio serve /repo --live` enables a separate read-only WebSocket receiver on the same literal-loopback port. Ordinary `v1d-studio` has no runtime route, does not attach a device and starts no product. Trace can freeze an immutable cut while the producer continues, export it under a distinct `.studio-trace.json` name, and reopen it with Import trace. The browser download never targets the conventional test report.

`v1d-studio live --json` discovers the already-running local receiver through a private same-user receipt, then uses only its separate read token. With several captures, select `--session ID`; `--max` and `--offset` page events, and `--cut DIGEST` refuses a changed live cut instead of mixing pages. A frozen ID remains stable. `v1d-studio live --session ID --freeze --output saved.studio-trace.json` explicitly saves one cut inside the current directory, atomically and without replacing an existing file, symlink or `test-results` report. No live CLI read starts Studio, pairs a producer or controls an app.

For the installed SKYVW debug app only, `v1d-studio live connect --device SERIAL [--port PORT]` checks exactly one authorized device, an unused `adb reverse` port and `run-as` debug access before pairing. It never installs an APK or replaces an existing mapping. The one-time ticket goes to `files/studio-observation/ticket` through `run-as` stdin, never an argument or broadcast extra. The start action carries only the port. The command reports staged, not connected; verify the receiver separately. If the installed app is not debuggable, run the exact `:app:installDebug` command printed by the refusal from the SKYVW checkout.

The authenticated HTTP operation `POST /api/live-ticket` selects one loaded workspace and a `node`, `native` or `browser` producer. A browser ticket also names its exact local HTTP Origin. It issues a 256-bit ticket valid for 120 seconds. The browser's normal same-origin Studio token protects this operation. The WebSocket upgrade at `/runtime/v1` checks loopback Host, a local browser Origin or absent Origin for native/Node, no query or cookie, and the `v1d-runtime.v1` subprotocol. The first JSON `hello` must present that ticket within five seconds; a browser Origin must match its ticket exactly. A ticket is consumed once, including when the producer reports the wrong model. The receiver accepts no source read, write, command or application-control messages from it.

`hello` names the compiled product ID, exactly one model digest or artifact SHA-256, the producer ProductSpec version, a fresh capture ID and the declared event/facet scope. A matching build receives `welcome` and a receiver-only reconnect credential. Ordered `batch` messages carry up to 128 raw observations plus explicit dropped ranges and a final `through` watermark; `ack` means only that Studio retained the validated batch in memory. A clean `end` names the final acknowledged watermark. Abrupt disconnects keep an interrupted segment with unknown tail. Reconnection starts a new capture ID and preserves the older segment. A trace v2 event says `evaluated`, `applied` or `returned`; evaluated never asserts a committed state. Only a real owner-side applied event can do that, and loss breaks the visible state path.

The live boundary permits declared IDs, finite decision facts/results and boolean machine guards. It refuses arbitrary payloads, coordinates and free text. It retains at most eight captures, four active and 32 MB of encoded data in memory, with 64 KB messages. The local launcher passes a ticket **file path** to a child process; the secret itself is never an environment value, URL or shell argument. The file is mode 0600, read once and deleted. No captured data is persisted automatically.

For one direct Node process, start Studio with `--live`, then run `v1d-studio live run --product ID -- node APP.mjs` from that product's root. The launcher compiles the selected identity from the product checkout using its installed kernel, compares it with the receiver, requests a one-time ticket, and starts the child only after those checks. The `v1d-observe` package condition captures existing `decide`, `step` and named port calls without editing their call sites. The ticket is never an environment value; the environment contains only a private file path. A completed short-lived Node process normally leaves an interrupted capture with its received prefix and unknown tail, not a false clean completion. `live run` refuses npm/shell wrappers so another process cannot consume the one-time ticket first.

### Measured local overhead, incomplete A42

These 2026-09-24 numbers are from this WSL host, not from a physical device. Each p95 is the elapsed time of one declared decision or bound port call, sampled in small batches. CPU is process CPU for Node, renderer task time for Chromium, and the measured test thread for Android, each as a percentage of one core over the entire paced run. The CPU columns are therefore not directly comparable. No backend request, UI navigation or physical sensor operation is included.

| Platform and measured operation | Mode | Calls and pace | p95 ms/call | CPU, one core | Allocation evidence | Studio receipt |
| --- | --- | ---: | ---: | ---: | --- | --- |
| Node 22 on this WSL host, AMUX `contextCostDecision` | disabled | 2,000 at 100/s | 0.00387 | 0.202% | heap delta +450,216 B | no capture |
| Node 22 on this WSL host, same decision | enabled, unpaired | 2,000 at 100/s | 0.00609 | 0.256% | heap delta +556,264 B | no capture |
| Node 22 on this WSL host, same decision | connected | 2,000 at 100/s | 0.01064 | 0.656% | heap delta +388,048 B | 2,020 retained, 0 declared drops; interrupted tail |
| Node 22 on this WSL host, same decision | receiver stopped before calls | 2,000 at 100/s | 0.00538 | 0.137% | heap delta +512,992 B | disconnected; no new receipt |
| Chromium 144 in an isolated WSL profile, Trackbook dev `account.open` port | disabled bundle | 2,000 at 100/s | 0.00500* | 0.112% | heap delta +129,116 B | no capture |
| Chromium 144 in an isolated WSL profile, same bound port | enabled, unpaired | 2,000 at 100/s | 0.00500* | 0.089% | heap delta +233,316 B | no capture |
| Chromium 144 in an isolated WSL profile, same bound port | connected | 2,000 at 100/s | 0.00500* | 0.228% | heap delta +20,220 B | 2,020 retained, 0 declared drops |
| Chromium 144 in an isolated WSL profile, same bound port | receiver stopped before calls | 2,000 at 100/s | 0.00500* | 0.092% | heap delta −603,960 B | `Disconnected: capture tail is unknown` |
| Android Wear emulator on this host, SKYVW `power.window` decision | debug observer off | 2,000 at about 750/s | 0.00754 | 0.380% | thread allocated 816 B total | no capture |
| Android Wear emulator on this host, same decision | debug bridge present, unpaired | 2,000 at about 750/s | 0.00396 | 0.355% | thread allocated 816 B total | no capture |
| Android Wear emulator on this host, same decision | connected | 2,000 at about 700/s | 0.26897 | 6.515% | thread allocated 8,343,072 B total | 1,467 retained, 0 declared drops; interrupted tail, remainder unknown |
| Android Wear emulator on this host, same decision | receiver stopped | not measured | unknown | unknown | unknown | second attached emulator triggered `live.device-count` |

*Chromium rounded the 20-call batch to 0.1 ms; its 0.005 ms/call p95 cannot resolve a 5% difference. Node's connected p95 was about 175% above disabled for this tiny decision, exceeding the plan's 5% target. Android's off row is a debug build with no active observer, not a release build; its connected figure is an approximately 700/s synthetic upper-load probe, not normal physical usage, and also exceeds the target. `Debug.getThreadAllocSize` measures the test thread; Node and Chromium heap deltas are net retained changes, **not total allocation**, and can be negative after GC. Complete allocation accounting for those platforms and Android's stopped mode remain unverified. No zero-overhead or physical-device claim follows from this table.

The declared producer limits are 2,047 queued events and 1 MB for Node and browser, with batches of at most 128 and 60 KB; Android permits 2,048 events and 1 MiB with batches of 32 and 32 KiB. These are source limits, not measured maxima. A separate browser stress run at about 2,000 calls/s produced 3,466 declared drops. A short capture's interrupted tail can hide unacknowledged events even when declared drops are zero.

## Exit and error contract

| Situation | `ok` | Exit |
| --- | --- | --- |
| Inspection/query/simulation completed | true | 0 |
| A directed path does not exist | true, `result.found: false` | 0 |
| Scenario computed with no assertions | true, `result.pass: null` | 0 |
| Missing facts, unsupported analysis, failed assertions, invalid identity/data | false | 1 |
| Missing, duplicate, unknown or invalid command options | false | 2 |

Successful semantic commands and failures emit one JSON object to stdout. `plan` and `review` emit Markdown; human `--help` and long-running `serve` startup text are the other exceptions. Normal semantic results are not printed to stderr. `--pretty` only changes JSON whitespace. Operational trace disagreement is returned as evidence (`logicCheck.kind: "different"`), not rewritten or hidden by a failing transport.

`doctor` retains its top-level `projects` list and now includes `ok`, exact keys and model/view identities. Its success means attachments could be inspected, not that all simulation/preview capabilities or a full product build passed. Check each capability report.

## Ownership and implementation

- `lib/cli.mjs`: strict parsing, bounded JSON input, formatting and transport mapping.
- `lib/semantic.mjs`: headless loading, explicit selection, small shared read/debug service.
- Existing `Workbench`: actual model queries, `step`/`decide`, scenario and trace checks.
- Existing agent tools: source editing, product builds and normal repository work.

New read/debug commands reject source/Git-write and server flags. No HTTP listener, provider, model, GPU call, generator, runtime connection, package install or persistent Studio storage is started by them. In-memory trace selection is disposable. The existing explicit `bundle` output command and opt-in GUI Git drafts retain their separate authority; they are not semantic read commands.

Do not expand the source reader or add MCP to make these commands work. First verify and use this shell/JSON surface with two different real products. These interfaces are local tool APIs, not a hardened in-process sandbox for code that imports the package.
