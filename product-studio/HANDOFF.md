# Product Studio 0.4: next-owner handoff

This PR is stacked on Product Studio #274 at `740d3c3a7b33c55f4ebb07de0d05215b73c147fd`. Integrate the base first. All changes are confined to `product-studio/`. Read [README](README.md), [CONTRACTS](CONTRACTS.md), [EXPERIENCE](EXPERIENCE.md), [CLI](CLI.md), [INTEGRATION](INTEGRATION.md) and [VERIFICATION](VERIFICATION.md).

## Goal and delivered slice

The user wants one generic architecture/logic/code workbench that humans and existing coding agents can use across ProductSpec apps. This slice implements the daily-use/performance improvements from the 22-item review: cached immutable snapshots, demand-loaded data, retained DOM/camera, safe passive refresh, navigation/bookmarks/commands, model comparison, Problems and scope-aware proof status.

The checklist in EXPERIENCE distinguishes implemented mechanisms from partial features and later product integrations. No new DSL, evaluator, scheduler, source-writing agent channel, framework dependency or native renderer was introduced.

## First action: verify the delivered code

No application, install, compiler, test, browser or benchmark was run in this revision. Syntax-only JavaScript parsing is not a runtime test. Previous 0.2/0.3 evidence does not transfer to this version.

```bash
cd product-studio
npm ci
npm run verify
npm run profile
npm start
# Another terminal:
python test/browser.py
python test/browser_experience.py
python test/browser_extended.py
```

Use the actual locked packages, direct browser loading and ordinary CSP path. Do not substitute a temporary ProductSpec interpreter or bypass browser policy. For a claimed bug fix, run the corresponding regression on the old implementation first.

## High-value failure cases

Exercise these before adding features:

1. Zoom/pan, select an object, step a machine and return from source. The camera must not jump or the graph unnecessarily rebuild.
2. Edit one source file shared by two facets; switch products and declarations. Preserve the same draft owner and pending scenario text.
3. Let a build arrive while a draft or modal is open. Do not replace the draft, clear it or silently relabel an old result.
4. Write an incomplete bundle, then a valid bundle. The old usable snapshot stays until a stable valid candidate is accepted. Changing the manifest requires restart.
5. Issue two navigation/query/source requests, reverse their response order and verify current selection/model wins.
6. Import a long trace. Paged rows retain absolute event indices; causal gaps and synthetic provenance stay visible. A link to another trace/model must not select an unrelated event.
7. Compare reordered entities and then a real changed cell. Reorder is not entity replacement; facet/cell counts overlap and must not be summed as independent changes.

## Integration proof

Attach one full real Product IR and a different application's table/machine through the same core. Export from each product's actual compiler/build owner with exact version and source identity. Verify one known architecture path, source location and independent scenario. Only then connect a short real trace from an existing debug/test owner.

The passive follower does not build, restart or execute the products. Code agents continue using normal source-edit and build tools. No provider/GPU/model calls are needed to validate this workbench.

## Keep the ownership boundaries

Model snapshots are immutable; trace, source proposals and browser layout are separate overlays. Compilers own meaning; the UI owns presentation. Source, video documents, scenarios, Git refs and effects retain distinct owners. Unknown dependencies and incomplete evidence stay unknown.

New view APIs are lazy only for source/details/catalog/trace. Finite models and lightweight indexes still arrive initially. Graph rendering remains bounded. The profile script has no acceptance thresholds until measured on a reference machine. Full virtualization, language-service editing, native/media preview, live observation and full-product compilation remain separate work.

No runtime score or performance gain has been established. Record actual results and remaining limits before moving this PR out of draft. Do not create another task database, CI/release gate or speculative framework migration as a prerequisite.
