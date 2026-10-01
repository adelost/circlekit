/**
 * `@v1d/skydiving-legos/wire`: the HTTP bodies between a skydiving app and its servers. Kept apart from the catalog,
 * because a wire contract is read at an HTTP boundary, not wired into a product graph.
 */
export * from "./trackbook.js";
