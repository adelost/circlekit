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

test("drive quality values reach native output and reject unbounded or impossible policy", () => {
  const options = { packageName: "io.acme", symbolPrefix: "Acme", sourceFile: "tags.ts", sourceSha: "test" };
  const quality = { minFixes: 6, minSpanS: 12, maxAccuracyM: 15, maxGapMs: 2500, maxFixAgeMs: 4000, minWindCoverage: .7 };
  const withQuality = (q: typeof quality): JumpTagCatalogEmission => ({ ...fixture, tags: [{
    ...fixture.tags[0], suggest: { kind: "body-drive", metric: "AVG_SINK_TRUE", min: 10, quality: q },
  }] });
  assert.match(emitJumpTagsKotlin(withQuality(quality), options),
    /GeneratedAcmeDriveEvidenceQuality\(6, 12.0f, 15.0f, 2500L, 4000L, 0.7f\)/u);
  for (const bad of [{ ...quality, maxGapMs: Infinity }, { ...quality, minFixes: 1 },
    { ...quality, maxFixAgeMs: 2.5 }, { ...quality, minWindCoverage: 1.1 }, { ...quality, minSpanS: NaN }]) {
    assert.throws(() => emitJumpTagsKotlin(withQuality(bad), options), /Invalid drive quality/u);
  }
});

test("sequence metrics must belong to the declared native vocabulary", () => {
  const input: JumpTagCatalogEmission = { ...fixture, tags: [{ ...fixture.tags[0], suggest: {
    kind: "sequence", version: 1, requiredTracks: 1, maxGapMs: 2000, maxTransitionMs: 3000,
    paths: [[{ id: "sustained", minDurationMs: 10000, conditions: [{ metric: "UNDECLARED", min: 1 }] }]],
  } }] };
  assert.throws(() => emitJumpTagsKotlin(input, {
    packageName: "io.acme", symbolPrefix: "Acme", sourceFile: "tags.ts", sourceSha: "test",
  }), /Unknown jump evidence metric: UNDECLARED/u);
});
