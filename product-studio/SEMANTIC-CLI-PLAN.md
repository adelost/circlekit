# Product Studio semantic CLI: implementation plan

Status: planned follow-up to Product Studio 0.2 in PR #274. This is not implemented merely because this document exists.

## Goal

Expose the same semantic model already used by the Product Studio GUI through a small, machine-readable local CLI so people and coding agents can inspect and debug products without scraping UI state or re-deriving architecture from source.

This is **not** an agent editor. Coding agents already edit source with their normal repository tools. The CLI supplies trusted semantic context and validation around that work.

The CLI must reuse the existing Studio core:

- inspection bundle decoding;
- architecture queries;
- ProductSpec `decide` / `step`;
- source provenance;
- trace inspection;
- scenario execution;
- current version/identity checks.

No duplicated policy evaluator, graph registry, parser, scheduler or AI-specific write path is allowed.

## User model

A human or agent should be able to ask:

```text
What owns this port?
What is upstream/downstream from this node?
What declared path connects A to B?
What can this rule potentially affect?
Where in source is this declaration?
What does this table decide for these facts?
What transition does this machine take?
Why did another cell not match?
What does this trace event explicitly depend on?
Does this scenario still pass on this exact model?
```

Then the human/agent may edit ordinary source through existing tools and use Studio again to inspect or validate the result.

## Command surface

Keep the existing `serve`, `doctor` and `bundle` commands.

Add one generic read-only command family:

```bash
v1d-studio inspect <repository> [--product ID]
v1d-studio query <repository> --kind upstream --from <entity-key>
v1d-studio query <repository> --kind downstream --from <entity-key>
v1d-studio query <repository> --kind consumers --from <entity-key>
v1d-studio query <repository> --kind owner --from <entity-key>
v1d-studio query <repository> --kind impact --from <entity-key>
v1d-studio query <repository> --kind path --from <entity-key> --to <entity-key>
v1d-studio source <repository> --entity <entity-key>
v1d-studio simulate <repository> --facet <id> --input <json-or-file>
v1d-studio scenario <repository> --file scenario.json
v1d-studio trace <repository> --file trace.json [--cursor N] [--entity KEY] [--operation ID]
```

All commands print JSON by default. A later `--format text` convenience formatter may be added, but JSON is the stable machine surface.

Do not add shell execution, arbitrary JavaScript evaluation, model/provider calls, source writes, Git writes, package publication or runtime mutation to this CLI.

## Shared response envelope

Every semantic command returns the same outer shape:

```json
{
  "ok": true,
  "command": "query",
  "product": "skyvw",
  "modelDigest": "...",
  "producer": {
    "productSpec": "0.3.65",
    "sourceRevision": "..."
  },
  "scope": {
    "workspace": "...",
    "facet": null
  },
  "result": {},
  "limitations": [
    "Declared dependency only; not observed execution."
  ]
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "simulation.unavailable",
    "message": "This model was compiled with ProductSpec ...",
    "details": {}
  }
}
```

Exit code is nonzero for `ok:false`.

Never hide unsupported analysis by returning an empty successful result.

## Q0. Fix trace ancestor reporting before adding another consumer

### Found

`inspectTrace()` currently follows explicit `causedBy` links until a parent lookup fails, but `missingParent` is derived from the final collected path in a way that can miss an older absent ancestor.

### Change

Return explicit causality state:

```ts
{
  causalPath: [...],
  causalPathComplete: boolean,
  missingParentSequence: number | null
}
```

Algorithm:

```text
current = selected event
while current has causedBy:
    append current
    parent = bySequence[current.causedBy]
    if parent missing:
        missingParentSequence = current.causedBy
        stop
    current = parent
append final existing ancestor
reverse path
```

Do not fabricate a gap reason. A truncated/gapped trace remains distinguishable from an event that simply omitted causality metadata.

### Proof

- direct missing parent;
- missing grandparent;
- complete 3-event chain;
- retained history whose parent is before `droppedBefore`;
- no `causedBy` means complete path of one event.

## Q1. Extract one headless Studio session loader

Today the server and doctor already initialize `Workbench`. Do not make every CLI command reimplement product discovery.

Add a small headless helper, for example:

```ts
async function openHeadlessStudio({
  roots,
  dataDir,
  productSelector
}) -> {
  workbench,
  projects,
  selectedProject,
  view
}
```

Requirements:

- same path/manifests/presets as GUI;
- no HTTP server;
- no generator execution;
- no repository module execution;
- no source mutation;
- same bundle/version checks;
- explicit error if several real products match and no selector is supplied.

The selected project's `modelDigest`, compatibility and diagnostics must match `doctor`.

## Q2. Architecture and provenance queries

Map CLI `query` directly to existing `queryArchitecture()`.

Do not introduce CLI-specific graph semantics.

### Entity discovery

`inspect` returns a bounded searchable index:

```json
{
  "entities": [
    {
      "key": "node::recording.runtime",
      "id": "recording.runtime",
      "kind": "node",
      "group": "recording"
    }
  ],
  "facets": [...],
  "groups": [...],
  "coverage": {...}
}
```

Support an optional exact `--entity` selector to print one entity with its ports, source provenance and declared relationships.

### Source command

`source --entity KEY` returns:

- exact file;
- span/line/column when exported;
- source digest;
- edit capability classification;
- affected/shared owner information when available.

