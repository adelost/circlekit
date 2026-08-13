import assert from "node:assert/strict";
import test from "node:test";
import { emitJumpTagsKotlin, type JumpTagCatalogEmission } from "../src/skydiving/index.js";

const fixture = {
  evidenceMetrics: ["AVG_SINK_TRUE", "AVG_SINK_EAS"],
  axes: [{ id: "DISCIPLINE", label: "DISCIPLINE" }],
  tags: [{
    id: "belly",
    label: "BELLY",
    category: "DISCIPLINE",
    shape: "WHOLE_JUMP",
    edit: "USER_EDITABLE",
    icon: "BELLY",
    tone: "POSITIVE",
    suggest: { kind: "sink-band", metric: "AVG_SINK_EAS", min: 42, max: 58, minCoverage: 0.7 },
  }],
  roster: { minGroupSize: 1, maxGroupSize: 99, maxNameChars: 80 },
  ai: {
    operations: ["ADD_TAG"],
    rejectionLiveness: "EDIT_SNAPSHOT",
    maxInstructionChars: 1_000,
    maxNoteChars: 4_000,
  },
} as const satisfies JumpTagCatalogEmission;

test("jump tags emit from the shared skydiving backend without a product literal", () => {
  const output = emitJumpTagsKotlin(fixture, {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceFile: "product/jump-tags.ts",
    sourceSha: "fixture",
  });

  assert.match(output, /GeneratedAcmeJumpTagEvidenceMetric \{ AVG_SINK_TRUE, AVG_SINK_EAS \}/u);
  assert.match(output, /GeneratedAcmeJumpTags/u);
  assert.match(output, /Generated from product\/jump-tags\.ts · fixture/u);
  assert.doesNotMatch(output, /Skyvw|skydive-altimeter/u);
});
