import assert from "node:assert/strict";
import test from "node:test";
import { fetchService, type FetchServiceSpec } from "../src/fetch-service-model.js";

const retry = { attemptDelaysMs: [1_000, 4_000], afterFailureMs: [30_000, 120_000, 600_000] } as const;
const weather = {
  id: "WEATHER",
  flow: { mode: "clock", everyMs: 30 * 60_000, minSpacingMs: 10_000 },
  freshness: { kind: "age", staleAfterMs: 30 * 60_000 },
  failure: { transport: "network", timeout: { connectMs: 10_000, readMs: 30_000 }, retry,
    offline: "serve-stale", cache: { kind: "value", maxAgeMs: 30 * 60_000,
      homeRadiusM: 50, onFailure: "keep-last-good" } },
  onCrash: "as-failure", effectIds: ["weather.briefing-fetch"],
} as const;

test("fetch policy is one declaration; existing scheduler values derive from it", () => {
  const declared = fetchService(weather);
  assert.equal(declared.pattern, "fetch");
  assert.equal(declared.cadenceMs, weather.flow.everyMs);
  assert.equal(declared.requestSpacingMs, weather.flow.minSpacingMs);
  assert.deepEqual(declared.failure.retry.attemptDelaysMs, [1_000, 4_000]);
  assert.equal(Object.isFrozen(declared), true);
});

test("a network read cannot omit timeout, bounded retry, offline or cache policy", () => {
  const define = (value: unknown) => () => fetchService(value as FetchServiceSpec);
  assert.throws(define({ ...weather, failure: { ...weather.failure, timeout: undefined } }),
    /WEATHER.*failure\.timeout\.connectMs/u);
  assert.throws(define({ ...weather, failure: { ...weather.failure, retry: { ...retry, afterFailureMs: [] } } }),
    /WEATHER.*failure\.retry/u);
  assert.throws(define({ ...weather, failure: { ...weather.failure, offline: "serve-stale", cache: { kind: "none" } } }),
    /WEATHER.*failure\.cache/u);
  assert.throws(define({ ...weather, onCrash: undefined }), /WEATHER.*onCrash/u);
});

test("local pending work has no invented network timeout", () => {
  const declared = fetchService({ id: "JUMP_WEATHER", flow: { mode: "pending", everyMs: 60_000,
    minSpacingMs: 10_000 }, freshness: { kind: "pending" },
    failure: { transport: "local", retry: { attemptDelaysMs: [], afterFailureMs: [30_000] },
      cache: { kind: "none" } }, onCrash: "as-failure", effectIds: [] });
  assert.equal(declared.failure.transport, "local");
  assert.equal(declared.cadenceMs, 60_000);
});

test("coverage cache is spatial while a value cache needs a real age", () => {
  const coverage = fetchService({ ...weather,
    flow: { mode: "spatial", everyMs: 24 * 60 * 60_000, minSpacingMs: 10_000 },
    freshness: { kind: "coverage", recheckAfterMs: 24 * 60 * 60_000 },
    failure: { ...weather.failure, cache: { kind: "coverage", onFailure: "keep-last-good" } },
  });
  assert.equal(coverage.failure.cache.kind, "coverage");
  assert.throws(() => fetchService({ ...weather,
    failure: { ...weather.failure, cache: { kind: "value", onFailure: "keep-last-good" } },
  } as unknown as FetchServiceSpec), /failure\.cache\.maxAgeMs/u);
});

function negativeTypes() {
  // @ts-expect-error A network fetch must declare its failure policy.
  fetchService({ id: "bad", flow: weather.flow, freshness: weather.freshness,
    onCrash: "as-failure", effectIds: ["network.weather-request"] });
  // @ts-expect-error A network failure must declare a timeout.
  fetchService({ ...weather, failure: { ...weather.failure, timeout: undefined } });
}
void negativeTypes;
