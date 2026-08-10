import { port, present, service } from "@v1d/product-spec";
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

/** Generated catalog data is already the final immutable renderer model. */
export const showcaseCatalogPresentation = present({
  id: "showcase.catalog-presentation",
  inputs: [],
  outputs: [port("model", showcaseCatalogContract)],
  runtime: {
    stateOwner: "none",
    lifetime: "process",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
} as const);

/** The only effect owner: it mutates the host navigation stack. */
export const showcaseNavigationService = service({
  id: "showcase.navigation-service",
  inputs: [
    port("route", showcaseRouteContract),
    ...showcaseCases.map(({ openPort }) => port(openPort, showcaseOpenActionContract)),
  ],
  outputs: [
    port("activePage", showcaseActivePageContract),
    port("destination", showcaseNavigationContract),
  ],
  runtime: {
    stateOwner: "instance",
    lifetime: "instance",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: ["ui.navigation"],
  },
});

/** Navigation state crosses one explicit final presentation boundary. */
export const showcaseNavigationPresentation = present({
  id: "showcase.navigation-presentation",
  inputs: [port("destination", showcaseNavigationContract)],
  outputs: [port("model", showcaseNavigationContract)],
  runtime: {
    stateOwner: "none",
    lifetime: "instance",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
} as const);

/** Host-local deterministic fixture state; native producers stay behind this port. */
export const showcaseRendererService = service({
  id: "showcase.renderer-service",
  inputs: showcaseCases.filter(isInteractiveCase)
    .map(({ openPort }) => port(openPort, showcaseRendererActionContract)),
  outputs: [port("model", showcaseRendererContract)],
  runtime: {
    stateOwner: "instance",
    lifetime: "instance",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: ["ui.interaction"],
  },
});

export const showcaseRendererPresentation = present({
  id: "showcase.renderer-presentation",
  inputs: [port("model", showcaseRendererContract)],
  outputs: [port("model", showcaseRendererContract)],
  runtime: {
    stateOwner: "none",
    lifetime: "instance",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
} as const);

export const showcaseNodeTypes = [
  showcaseCatalogPresentation,
  showcaseNavigationService,
  showcaseNavigationPresentation,
  showcaseRendererService,
  showcaseRendererPresentation,
] as const;

export const showcaseNodes = [
  {
    id: "catalog",
    nodeTypeRef: showcaseCatalogPresentation.id,
    config: {},
    bindings: {},
  },
  {
    id: "navigation",
    nodeTypeRef: showcaseNavigationService.id,
    config: {},
    bindings: {
      route: "page.menu.route",
      ...navigationBindings(showcaseCases),
    },
    activation: { kind: "lifetime", lifecycleSources: [] },
  },
  {
    id: "navigation.presentation",
    nodeTypeRef: showcaseNavigationPresentation.id,
    config: {},
    bindings: { destination: "navigation.destination" },
  },
  {
    id: "renderer",
    nodeTypeRef: showcaseRendererService.id,
    config: {},
    bindings: rendererBindings(showcaseCases),
    activation: { kind: "lifetime", lifecycleSources: [] },
  },
  {
    id: "renderer.presentation",
    nodeTypeRef: showcaseRendererPresentation.id,
    config: {},
    bindings: { model: "renderer.model" },
  },
] as const;

type ShowcaseCase = (typeof showcaseCases)[number];
type NavigationBindings<Cases extends readonly ShowcaseCase[]> = {
  readonly [Case in Cases[number] as Case["openPort"]]: `page.menu.${Case["openPort"]}`;
};

function navigationBindings<const Cases extends readonly ShowcaseCase[]>(
  cases: Cases,
): NavigationBindings<Cases> {
  return Object.fromEntries(cases.map(({ openPort }) => [openPort, `page.menu.${openPort}`])) as NavigationBindings<Cases>;
}

type InteractiveShowcaseCase = Exclude<
  ShowcaseCase,
  { readonly id: "foundation.colors" } | { readonly id: "foundation.geometry" }
>;
type RendererBindings<Cases extends readonly ShowcaseCase[]> = {
  readonly [Case in Cases[number] as Case["id"] extends InteractiveShowcaseCase["id"] ? Case["openPort"] : never]: `${Case["id"]}.action`;
};

function rendererBindings<const Cases extends readonly ShowcaseCase[]>(
  cases: Cases,
): RendererBindings<Cases> {
  return Object.fromEntries(cases
    .filter(isInteractiveCase)
    .map(({ id, openPort }) => [openPort, `${id}.action`])) as RendererBindings<Cases>;
}

function isInteractiveCase(value: ShowcaseCase): value is InteractiveShowcaseCase {
  return value.id !== "foundation.colors" && value.id !== "foundation.geometry";
}
