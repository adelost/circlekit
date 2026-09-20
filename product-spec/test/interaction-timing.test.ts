import assert from "node:assert/strict";
import test from "node:test";
import { INTERACTION_TIMINGS, isInteractionTiming, type InteractionTiming } from "../src/index.js";

test("the vocabulary is exactly the two kinds, in the order a product reads them", () => {
  // Mattias 2026-09-20: "det ska inte finnas något mellanting liksom, bara de här två typerna utav
  // knappar". A third word here would be a third kind of button in every product at once.
  assert.deepEqual([...INTERACTION_TIMINGS], ["immediate", "deliberate"]);
});

test("a reader asks the vocabulary rather than repeating its words", () => {
  for (const timing of INTERACTION_TIMINGS) assert.equal(isInteractionTiming(timing), true);
  // The shapes a declaration actually arrives in when it is wrong: a near miss, a plausible third
  // kind, a capitalisation, and the two ways a field goes missing.
  for (const wrong of ["Immediate", "deliberately", "hold", "tap", "", undefined, null, 200, {}]) {
    assert.equal(isInteractionTiming(wrong), false, `'${String(wrong)}' passed as a timing`);
  }
});

test("Skyvw's declarations keep their meaning: the two words it already emits still validate", () => {
  // Skyvw declared these before the vocabulary moved here, through product-emit's own copy. The move
  // is a move, not a change: every value its appspec already carries has to read the same way.
  const asSkyvwDeclaresThem: readonly InteractionTiming[] = ["immediate", "deliberate"];
  for (const timing of asSkyvwDeclaresThem) {
    assert.equal(isInteractionTiming(timing), true, `Skyvw's '${timing}' stopped being a timing`);
    assert.equal(INTERACTION_TIMINGS.includes(timing), true);
  }
});
