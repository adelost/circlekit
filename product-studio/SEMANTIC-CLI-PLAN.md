# Semantic CLI: implementation map

Updated 2026-09-21. Q0-Q5 now have source implementations in Product Studio 0.3, continuing PR #274. **They have not been executed or runtime-verified in this revision.** The earlier detailed design remains in Git history; [CLI.md](CLI.md) is the current command contract.

| Card | Implementation | Verification still required |
| --- | --- | --- |
| Q0: trace correctness | `trace.mjs` follows explicit ancestors and returns `missingParentSequence` / `causalPathComplete`; GUI retains the existing boolean and shows the missing sequence | Run complete, direct-missing, grandparent-missing, truncated and empty-chain regressions |
| Q1: headless session | `openHeadlessStudio` reuses `Workbench`, without HTTP/storage and without implicit example loading; product selection refuses ambiguity | Compare identity with GUI/doctor on real workspaces |
| Q2: inspect/query/source | `SemanticStudio` uses the existing architecture graph, query functions and source index | Run exact-port, no-path, unsupported-impact and stale-source cases |
| Q3: simulation | Same `Workbench.evaluate` and installed ProductSpec; caller data cannot replace selection identity | Run table/machine cases, missing facts, invalid fields and evaluator mismatch |
| Q4: scenarios/traces | Same scenario runner and GUI trace comparison; portable scenarios require exact model equality | Run asserted/failed/unasserted cases and actual trace imports |
| Q5: CLI ergonomics | Strict per-command options, JSON envelope, explicit exit statuses, `@file`, `--pretty`, pagination, field projection, `--expect-model` | Run process-level CLI tests and use the examples in CLI.md |

Source additions: `lib/semantic.mjs`, `lib/cli.mjs`. Existing modules remain the semantic owners. No separate policy evaluator, source interpreter, graph registry, scheduler or AI writer was created.

Implementation also addresses static-review findings: an empty expectation cannot be counted as a passing test; an empty scenario cannot bypass an inspect-only facet; missing recorded outcomes remain unknown; an old compiled model cannot be linked to changed source by matching ID; grouped queries retain their selected edge filter; duplicate manifest IDs are refused. These are source changes with regression cases, not claims of observed test passes.

## Acceptance order

1. Install the unchanged locked dependency versions on a normal Node >=22 machine.
2. Run `npm run test:cli`, then `npm run verify`.
3. Exercise the existing direct-browser tests; the older HTTP-bridge results do not verify this revision.
4. Attach one full Product IR product and another table-only product through the same core.
5. Let an agent ask CLI questions, edit normal source with its own tools, regenerate via the product owner, and inspect the new model. Studio does not run that build for it.

For a claimed bug fix, first run the relevant new regression against the previous implementation to establish the symptom. No tests were run in the implementation author's latest pass, at the user's request.

## Still outside this slice

MCP, full-product execution, source-writing agent APIs, arbitrary build commands, live device connection, native/media previews, full type checking and automatic generation after source edits. The user did not need another code-editing channel. These commands provide the shared map and debugger instead.
