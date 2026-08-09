import { port, present, service } from "@v1d/product-spec";
import { showcaseCases } from "./catalog.js";
import {
  showcaseCatalogContract,
  showcaseNavigationContract,
  showcaseOpenActionContract,
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
  inputs: showcaseCases.map(({ openPort }) => port(openPort, showcaseOpenActionContract)),
  outputs: [port("destination", showcaseNavigationContract)],
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

export const showcaseNodeTypes = [
  showcaseCatalogPresentation,
  showcaseNavigationService,
  showcaseNavigationPresentation,
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
    bindings: navigationBindings(showcaseCases),
    activation: { kind: "lifetime", lifecycleSources: [] },
  },
  {
    id: "navigation.presentation",
    nodeTypeRef: showcaseNavigationPresentation.id,
    config: {},
    bindings: { destination: "navigation.destination" },
  },
] as const;

type ShowcaseCase = (typeof showcaseCases)[number];
type NavigationBindings<Cases extends readonly ShowcaseCase[]> = {
  readonly [Case in Cases[number] as Case["openPort"]]: `${Case["id"]}.open`;
};

function navigationBindings<const Cases extends readonly ShowcaseCase[]>(
  cases: Cases,
): NavigationBindings<Cases> {
  return Object.fromEntries(cases.map(({ id, openPort }) => [openPort, `${id}.open`])) as NavigationBindings<Cases>;
}
