import { defineLegoSpec, port } from "@v1d/product-spec";
import { showcaseCases } from "./catalog.js";
import {
  showcaseCatalogContract,
  showcaseNavigationContract,
  showcaseOpenActionContract,
} from "./graph-contracts.js";

export const showcaseCatalogSource = defineLegoSpec({
  id: "showcase.catalog-source",
  role: "source",
  inputs: [],
  outputs: [port("catalog", showcaseCatalogContract)],
  runtime: {
    stateOwner: "none",
    lifetime: "process",
    durability: "transient",
    clockDomain: "none",
    contextInputs: [],
    effects: [],
  },
} as const);

export const showcaseNavigationController = defineLegoSpec({
  id: "showcase.navigation-controller",
  role: "adapter",
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

export const showcaseServiceTypes = [
  showcaseCatalogSource,
  showcaseNavigationController,
] as const;

export const showcaseServices = [
  {
    id: "catalog",
    serviceTypeRef: showcaseCatalogSource.id,
    config: {},
    bindings: {},
    activation: { kind: "lifetime", lifecycleSources: [] },
  },
  {
    id: "navigation",
    serviceTypeRef: showcaseNavigationController.id,
    config: {},
    bindings: navigationBindings(showcaseCases),
    activation: { kind: "lifetime", lifecycleSources: [] },
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
