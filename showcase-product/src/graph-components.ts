import { componentPort, defineComponentType } from "@v1d/product-spec";
import { showcaseCases } from "./catalog.js";
import {
  showcaseActivePageContract,
  showcaseCatalogContract,
  showcaseNavigationContract,
  showcaseOpenActionContract,
  showcaseRendererActionContract,
  showcaseRendererContract,
  showcaseRouteContract,
} from "./graph-contracts.js";

type ShowcaseCase = (typeof showcaseCases)[number];
type ReadOnlyShowcaseCase = Extract<
  ShowcaseCase,
  { readonly id: "foundation.colors" } | { readonly id: "foundation.geometry" }
>;
type InteractiveShowcaseCase = Exclude<ShowcaseCase, ReadOnlyShowcaseCase>;
const readOnlyCases = showcaseCases.filter(isReadOnlyCase);
const interactiveCases = showcaseCases.filter(isInteractiveCase);

/**
 * Each catalog case is a real semantic component type. The native renderer owns
 * its pixels, while ProductSpec owns the immutable inputs and typed open event.
 */
export const showcaseComponentTypes = [
  ...readOnlyCases.map(({ id }) => defineComponentType({
    id,
    requiredCapabilities: ["ui.component-tree"],
    inputs: [
      componentPort("catalog", showcaseCatalogContract),
      componentPort("navigation", showcaseNavigationContract),
    ],
    outputs: [],
  } as const)),
  ...interactiveCases.map(({ id }) => defineComponentType({
    id,
    requiredCapabilities: ["ui.component-tree"],
    inputs: [
      componentPort("catalog", showcaseCatalogContract),
      componentPort("navigation", showcaseNavigationContract),
      componentPort("renderer", showcaseRendererContract),
    ],
    outputs: [componentPort("action", showcaseRendererActionContract)],
  } as const)),
] as const;

/** One semantic instance is reused by every surface and artifact that mounts it. */
export const showcaseComponentInstances = [
  ...readOnlyCases.map(({ id }) => ({
    id,
    componentTypeRef: id,
    bindings: {
      inputs: {
        catalog: "catalog.model" as const,
        navigation: "navigation.presentation.model" as const,
      },
      events: {},
    },
  } as const)),
  ...interactiveCases.map(({ id, openPort }) => ({
    id,
    componentTypeRef: id,
    bindings: {
      inputs: {
        catalog: "catalog.model" as const,
        navigation: "navigation.presentation.model" as const,
        renderer: "renderer.presentation.model" as const,
      },
      events: { action: `renderer.${openPort}` as `renderer.${typeof openPort}` },
    },
  } as const)),
] as const;

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
  outputs: [
    componentPort("route", showcaseRouteContract),
    ...showcaseCases.map(({ openPort }) => componentPort(openPort, showcaseOpenActionContract)),
  ],
} as const);

export const showcasePageMenu = {
  id: "page.menu",
  componentTypeRef: showcasePageMenuType.id,
  bindings: {
    inputs: {},
    events: pageMenuBindings(showcaseCases),
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

function isReadOnlyCase(value: ShowcaseCase): value is ReadOnlyShowcaseCase {
  return value.id === "foundation.colors" || value.id === "foundation.geometry";
}

function isInteractiveCase(value: ShowcaseCase): value is InteractiveShowcaseCase {
  return !isReadOnlyCase(value);
}

type PageMenuBindings<Cases extends readonly ShowcaseCase[]> = {
  readonly route: "navigation.route";
} & {
  readonly [Case in Cases[number] as Case["openPort"]]: `navigation.${Case["openPort"]}`;
};

function pageMenuBindings<const Cases extends readonly ShowcaseCase[]>(cases: Cases): PageMenuBindings<Cases> {
  return {
    route: "navigation.route",
    ...Object.fromEntries(cases.map(({ openPort }) => [openPort, `navigation.${openPort}`])),
  } as PageMenuBindings<Cases>;
}
