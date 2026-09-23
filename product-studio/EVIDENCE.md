# Optional behavior and declaration evidence

Evidence is optional. Product Studio opens and validates service intent without running tests.

All adapters emit the existing `bdd.run.v1` report shape. They do not add a ProductSpec `tests` registry.

## Labels

- `source-reference`: a located test body mentions an exact ProductSpec ID. This is not proof the entity was exercised.
- `author-declared`: a nearby `@covers` names an exact entity or one unique ProductSpec ID.
- `unit`, `component`, `integration`, `e2e`, `host`: reported or source-declared test scope.
- `generated-law`: the matching ProductSpec evaluator accepted a compiled declaration for the exact model digest.
- recorded traces remain separate observed runtime evidence.

## Vitest

Run only the tests selected by the product owner and add the Studio reporter beside the normal reporter:

```bash
STUDIO_REPOSITORY=adelost/agentmux \
STUDIO_REPOSITORY_ROOT=/absolute/path/to/agentmux \
STUDIO_BDD_REPORT=test-results/amux-bdd-run.json \
node node_modules/vitest/vitest.mjs run path/to/test \
  --reporter default \
  --reporter /absolute/path/to/circlekit/product-studio/reporters/vitest.mjs
```

The reporter targets the Vitest 4 public reporter model and refuses an incompatible API instead of scraping internal state. A Git commit is recorded only when the repository is clean before and after the observed run.

## Existing JUnit XML

```bash
v1d-studio junit \
  --input path/to/TEST-suite.xml \
  --source-root app/src/test \
  --repository adelost/skydive-altimeter \
  --output test-results/skyvw-bdd-run.json
```

The importer never starts Gradle or JUnit. It requires a real suite timestamp. If XML omits the timezone, pass `--timestamp-zone UTC` only when the original runner actually used UTC. Ambiguous Kotlin source ownership is refused.

## Generated Kotlin IDs

A workspace may explicitly attach generated ID sources:

```json
{"documentation":{"idSources":["app/src/main/java/example/generated/GeneratedProductPortIds.kt"]}}
```

Only literal generated values referenced in a located Kotlin test body are associated. Names are never converted into guessed ProductSpec IDs.

## Optional source annotations

```text
@covers node-type::recording.service
@proof host
```

`@covers` accepts an exact architecture entity key or a ProductSpec ID that resolves to exactly one entity. Unknown or ambiguous targets become diagnostics.

`@proof` accepts `host`, `unit`, `component`, `integration` or `e2e`. It changes the displayed scope label; it does not create runtime evidence.

## ProductSpec declaration laws

```bash
v1d-studio laws --product amux-link \
  --kernel-root android/audio-inbox/product-spec \
  --output test-results/amux-link-laws.json
```

The report validates ProductSpec node types with `validateProductNodeType` and finite machine/decision-table facets through the shared ProductSpec kernel.

When the product uses a different ProductSpec version, `--kernel-root` selects that product's installed, lockfile-matching compiler. Without an exact producer/evaluator match, affected checks are `skipped`. They are never silently revalidated with a newer compiler. Generated-law IDs include the exact Studio model digest and are associated only when that digest still matches.

## Viewer boundary

Studio finds existing convention-named reports as described in [INTEGRATION](INTEGRATION.md#1-start-with-an-existing-checkout); `documentation.bddReports` is an explicit override. Missing reports are informational. No evidence adapter runs as part of `v1d-studio` or `v1d-studio check`.


## Verification policy: NO CI

**Do not add GitHub Actions or other CI for these evidence adapters.**

Vitest, JUnit import, declaration laws and smoke commands are owner-run on the user's own hardware. Product Studio must never turn these commands into remote repository automation or merge gates.
