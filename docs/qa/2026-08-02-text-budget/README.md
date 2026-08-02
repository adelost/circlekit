# CircleKit text-budget proof

Scope: the two compact authored-text budgets now owned by `MenuDesign`.
This proof does not introduce a new visual style: it exercises the existing
Phone and round-Wear Showcase against the same source that defines the
budgets.

## Pixel contract

Written before the final captures:

- `phone-short.png` must show the named `control.choice-row/two` case with
  `TWO OPTIONS`, `DISPLAY MODE` and `METRES` fully readable.
- `wear-short.png` must show that same named case on the round host, with the
  same title, label and value inside the viewport.
- `phone-long.png` must show the named `template.screens/long-content` case;
  long title and supporting text may wrap, but neither may escape the row.
- `wear-long.png` must show the same long-content case on the round host;
  truncation must be explicit ellipsis inside the chord, never clipped pixels.

All four images were opened at original resolution after capture. Each
satisfies the contract above. Named probe dumps separately pin the exact
destinations and surface classes:

```text
control.choice-row/two      PHONE_COMPACT
control.choice-row/two      ROUND
template.screens/long-content  PHONE_COMPACT
template.screens/long-content  ROUND
```

## Fail-loud contract

`MenuDesignTextBudgetTest` constructs strings from the exported constants,
accepts each exact boundary and proves that one additional character throws
`IllegalArgumentException`. The test therefore follows a changed budget
without copying either numeric value.

Focused pre-merge checks at source `9ccc245a`:

```text
:designkit:MenuDesignTextBudgetTest                 PASS
:showcase-catalog:ShowcaseManifestTest              PASS
:showcase-phone:compileDebugKotlin                   PASS
:showcase-wear:compileDebugKotlin                    PASS
:showcase-phone:assembleDebug                        PASS
:showcase-wear:assembleDebug                         PASS
scripts/check-file-length.sh                         PASS
```

Rollback artifact before this change: CircleKit `0.3.11`. Maven publication
and its exact merged source are recorded only after the immutable coordinates
are publicly reachable.
