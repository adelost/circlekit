import {
  PORTABLE_SURFACE_CLASSES,
  defineComponentCatalog,
  defineLegoSpec,
  definePalette,
  defineProduct,
  defineScreenComponentFamilyRegistry,
  field,
  mount,
  port,
  type ProductIr,
} from "@v1d/product-spec";
import { CIRCLEKIT_ASSET_CATALOG } from "@v1d/circlekit-assets";
import { showcaseCases, showcaseSections } from "./catalog.js";
import type { ShowcaseNativeRegistry } from "./native-registry.js";

export const SHOWCASE_ARTIFACT_PROFILES = ["phone-full-ui", "wear-full-ui"] as const;

const showcasePalette = definePalette([{
  id: "circlekit",
  identity: {},
  categories: [],
  status: {},
  ramps: [],
}] as const);

const catalogState = {
  id: "showcase.catalog-state",
  kind: "snapshot",
  fields: [field("revision", "integer")],
} as const;
const navigationState = {
  id: "showcase.navigation-state",
  kind: "state",
  fields: [field("route", "string")],
} as const;
const navigationAction = {
  id: "showcase.navigation-action",
  kind: "event",
  fields: [field("route", "string")],
} as const;

const catalogSource = defineLegoSpec({
  id: "showcase.catalog-source",
  role: "source",
  inputs: [],
  outputs: [port("catalog", catalogState)],
  runtime: {
    stateOwner: "none", lifetime: "process", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: [],
  },
} as const);

const navigationController = defineLegoSpec({
  id: "showcase.navigation-controller",
  role: "adapter",
  inputs: [port("open", navigationAction)],
  outputs: [port("destination", navigationState)],
  runtime: {
    stateOwner: "instance", lifetime: "instance", durability: "transient",
    clockDomain: "none", contextInputs: [], effects: [],
  },
} as const);

const mounts = [
  mount("catalog", catalogSource),
  mount("navigation", navigationController),
] as const;

export const showcaseComponentCatalog = defineComponentCatalog(
  showcaseCases.map(({ id }) => ({ id })),
);

export const showcaseComponentFamilies = defineScreenComponentFamilyRegistry(
  showcaseComponentCatalog,
  showcaseSections.map((section) => ({
    screen: `section.${section.id}`,
    family: {
      id: `showcase.${section.id}`,
      trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
        surface,
        mounts: showcaseCases
          .filter(({ section: candidate }) => candidate === section.id)
          .map(({ id }) => ({
            component: id,
            region: surface === "round" ? "face" : "content",
          })),
      })),
    },
  })),
);

const baseProduct = defineProduct({
  id: "circlekit-showcase",
  rendererBindings: [
    {
      id: "android-phone-compose",
      capabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
    },
    {
      id: "android-wear-compose",
      capabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
    },
  ],
  artifacts: [
    {
      id: "phone-full-ui",
      rendererRefs: ["android-phone-compose"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      serves: ["compact", "wide"],
    },
    {
      id: "wear-full-ui",
      rendererRefs: ["android-wear-compose"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      serves: ["round"],
    },
  ],
  legos: {
    id: "circlekit-showcase.graph",
    configs: [],
    mounts,
    wiring: [],
  },
  componentCatalog: showcaseComponentCatalog,
  componentFamilies: showcaseComponentFamilies,
  palette: showcasePalette,
  assetCatalogRef: {
    id: CIRCLEKIT_ASSET_CATALOG.id,
    version: CIRCLEKIT_ASSET_CATALOG.version,
  },
  iconRefs: [...new Set([
    ...showcaseSections.map(({ iconId }) => iconId),
    ...showcaseCases.map(({ iconId }) => iconId),
  ])].map((assetRef) => ({
    id: `showcase.${assetRef}`,
    assetRef,
    artifacts: SHOWCASE_ARTIFACT_PROFILES,
  })),
  ui: [
    {
      id: "showcase.menu",
      kind: "menu-entry",
      artifacts: SHOWCASE_ARTIFACT_PROFILES,
      requiredCapabilities: ["ui.menu", "ui.navigation"],
      ports: { state: "catalog.catalog", action: "navigation.open" },
    },
    {
      id: "showcase.component",
      kind: "component-entry",
      artifacts: SHOWCASE_ARTIFACT_PROFILES,
      requiredCapabilities: ["ui.component-tree"],
      ports: { state: "navigation.destination" },
    },
  ],
}, CIRCLEKIT_ASSET_CATALOG);

export interface CircleKitShowcaseProductIr extends ProductIr {
  readonly productSpecVersion: string;
  readonly showcase: {
    readonly sections: typeof showcaseSections;
    readonly cases: typeof showcaseCases;
  };
}

export function compileCircleKitShowcaseProduct(
  registry: ShowcaseNativeRegistry,
  productSpecVersion: string,
): CircleKitShowcaseProductIr {
  requireCatalogSound();
  requireNativeParity(registry);
  if (productSpecVersion.trim() === "") throw new Error("ProductSpec package version is blank");
  return {
    ...baseProduct,
    productSpecVersion,
    showcase: { sections: showcaseSections, cases: showcaseCases },
  };
}

function requireCatalogSound(): void {
  requireUnique(showcaseSections.map(({ id }) => id), "section id");
  requireUnique(showcaseCases.map(({ id }) => id), "case id");
  for (const section of showcaseSections) {
    if (!showcaseCases.some(({ section: candidate }) => candidate === section.id)) {
      throw new Error(`section '${section.id}' has no case`);
    }
  }
  for (const item of showcaseCases) {
    const scenarioCount: number = item.scenarios.length;
    if (scenarioCount === 0) throw new Error(`case '${item.id}' has no scenario`);
    requireUnique(item.scenarios.map(({ id }) => id), `scenario in '${item.id}'`);
  }
}

function requireNativeParity(registry: ShowcaseNativeRegistry): void {
  requireUnique(registry.components.map(({ componentId }) => componentId), "native component id");
  requireUnique(registry.icons.map(({ iconId }) => iconId), "native icon id");
  const declaredComponents = new Set(showcaseCases.map(({ id }) => id));
  const nativeComponents = new Set(registry.components.map(({ componentId }) => componentId));
  requireExactSet(declaredComponents, nativeComponents, "component/native binding");

  const profiles = new Set<string>(SHOWCASE_ARTIFACT_PROFILES);
  for (const binding of registry.components) {
    requireUnique(binding.profiles, `profile in native component '${binding.componentId}'`);
    requireExactSet(profiles, new Set(binding.profiles), `profile in native component '${binding.componentId}'`);
  }

  const declaredIcons = new Set([
    ...showcaseSections.map(({ iconId }) => iconId),
    ...showcaseCases.map(({ iconId }) => iconId),
  ]);
  const nativeIcons = new Set(registry.icons.map(({ iconId }) => iconId));
  requireExactSet(declaredIcons, nativeIcons, "icon/native binding");
}

function requireExactSet(left: ReadonlySet<string>, right: ReadonlySet<string>, owner: string): void {
  const missing = [...left].filter((id) => !right.has(id));
  const orphan = [...right].filter((id) => !left.has(id));
  if (missing.length > 0) throw new Error(`${owner} missing '${missing.join("', '")}'`);
  if (orphan.length > 0) throw new Error(`${owner} orphan '${orphan.join("', '")}'`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
