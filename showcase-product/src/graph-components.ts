import { componentPort, defineComponentType } from "@v1d/product-spec";
import { showcaseCases } from "./catalog.js";
import {
  showcaseCatalogContract,
  showcaseNavigationContract,
  showcaseOpenActionContract,
} from "./graph-contracts.js";

/**
 * Each catalog case is a real semantic component type. The native renderer owns
 * its pixels, while ProductSpec owns the immutable inputs and typed open event.
 */
export const showcaseComponentTypes = showcaseCases.map(({ id }) => defineComponentType({
  id,
  requiredCapabilities: ["ui.component-tree"],
  inputs: [
    componentPort("catalog", showcaseCatalogContract),
    componentPort("navigation", showcaseNavigationContract),
  ],
  outputs: [componentPort("open", showcaseOpenActionContract)],
}));

/** One semantic instance is reused by every surface and artifact that mounts it. */
export const showcaseComponentInstances = showcaseCases.map(({ id, openPort }) => ({
  id,
  componentTypeRef: id,
  bindings: {
    inputs: {
      catalog: "catalog.model" as const,
      navigation: "navigation.presentation.model" as const,
    },
    events: { open: `navigation.${openPort}` as `navigation.${typeof openPort}` },
  },
}));
