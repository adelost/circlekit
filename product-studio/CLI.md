# Semantic CLI

Product Studio 0.3 adds read/debug commands over the same `Workbench` used by the GUI. Agents keep editing normal source with their existing tools. This is not another editor, DSL, runtime or MCP server.

**Implementation status:** locally executed on 2026-09-23; see [VERIFICATION](VERIFICATION.md). All commands below require the normal locked dependencies, except `--help` and argument-only diagnostics.

`v1d-studio export [repository] [--product ID]` explicitly compiles one workspace
project with `bundle` and `authoring: { entry, exportName, files, kind? }`.
Its `kernelRoot` selects the product's installed, lockfile-matching ProductSpec.
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

## Plan and converge

```bash
v1d-studio plan /repo --changed src/recording.ts --changed 'node-type::recording.session'
v1d-studio converge /repo --product my-product
v1d-studio converge /repo --product my-product --tasks
```

`plan` prints a short Markdown block for a PR. It lists only owners, ports, consumers, facets and tests available in the loaded model, with unknown source or facet ownership marked. `converge` reads existing laws, contracts and traces without running tests or generators. It exits 0 for Converged, 1 for Diverged and 2 for Unknown; `--tasks` includes one task per known contradiction.

## Bound the output

```bash
node bin/studio.mjs inspect /repo --fields key,id,kind --max 50 --offset 0
node bin/studio.mjs inspect /repo --entity 'node::producer' --pretty
```

Discovery supports `--search`, `--fields`, `--max 1..1000`, and `--offset`. The response reports total, returned count, next offset and truncation. `--fields` projects index rows only; it cannot remove identity, errors or limitations from the envelope. Exact `--entity` inspection returns the object, ports, source metadata and direct relationships.

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

```bash
node bin/studio.mjs trace /repo --file capture.trace.json --cursor 12 --pretty
node bin/studio.mjs trace /repo --file capture.trace.json --operation request-7 --max 100
```

The existing trace decoder verifies product/model identity and sequence accounting. `--cursor` is a zero-based position in the whole capture, not a filtered row or sequence number. `-1` means before the first event. Activity is accumulated through the cursor; search and pagination browse the entire capture. An absent `--cursor` selects the last event.

The result includes explicit causal links, missing ancestor sequence, declared gaps, synthetic/recorded origin and the GUI's finite-result comparison. An incomplete recorded outcome is unknown, not automatically a contradiction. Real contradictions remain visible.

`causalPathComplete` means all explicitly named ancestors were retained. It does not prove the producer recorded every real cause. An event without `causedBy` is a one-event explicit chain, not evidence that it had no cause. Snapshots containing counts are not event traces. No live process is paused or replayed.

## Exit and error contract

| Situation | `ok` | Exit |
| --- | --- | --- |
| Inspection/query/simulation completed | true | 0 |
| A directed path does not exist | true, `result.found: false` | 0 |
| Scenario computed with no assertions | true, `result.pass: null` | 0 |
| Missing facts, unsupported analysis, failed assertions, invalid identity/data | false | 1 |
| Missing, duplicate, unknown or invalid command options | false | 2 |

Successful semantic commands and failures emit one JSON object to stdout. Human `--help` text and the existing long-running `serve` startup text are exceptions. Normal semantic results are not printed to stderr. `--pretty` only changes whitespace. Operational trace disagreement is returned as evidence (`logicCheck.kind: "different"`), not rewritten or hidden by a failing transport.

`doctor` retains its top-level `projects` list and now includes `ok`, exact keys and model/view identities. Its success means attachments could be inspected, not that all simulation/preview capabilities or a full product build passed. Check each capability report.

## Ownership and implementation

- `lib/cli.mjs`: strict parsing, bounded JSON input, formatting and transport mapping.
- `lib/semantic.mjs`: headless loading, explicit selection, small shared read/debug service.
- Existing `Workbench`: actual model queries, `step`/`decide`, scenario and trace checks.
- Existing agent tools: source editing, product builds and normal repository work.

New read/debug commands reject source/Git-write and server flags. No HTTP listener, provider, model, GPU call, generator, runtime connection, package install or persistent Studio storage is started by them. In-memory trace selection is disposable. The existing explicit `bundle` output command and opt-in GUI Git drafts retain their separate authority; they are not semantic read commands.

Do not expand the source reader or add MCP to make these commands work. First verify and use this shell/JSON surface with two different real products. These interfaces are local tool APIs, not a hardened in-process sandbox for code that imports the package.
