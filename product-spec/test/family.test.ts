import assert from "node:assert/strict";
import test from "node:test";
import { family } from "../src/index.js";

/**
 * Row 144, sugar 1 of the DX review (Skyvw docs/plans/2026-09-17-dsl-dx-review.md): six (category, shape, edit)
 * triples covered 44 of Skyvw's 47 jump tags. A family states the triple once, and a row cannot carry another.
 */

const conditions = family({ category: "CONDITIONS", shape: "WHOLE_JUMP", edit: "DERIVED" });
const night = conditions({ id: "night", label: "NIGHT", tone: "COLD" });

// The row is the same record written out in full, with its literal types kept.
export const nightCategory: "CONDITIONS" = night.category;
export const nightId: "night" = night.id;
// A caller that marks the family's keys as never on its own row type still gets the full record, not never.
const typedRow = <const Row extends { readonly id: string }>(row: Row & { readonly category?: never }) => conditions(row);
export const typedCategory: "CONDITIONS" = typedRow({ id: "fog" }).category;
export const typedId: "fog" = typedRow({ id: "fog" }).id;
export const restatedInEditor = () =>
  // @ts-expect-error a row cannot restate a field its family fixes
  conditions({ id: "fog", label: "FOG", edit: "USER_EDITABLE" });

test("a family row is the full record: the family's fields and the row's own", () => {
  assert.deepEqual(night, { category: "CONDITIONS", shape: "WHOLE_JUMP", edit: "DERIVED", id: "night", label: "NIGHT", tone: "COLD" });
});

test("a row that restates a family field is refused by name, even with the same value", () => {
  const restate = conditions as (row: object) => object;
  assert.throws(
    () => restate({ id: "fog", label: "FOG", edit: "USER_EDITABLE" }),
    /family row 'fog' restates 'edit', which its family fixes as "DERIVED"/u,
  );
  assert.throws(
    () => restate({ id: "rain", category: "CONDITIONS", shape: "EVENT" }),
    /family row 'rain' restates 'category', 'shape', which its family fixes as "CONDITIONS", "WHOLE_JUMP"/u,
  );
  assert.throws(() => restate({ id: "hail", category: "CONDITIONS" }), /family row 'hail' restates 'category'/u);
});
