/** Product-neutral policy for a scheduled read. A platform supplies request and parse. */
export type FetchFlow = {
  readonly mode: "clock" | "spatial" | "pending";
  readonly everyMs: number;
  readonly minSpacingMs: number;
};

export type FetchFreshness =
  | { readonly kind: "age"; readonly staleAfterMs: number }
  | { readonly kind: "coverage"; readonly recheckAfterMs: number }
  | { readonly kind: "pending" };

export type FetchRetry = {
  /** Delays between attempts in the same scheduled operation. Empty means one attempt. */
  readonly attemptDelaysMs: readonly number[];
  /** Backoff after all attempts fail; the existing scheduler owns this clock. */
  readonly afterFailureMs: readonly [number, ...number[]];
};

export type FetchCache =
  | { readonly kind: "none" }
  | { readonly kind: "value" | "coverage"; readonly maxAgeMs: number;
      readonly homeRadiusM?: number; readonly onFailure: "keep-last-good" };

export type FetchFailure =
  | { readonly transport: "network";
      readonly timeout: { readonly connectMs: number; readonly readMs: number };
      readonly retry: FetchRetry;
      readonly offline: "serve-stale" | "fail";
      readonly cache: FetchCache }
  | { readonly transport: "local";
      readonly retry: FetchRetry;
      readonly cache: { readonly kind: "none" } };

export interface FetchServiceSpec {
  readonly id: string;
  readonly flow: FetchFlow;
  readonly freshness: FetchFreshness;
  readonly failure: FetchFailure;
  /** A thrown source attempt becomes scheduler failure, or ends the lease. */
  readonly onCrash: "as-failure" | "stop";
  readonly effectIds: readonly string[];
}

export type FetchService<Spec extends FetchServiceSpec = FetchServiceSpec> = Spec & {
  readonly pattern: "fetch";
  readonly cadenceMs: number;
  readonly requestSpacingMs: number;
};

/** One declared policy; the compatibility fields are projections, not second facts. */
export function fetchService<const Spec extends FetchServiceSpec>(spec: Spec): FetchService<Spec> {
  const name = typeof spec?.id === "string" && spec.id ? spec.id : "<missing-id>";
  const fail = (field: string): never => { throw new Error(`fetchService '${name}' needs ${field}`); };
  if (name === "<missing-id>") fail("id");
  positive(spec.flow?.everyMs, "flow.everyMs", fail);
  positive(spec.flow?.minSpacingMs, "flow.minSpacingMs", fail);
  if (!["clock", "spatial", "pending"].includes(spec.flow?.mode)) fail("flow.mode");
  const freshness = spec.freshness;
  if (freshness?.kind === "age") positive(freshness.staleAfterMs, "freshness.staleAfterMs", fail);
  else if (freshness?.kind === "coverage") positive(freshness.recheckAfterMs, "freshness.recheckAfterMs", fail);
  else if (freshness?.kind !== "pending") fail("freshness.kind");
  if (!spec.failure || !["network", "local"].includes(spec.failure.transport)) fail("failure.policy");
  const failure = spec.failure;
  if (!failure.retry || !Array.isArray(failure.retry.attemptDelaysMs)
      || !Array.isArray(failure.retry.afterFailureMs) || failure.retry.afterFailureMs.length === 0
      || failure.retry.attemptDelaysMs.length > 7 || failure.retry.afterFailureMs.length > 8) fail("failure.retry");
  failure.retry.attemptDelaysMs.forEach((ms) => positive(ms, "failure.retry.attemptDelaysMs", fail));
  failure.retry.afterFailureMs.forEach((ms) => positive(ms, "failure.retry.afterFailureMs", fail));
  if (failure.transport === "network") {
    positive(failure.timeout?.connectMs, "failure.timeout.connectMs", fail);
    positive(failure.timeout?.readMs, "failure.timeout.readMs", fail);
    if (!["serve-stale", "fail"].includes(failure.offline)) fail("failure.offline");
    if (failure.offline === "serve-stale" && failure.cache?.kind === "none") fail("failure.cache for serve-stale");
  }
  if (failure.cache?.kind === "value" || failure.cache?.kind === "coverage") {
    positive(failure.cache.maxAgeMs, "failure.cache.maxAgeMs", fail);
    if (failure.cache.homeRadiusM !== undefined) positive(failure.cache.homeRadiusM, "failure.cache.homeRadiusM", fail);
    if (failure.cache.onFailure !== "keep-last-good") fail("failure.cache.onFailure");
  } else if (failure.cache?.kind !== "none") fail("failure.cache.kind");
  if (!["as-failure", "stop"].includes(spec.onCrash)) fail("onCrash");
  if (!Array.isArray(spec.effectIds) || new Set(spec.effectIds).size !== spec.effectIds.length
      || spec.effectIds.some((id) => typeof id !== "string" || id.length === 0)) fail("effectIds");
  return Object.freeze({ ...spec, pattern: "fetch" as const,
    cadenceMs: spec.flow.everyMs, requestSpacingMs: spec.flow.minSpacingMs });
}

function positive(value: unknown, field: string, fail: (field: string) => never): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) fail(field);
}
