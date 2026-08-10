/**
 * `@v1d/skydiving-legos` — the domain a skydiving product is built from.
 *
 * The catalog is the package: pass `skydivingLegoCatalog` to `defineProduct`
 * and every contract, node type and finite space below is both available and
 * RESERVED, so a product that re-declares one fails to compile even if its copy
 * is identical. The individual exports are here for products that want to name
 * a contract directly when wiring their own nodes.
 */
export { skydivingLegoCatalog, skydivingContracts, skydivingNodeTypes, SKYDIVING_LEGO_MODULE_COUNT } from "./catalog.js";
export * from "./finite-values.js";

export * from "./legos/attitude.js";
export * from "./legos/clock.js";
export * from "./legos/complication.js";
export * from "./legos/flight.js";
export * from "./legos/location.js";
export * from "./legos/logbook.js";
export * from "./legos/map-data.js";
export * from "./legos/pressure.js";
export * from "./legos/recording.js";
export * from "./legos/settings.js";
export * from "./legos/simulation.js";
export * from "./legos/sync.js";
export * from "./legos/weather.js";
export * from "./legos/runtime-services.js";
