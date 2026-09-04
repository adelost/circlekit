import { effectRows, type CapabilityTable } from "@v1d/product-emit/core";

/**
 * Showcase's host vocabulary. A component laboratory asks its host for
 * nothing and does one thing to the world: it navigates. The table is short
 * because the product is, not because anything is missing; a node that
 * spells a string not listed here fails compilation.
 */
export const showcaseCapabilityTable: CapabilityTable = {
  sourceFile: "showcase-product/src/capabilities.ts",
  capabilities: [],
  effects: effectRows("NAVIGATION", ["ui.navigation"]),
};
