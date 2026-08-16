import assert from "node:assert/strict";
import test from "node:test";
import {
  emitPreflightBriefingKotlin,
  type PreflightBriefingCatalog,
  validatePreflightBriefingCatalog,
} from "../src/skydiving/index.js";

const catalog = {
  definitions: [
    {
      id: "wind-turn",
      label: "WIND TURN",
      iconRef: "wind-direction",
      copyRef: "preflight.wind-turn",
      availability: "required",
      rule: { kind: "circular-delta", metricRef: "weather.wind-bearing", minimumMagnitude: 3, deltaDeg: 45 },
    },
    {
      id: "wind-band",
      label: "WIND BAND",
      iconRef: "wind",
      copyRef: "preflight.wind-band",
      availability: "optional",
      rule: { kind: "ramp-crossing", metricRef: "weather.wind-speed", rampRef: "wind.landing" },
    },
    {
      id: "source-state",
      label: "SOURCE",
      iconRef: "source",
      copyRef: "preflight.source",
      availability: "required",
      rule: { kind: "state-projection", stateRef: "weather.source-state", cautionValues: ["stale"], abortValues: ["missing"] },
    },
  ],
} as const satisfies PreflightBriefingCatalog;

test("preflight briefing emits a closed rule algebra and separate availability", () => {
  const output = emitPreflightBriefingKotlin(catalog, {
    packageName: "io.acme.generated",
    symbolPrefix: "Acme",
    sourceFile: "product/preflight.ts",
    sourceSha: "fixture",
  });
  assert.match(output, /sealed interface GeneratedAcmePreflightRule/u);
  assert.match(output, /data class CircularDelta/u);
  assert.match(output, /data class RampCrossing/u);
  assert.match(output, /data class StateProjection/u);
  assert.match(output, /enum class GeneratedAcmePreflightAvailability \{ REQUIRED, OPTIONAL \}/u);
  assert.doesNotMatch(output, /weather UI|GUST|bearing sweep/iu);
});

test("preflight state projection cannot classify one state twice", () => {
  const invalid: PreflightBriefingCatalog = {
    definitions: [{
      id: "source-state",
      label: "SOURCE",
      iconRef: "source",
      copyRef: "preflight.source",
      availability: "required",
      rule: { kind: "state-projection", stateRef: "source", cautionValues: ["stale"], abortValues: ["stale"] },
    }],
  };
  assert.throws(() => validatePreflightBriefingCatalog(invalid), /both caution and abort/u);
});
