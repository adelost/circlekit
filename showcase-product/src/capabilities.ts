import { effectRows, type CapabilityTable } from "@v1d/product-emit/core";

/**
 * Capability vocabulary for the generated DEMO CATALOG, whose only external
 * effect is navigation. Android host tools and the real ReleaseKit updater
 * are native host facilities, not simulated network nodes in this graph.
 * Unknown catalog effects fail compilation.
 */
export const showcaseCapabilityTable: CapabilityTable = {
  sourceFile: "showcase-product/src/capabilities.ts",
  capabilities: [],
  effects: effectRows("NAVIGATION", ["ui.navigation"]),
};
