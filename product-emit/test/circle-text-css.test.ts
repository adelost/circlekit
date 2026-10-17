import assert from "node:assert/strict";
import test from "node:test";
import { CIRCLEKIT_TEXT } from "@v1d/circlekit-assets";
import { emitCircleTextCss } from "../src/core/emit-circle-text-css.js";

test("all shared roles reach CSS with the phone floor, face, weight and tracking", () => {
  const css = emitCircleTextCss();
  for (const [id, role] of Object.entries(CIRCLEKIT_TEXT.roles)) {
    const match = css.match(new RegExp(`--circle-text-${id}-size: ([0-9.]+)rem;`));
    assert.ok(match, id);
    assert.ok(Math.abs(Number(match[1]) * 16 - role.sp * 12 / 6.5) < 1e-10, id);
    assert.ok(css.includes(`--circle-text-${id}-weight: ${role.weight};`), id);
    assert.ok(css.includes(`--circle-text-${id}-tracking: ${role.tracking}em;`), id);

  }
  assert.ok(css.includes('--circle-text-words-face: "Onest";'));
  assert.ok(css.includes('--circle-text-numerals-face: "Barlow Semi Condensed";'));
  assert.ok(css.includes("--circle-text-note-size: 0.75rem;"));
  assert.ok(css.includes("--circle-text-number-unit-weight: 600;"));
});