It does not print an invented source location.

### Query proof

- port selection only seeds edges belonging to that exact port;
- cycles terminate;
- same local ID in two products/workspaces cannot collide;
- no path returns `found:false`, not an empty ambiguous success;
- facet with no explicit runtime association returns unsupported impact;
- purpose filter remains explicit.

## Q3. Finite simulation commands

### Decision table

Input accepts JSON object or `@file.json`:

```bash
v1d-studio simulate /repo --facet amux.context-cost \
  --input '{"facts":{"need":"UNKNOWN","readiness":"SAFE","attempt":"NEW"}}'
```

Result is exactly the existing `evaluateFacet()` result plus product/facet identity.

### Machine

```bash
v1d-studio simulate /repo --facet recording.session \
  --input @step.json
```

where:

```json
{
  "state": "ARMED",
  "input": "AltitudeObserved",
  "guards": {
    "AUTOMATIC": true,
    "ABOVE_GPS_HEIGHT": true,
    "LEASE_EXPIRED": false,
    "ABOVE_RECORDING_HEIGHT": false
  }
}
```

Unknown relevant guards continue to return `needs-facts`. Do not convert omitted guards to false.

### Version rule

Simulation is refused when the loaded model's producer kernel is incompatible with the evaluator. Inspection remains allowed.

No `--force`.

## Q4. Scenario and trace inspection

### Scenario

Use the existing `runScenario()`.

The CLI must preserve:

- exact bundle/model identity;
- virtual time;
- independent assertions;
- `unasserted` when there are no assertions;
- no effects.

### Trace

Use `decodeTrace()` + `inspectTrace()`.

Output includes:

- trace identity;
- selected event;
- filtered event list;
- explicit causal path;
- missing parent sequence after Q0;
- activity summary;
- truncation/gap state;
- evidence origin `recorded` vs `synthetic`.

Do not call a count-only port snapshot a trace.

## Q5. Agent-friendly ergonomics without agent-specific semantics

After Q0-Q4 work, add only convenience that does not change semantics:

- `--pretty` for formatted JSON;
- `--fields key,id,kind` for bounded output projection;
- `--max N` for entity/event lists;
- stable diagnostic codes;
- `--help` examples for shell-safe `@file.json` inputs.

Do **not** add MCP yet.

First dogfood the CLI from Codex/Claude using normal shell access. Only add an MCP transport if agents repeatedly need structured discovery/transport beyond what the CLI provides. If MCP is later added, it wraps these same commands/core functions; it does not gain new write authority.

## API shape inside the package

Avoid putting all CLI branching in `bin/studio.mjs`.

Add a reusable read-only service, for example:

```ts
export class SemanticStudio {
  inspect(options)
  entity(options)
  query(options)
  source(options)
  simulate(options)
  scenario(options)
  trace(options)
}
```

The GUI may later call the same service behind HTTP. The CLI calls it directly.

This consolidates behavior rather than creating CLI-vs-GUI drift.

Do not move source editing into this service in this slice.

## Testing matrix

### Unit

- trace ancestor completeness Q0;
- headless selection and ambiguous-product refusal;
- architecture queries;
- source origin found / unavailable;
- version mismatch inspection vs simulation;
- exact table result;
- unknown machine guards;
- scenario asserted / failed / unasserted;
- trace synthetic / recorded / truncated.

### CLI acceptance

Run against fixtures only:

```text
inspect lifecycle example
simulate lifecycle transition
inspect AMUX table
simulate AMUX UNKNOWN -> HOLD
query generic fifth product path
source known facet
trace synthetic fixture
scenario asserted fixture
```

Assert:

- stdout is valid JSON;
- stderr carries no normal result;
- exit status matches `ok`;
- no network request;
- no source/draft/Git change;
- output model digest matches GUI/doctor for same loaded project.

### Real-product dogfood after clean install

Use two different actual products:

1. one full ProductIr app;
2. one table-only app.

The core CLI files must not need a product-name branch to support the second product.

## Stop rules

Reject the slice if implementation requires any of these:

- a second ProductSpec evaluator;
- executing product source to answer a read-only query;
- hardcoded SKYVW/AMUX/video semantics in the core CLI;
- shell commands supplied by product data;
- source writes merely to run a query;
- automatic provider/runtime connection;
- broadening `source.mjs` into a general TypeScript interpreter.

A missing semantic relationship stays unknown until the compiler/product adapter can export it.

## Recommended implementation order

```text
Q0 trace correctness
  ↓
Q1 headless session
  ↓
Q2 inspect/query/source
  ↓
Q3 simulate
  ↓
Q4 scenario/trace
  ↓
Q5 ergonomics
  ↓
dogfood from a coding agent
  ↓
decide whether MCP adds real value
```

Q0-Q4 are the meaningful slice. Q5 is polish. MCP is explicitly not a dependency.

## Done definition

This follow-up is complete when:

1. The GUI and CLI produce the same semantic results from the same model.
2. A coding agent can answer architecture/debug questions using the CLI, then edit normal repository source with its existing tools.
3. Studio never becomes the code-writing authority for the agent.
4. Two different products use the same semantic core without product-name branches.
5. Unsupported or version-incompatible operations fail explicitly.
6. No additional runtime/provider/source-write authority was introduced.
