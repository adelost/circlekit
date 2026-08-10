import {
  assertProductArtifactConformance,
  defineProduct,
  productArtifactHostCoverage,
  type NativeBindingManifest,
  type ProductIr,
} from "@v1d/product-spec";
import { CIRCLEKIT_ASSET_CATALOG } from "@v1d/circlekit-assets";
import { showcaseCases, showcaseSections } from "./catalog.js";
import { showcaseComponentInstances, showcaseComponentTypes } from "./graph-components.js";
import { SHOWCASE_SECTION_SCREENS, showcaseComponentFamilies } from "./graph-families.js";
import { showcaseNodes, showcaseNodeTypes } from "./graph-nodes.js";

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
      screenRefs: SHOWCASE_SECTION_SCREENS,
      serves: ["compact", "wide"],
    },
    {
      id: "wear-full-ui",
      rendererRefs: ["android-wear-compose"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      screenRefs: SHOWCASE_SECTION_SCREENS,
      serves: ["round"],
    },
    {
      id: "iphone-full-ui",
      rendererRefs: ["apple-iphone-swiftui"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      screenRefs: SHOWCASE_SECTION_SCREENS,
      serves: ["compact", "wide"],
    },
    {
      id: "watchos-full-ui",
      rendererRefs: ["apple-watchos-swiftui"],
      requiredCapabilities: ["ui.menu", "ui.navigation", "ui.component-tree"],
      entryScreen: "section.foundations",
      screenRefs: SHOWCASE_SECTION_SCREENS,
      serves: ["round"],
    },
    {
      id: "garmin-limited-ui",
      rendererRefs: ["garmin-connectiq-monkeyc"],
      requiredCapabilities: ["ui.component-tree"],
      entryScreen: "artifact.garmin-limited-ui",
      screenRefs: ["artifact.garmin-limited-ui"],
      serves: ["round"],
    },
  ],
  nodeTypes: showcaseNodeTypes,
  nodes: showcaseNodes,
  configs: [],
  // Showcase demonstrates components, not domain state, so it owns no closed value
  // space. The field is required rather than optional so that "none" is something a
  // product says out loud: an omitted section reads as coverage to anything that
  // compares this declaration against a native binding manifest.
  finiteValues: [],
  // Schema 8 makes authority ownership mandatory. The compiler accepts this empty
  // set only because the graph above exposes no finite-valued state axis to UI.
  stateAuthorities: [],
  componentTypes: showcaseComponentTypes,
  components: showcaseComponentInstances,
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
}, CIRCLEKIT_ASSET_CATALOG);

export interface CircleKitShowcaseProductIr extends ProductIr {
  readonly productSpecVersion: string;
  readonly showcase: {
    readonly sections: typeof showcaseSections;
    readonly cases: typeof showcaseCases;
  };
}

export function compileCircleKitShowcaseProduct(
  productSpecVersion: string,
): CircleKitShowcaseProductIr {
  requireCatalogSound();
  if (productSpecVersion.trim() === "") throw new Error("ProductSpec package version is blank");
  const ir: CircleKitShowcaseProductIr = {
    ...baseProduct,
    productSpecVersion,
    showcase: { sections: showcaseSections, cases: showcaseCases },
  };
  return ir;
}

export function requireCircleKitShowcaseNativeConformance(
  product: CircleKitShowcaseProductIr,
  androidManifest: NativeBindingManifest,
  manifests: readonly NativeBindingManifest[],
): void {
  if (!manifests.includes(androidManifest)) {
    throw new Error("Showcase native host set omits its Android manifest");
  }
  requireEveryComponentOnEveryAndroidProfile(androidManifest);
  for (const manifest of manifests) {
    assertProductArtifactConformance(product, manifest);
  }
  const uncovered = productArtifactHostCoverage(product, manifests);
  if (uncovered.length > 0) {
    throw new Error(uncovered.map(({ axis, direction, message }) =>
      `[${axis}/${direction}] ${message}`).join("\n"));
  }
}

/**
 * A Showcase product rule, deliberately NOT a conformance axis.
 *
 * Showcase exists to demonstrate every component on every Android form factor, so a
 * component bound to only one of them is a hole in the demo. Shared conformance proves
 * every declared artifact scope; this local rule keeps the stronger Showcase invariant
 * explicit and gives the native author the direct all-Android-profiles diagnostic.
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
