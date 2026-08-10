import { componentPort, defineComponentType } from "@v1d/product-spec";
import { showcaseCases } from "./catalog.js";
import {
  showcaseActivePageContract,
  showcaseCatalogContract,
  showcaseNavigationContract,
  showcaseOpenActionContract,
  showcaseRouteContract,
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

/** The native page container consumes the single active-page publication. */
export const showcasePageHostType = defineComponentType({
  id: "showcase.page-host",
  requiredCapabilities: ["ui.component-tree"],
  inputs: [componentPort("activePage", showcaseActivePageContract)],
  outputs: [],
} as const);

export const showcasePageHost = {
  id: "page.host",
  componentTypeRef: showcasePageHostType.id,
  bindings: {
    inputs: { activePage: "navigation.activePage" },
    events: {},
  },
} as const;

/** Full-UI section launchers publish the closed RouteIntent payload. */
export const showcasePageMenuType = defineComponentType({
  id: "showcase.page-menu",
  requiredCapabilities: ["ui.navigation"],
  inputs: [],
  outputs: [componentPort("route", showcaseRouteContract)],
} as const);

export const showcasePageMenu = {
  id: "page.menu",
  componentTypeRef: showcasePageMenuType.id,
  bindings: {
    inputs: {},
    events: { route: "navigation.route" },
  },
} as const;

export const showcaseAllComponentTypes = [
  ...showcaseComponentTypes,
  showcasePageHostType,
  showcasePageMenuType,
] as const;

export const showcaseAllComponentInstances = [
  ...showcaseComponentInstances,
  showcasePageHost,
  showcasePageMenu,
] as const;
