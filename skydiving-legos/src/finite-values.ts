/**
 * The finite spaces the skydiving legos name.
 *
 * A lego reaches a finite space by wire id, never by import, so a catalog that
 * ships the contracts without these declarations compiles and then fails the
 * moment a product tries to use it: `contract '...' uses unknown finite value
 * '...'`. Carrying them here is what makes the package self-contained.
 *
 * Every declaration below is the byte-for-byte value list Skyvw shipped, so the
 * lift cannot change a single member. Skyvw's own finite-values.ts declares 54
 * spaces; the other 37 are product-owned (presentation tones, menu actions, home
 * intents) and deliberately stay behind — a tone is how one product paints a
 * state, not what the domain knows.
 */
import { finiteProduct, finiteValues } from "@v1d/product-spec";

const weatherOperationStatusValues = [
  "waiting-for-home", "fetching", "ready",
  "failed-offline", "failed-timeout", "failed-dns", "failed-tls",
  "failed-connection", "failed-http", "failed-no-usable-data", "failed-unknown",
] as const;
const weatherDataFreshnessValues = ["missing", "current", "stale", "expired"] as const;

/**
 * Kept as named consts because weather.presentation-case is their PRODUCT.
 * A catalog that carried only the composite would reserve an id whose two
 * axes nothing else could name.
 */
export const weatherOperationStatuses = finiteValues(
  "weather.operation-status",
  weatherOperationStatusValues,
);
export const weatherDataFreshnesses = finiteValues(
  "weather.data-freshness",
  weatherDataFreshnessValues,
);
export const weatherPresentationCases = finiteProduct(
  "weather.presentation-case",
  [weatherOperationStatuses, weatherDataFreshnesses],
);

export const weatherSelectedTimeStates = finiteValues(
  "weather.selected-time-state",
  [
    "idle", "loading", "ready", "unavailable",
    "failed-offline", "failed-timeout", "failed-dns", "failed-tls",
    "failed-connection", "failed-http", "failed-unknown",
  ],
);

export const positionAvailabilities = finiteValues(
  "position.availability",
  ["off", "precise-required", "subscribing", "live", "coarse", "stale", "failed"],
);
export const positionWeatherReadinesses = finiteValues(
  "position.weather-readiness",
  ["ready", "waiting-for-home"],
);

export const recordingStages = finiteValues(
  "recording.stage",
  ["stopped", "armed", "recording"],
);

export const flightPhases = finiteValues(
  "flight.phase",
  ["ground", "ascent", "freefall", "canopy", "landed"],
);
export const autoGroundReferenceModes = finiteValues(
  "flight.auto-ground-reference-mode",
  ["acquiring", "locked", "air-locked", "simulated", "no-sensor", "correction-refused"],
);

export const watchAccountStates = finiteValues(
  "sync.watch-account-state",
  [
    "loading", "disconnected", "starting", "pairing", "connected", "disconnecting",
    "disconnect-failed", "failed",
  ],
);

/** The spaces Skyvw declared inline inside its array; same values, named here. */
export const pressureAccuracies = finiteValues(
  "pressure.accuracy",
  ["unreliable", "low", "medium", "high", "unknown"],
);
export const pressureSources = finiteValues("pressure.source", ["physical", "debug"]);
export const flightAltitudeTrends = finiteValues(
  "flight.altitude-trend",
  ["ascending", "descending", "stable"],
);
export const weatherPriorities = finiteValues(
  "weather.priority",
  ["unavailable", "normal", "high"],
);
export const watchAccountActions = finiteValues(
  "sync.watch-account-action",
  ["start-pairing", "disconnect"],
);
export const altitudeReferenceActions = finiteValues(
  "flight.altitude-reference-action",
  ["restore", "weather", "metar", "zero"],
);
export const statusRefreshSources = finiteValues(
  "runtime.status-refresh-source",
  ["weather", "airport-pressure", "map-data", "aircraft", "network-probe"],
);

/**
 * Never declared in Skyvw's appspec at all — read off the native enum instead.
 *
 * `runtime.fetch-request` names this space, and no product ever consumed that
 * contract, so the compiler never had to resolve the reference and nothing
 * failed. A catalog validates its own contracts, so the reference has to
 * resolve here. The values are Kotlin's `FetchSource`
 * (altimeter/FetchSource.kt), lower-kebab like every other space in this file.
 *
 * Its sibling `runtime.status-refresh-source` above is a DIFFERENT, narrower
 * space that happens to overlap: it has network-probe, which is not a fetch,
 * and lacks cloud and the two map sources. They are not merged for that reason.
 */
export const fetchSources = finiteValues(
  "runtime.fetch-source",
  ["weather", "cloud", "map-objects", "map-tiles", "airport-pressure", "aircraft"],
);

export const skydivingFiniteValues = [
  weatherOperationStatuses,
  weatherDataFreshnesses,
  weatherPresentationCases,
  weatherSelectedTimeStates,
  weatherPriorities,
  positionAvailabilities,
  positionWeatherReadinesses,
  recordingStages,
  flightPhases,
  autoGroundReferenceModes,
  flightAltitudeTrends,
  altitudeReferenceActions,
  pressureAccuracies,
  pressureSources,
  watchAccountStates,
  watchAccountActions,
  statusRefreshSources,
  fetchSources,
] as const;
