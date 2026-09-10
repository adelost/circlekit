import assert from "node:assert/strict";
import test from "node:test";
import { emitJumpSequence } from "../src/skydiving/emit-jump-sequence.js";
import type { JumpSequenceRuleEmission } from "../src/skydiving/jump-tag-model.js";

const rule: JumpSequenceRuleEmission = {
  kind: "sequence", version: 1, requiredTracks: 2, maxGapMs: 2500, maxTransitionMs: 5000,
  paths: [[{ id: "shared", minDurationMs: 12000, conditions: [{ metric: "DISTANCE_M", max: 12 }] },
    { id: "separate", minDurationMs: 4000, conditions: [{ metric: "DISTANCE_M", min: 40 }] }]],
};

test("sequence preserves version, prerequisites, timing and stage order in typed native output", () => {
  const text = emitJumpSequence(rule, "GeneratedAcme");
  assert.match(text, /Sequence\(1, 2, 2500L, 5000L/u);
  assert.match(text, /SequenceCondition\(GeneratedAcmeJumpTagEvidenceMetric.DISTANCE_M, null, 12.0f\)/u);
  assert.ok(text.indexOf('"shared"') < text.indexOf('"separate"'));
});

test("malformed rule programs fail before generating native code", () => {
  const stage = rule.paths[0]![0]!;
  const bad: JumpSequenceRuleEmission[] = [
    { ...rule, paths: [] }, { ...rule, paths: [[]] }, { ...rule, maxGapMs: 0 },
    { ...rule, requiredTracks: 0 }, { ...rule, version: 1.5 },
    { ...rule, paths: [[stage, stage]] }, { ...rule, paths: [[{ ...stage, minDurationMs: 0 }]] },
    { ...rule, paths: [[{ ...stage, conditions: [] }]] },
    { ...rule, paths: [[{ ...stage, conditions: [stage.conditions[0]!, stage.conditions[0]!] }]] },
    { ...rule, paths: [[{ ...stage, conditions: [{ metric: "DISTANCE_M" }] }]] },
    { ...rule, paths: [[{ ...stage, conditions: [{ metric: "DISTANCE_M", min: 40, max: 12 }] }]] },
    { ...rule, paths: [[{ ...stage, conditions: [{ metric: "DISTANCE_M", min: NaN }] }]] },
  ];
  bad.forEach(input => assert.throws(() => emitJumpSequence(input, "GeneratedAcme"), /Invalid sequence/u));
});
