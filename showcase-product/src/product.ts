import {
  PORTABLE_SURFACE_CLASSES,
  defineComponentCatalog,
  defineLegoSpec,
  defineProduct,
  defineScreenComponentFamilyRegistry,
  field,
  mount,
  port,
  assertProductArtifactConformance,
  type NativeBindingManifest,
  type ProductIr,
} from "@v1d/product-spec";
import { CIRCLEKIT_ASSET_CATALOG } from "@v1d/circlekit-assets";
import { showcaseCases, showcaseSections } from "./catalog.js";

const SHOWCASE_ANDROID_ARTIFACT_PROFILES = ["phone-full-ui", "wear-full-ui"] as const;
const SHOWCASE_FULL_UI_ARTIFACT_PROFILES = [
  ...SHOWCASE_ANDROID_ARTIFACT_PROFILES,
  "iphone-full-ui",
  "watchos-full-ui",
] as const;
export const SHOWCASE_ARTIFACT_PROFILES = [
  ...SHOWCASE_FULL_UI_ARTIFACT_PROFILES,
  "garmin-limited-ui",
] as const;

const showcasePalette = { variants: [] } as const;

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
  [
    ...showcaseSections.map((section) => ({
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
    {
      screen: "artifact.garmin-limited-ui",
      family: {
        id: "showcase.garmin-limited-ui",
        trees: PORTABLE_SURFACE_CLASSES.map((surface) => ({
          surface,
          mounts: [{ component: "control.progress", region: surface === "round" ? "face" : "content" }],
        })),
      },
    },
  ],
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
    {
      id: "apple-iphone-swiftui",
      capabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
    },
    {
      id: "apple-watchos-swiftui",
      capabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
    },
    {
      id: "garmin-connectiq-monkeyc",
      capabilities: ["ui.component-tree"],
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
    {
      id: "iphone-full-ui",
      rendererRefs: ["apple-iphone-swiftui"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      serves: ["compact", "wide"],
    },
    {
      id: "watchos-full-ui",
      rendererRefs: ["apple-watchos-swiftui"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      serves: ["round"],
    },
    {
      id: "garmin-limited-ui",
      rendererRefs: ["garmin-connectiq-monkeyc"],
      requiredCapabilities: ["ui.component-tree"],
      entryScreen: "artifact.garmin-limited-ui",
      serves: ["round"],
    },
  ],
  legos: {
    id: "circlekit-showcase.graph",
    configs: [],
    mounts,
    wiring: [],
  },
  // Showcase demonstrates components, not domain state, so it owns no closed value
  // space. The field is required rather than optional so that "none" is something a
  // product says out loud: an omitted section reads as coverage to anything that
  // compares this declaration against a native binding manifest.
  finiteValues: [],
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
    artifacts: assetRef === "download"
      ? SHOWCASE_ARTIFACT_PROFILES
      : SHOWCASE_FULL_UI_ARTIFACT_PROFILES,
  })),
  ui: [
    {
      id: "showcase.menu",
      kind: "menu-entry",
      artifacts: SHOWCASE_FULL_UI_ARTIFACT_PROFILES,
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
  manifest: NativeBindingManifest,
  productSpecVersion: string,
): CircleKitShowcaseProductIr {
  requireCatalogSound();
  if (productSpecVersion.trim() === "") throw new Error("ProductSpec package version is blank");
  const ir: CircleKitShowcaseProductIr = {
    ...baseProduct,
    productSpecVersion,
    showcase: { sections: showcaseSections, cases: showcaseCases },
  };
  // Conformance runs on the COMPILED ir, not on the catalog it was built from. The
  // local version compared showcaseCases against the manifest directly, which meant a
  // defect introduced between the catalog and the compiled product was invisible to
  // the very check meant to catch it.
  assertProductArtifactConformance(ir, manifest);
  requireEveryComponentOnEveryAndroidProfile(manifest);
  return ir;
}

/**
 * A Showcase product rule, deliberately NOT a conformance axis.
 *
 * Showcase exists to demonstrate every component on every Android form factor, so a
 * component bound to only one of them is a hole in the demo. Conformance cannot check
 * this for anyone: the component catalog records ids, not which artifacts a component
 * belongs to, so there is nothing product-side to compare a subset against.
 *
 * Kept local rather than dropped. The shared helper replacing the old parity function
 * covers product-to-manifest agreement, and this covers a rule only this product has.
 */
function requireEveryComponentOnEveryAndroidProfile(manifest: NativeBindingManifest): void {
  const expected = [...SHOWCASE_ANDROID_ARTIFACT_PROFILES].sort().join(", ");
  for (const { componentId, profiles } of manifest.components) {
    if (new Set(profiles).size !== profiles.length) {
      throw new Error(`native component '${componentId}' repeats a profile`);
    }
    const actual = [...profiles].sort().join(", ");
    if (actual !== expected) {
      throw new Error(
        `native component '${componentId}' renders on [${actual}], ` +
        `but Showcase demonstrates every component on [${expected}]`,
      );
    }
  }
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



function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
