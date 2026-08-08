import {
  defineProduct,
  type NativeBindingManifest,
  type ProductIr,
} from "@v1d/product-spec";
import { CIRCLEKIT_ASSET_CATALOG } from "@v1d/circlekit-assets";
import { showcaseCases, showcaseSections } from "./catalog.js";
import { showcaseComponentInstances, showcaseComponentTypes } from "./graph-components.js";
import { SHOWCASE_SECTION_SCREENS, showcaseComponentFamilies } from "./graph-families.js";
import { showcaseServices, showcaseServiceTypes } from "./graph-services.js";

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
  serviceTypes: showcaseServiceTypes,
  services: showcaseServices,
  configs: [],
  // Showcase demonstrates components, not domain state, so it owns no closed value
  // space. The field is required rather than optional so that "none" is something a
  // product says out loud: an omitted section reads as coverage to anything that
  // compares this declaration against a native binding manifest.
  finiteValues: [],
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
  requireEveryComponentOnEveryAndroidProfile(manifest);
  requireNativeHostConformance(ir, manifest);
  requireExactNativeServices(ir, manifest);
  return ir;
}

function requireNativeHostConformance(
  product: CircleKitShowcaseProductIr,
  manifest: NativeBindingManifest,
): void {
  if (manifest.profiles === undefined) throw new Error("Showcase native artifact profiles are unasserted");
  const hostProfiles = new Set(manifest.profiles);
  const declaredProfiles = new Set(product.artifacts.map(({ id }) => id));
  for (const profile of hostProfiles) {
    if (!declaredProfiles.has(profile)) throw new Error(`[artifact/orphan] artifact profile '${profile}'`);
  }
  const typeByInstance = new Map(product.components.map(({ id, componentTypeRef }) => [id, componentTypeRef]));
  const expected = new Set(product.artifactScopes
    .filter(({ artifactRef }) => hostProfiles.has(artifactRef))
    .flatMap(({ artifactRef, includedMounts }) => includedMounts.map(({ componentInstanceRef }) => {
      const type = typeByInstance.get(componentInstanceRef);
      if (type === undefined) throw new Error(`artifact scope uses missing component '${componentInstanceRef}'`);
      return `${type}@${artifactRef}`;
    })));
  const actual = new Set(manifest.components.flatMap(({ componentId, profiles }) =>
    profiles.map((profile) => `${componentId}@${profile}`)));
  const findings = [
    ...[...expected].filter((id) => !actual.has(id)).map((id) => `[component/missing] component binding '${id}'`),
    ...[...actual].filter((id) => !expected.has(id)).map((id) => `[component/orphan] component binding '${id}'`),
  ];
  if (findings.length > 0) throw new Error(findings.join("\n"));

  const selectedInstances = new Set(product.artifactScopes
    .filter(({ artifactRef }) => hostProfiles.has(artifactRef))
    .flatMap(({ includedMounts }) => includedMounts.map(({ componentInstanceRef }) => componentInstanceRef)));
  const expectedIcons = new Set<string>(product.showcase.cases
    .filter(({ id }) => selectedInstances.has(id)).map(({ iconId }) => iconId));
  const actualIcons = new Set(manifest.icons.map(({ iconId }) => iconId));
  const iconFindings = [
    ...[...expectedIcons].filter((id) => !actualIcons.has(id)).map((id) => `[icon/missing] icon asset '${id}'`),
    ...[...actualIcons].filter((id) => !expectedIcons.has(id)).map((id) => `[icon/orphan] icon asset '${id}'`),
  ];
  if (iconFindings.length > 0) throw new Error(iconFindings.join("\n"));
}

function requireExactNativeServices(
  product: CircleKitShowcaseProductIr,
  manifest: NativeBindingManifest,
): void {
  if (manifest.services === undefined) throw new Error("Showcase native services are unasserted");
  requireUnique(manifest.services.map(({ serviceId }) => serviceId), "native service binding");
  const expectedIds = product.services.map(({ id }) => id).sort();
  const actualIds = manifest.services.map(({ serviceId }) => serviceId).sort();
  if (expectedIds.join(",") !== actualIds.join(",")) {
    throw new Error(`Showcase native services differ: expected [${expectedIds}] actual [${actualIds}]`);
  }
  const expectedProfiles = [...SHOWCASE_ANDROID_ARTIFACT_PROFILES].sort().join(",");
  for (const service of manifest.services) {
    const actualProfiles = [...service.profiles].sort().join(",");
    if (actualProfiles !== expectedProfiles) {
      throw new Error(`Showcase native service '${service.serviceId}' has profiles [${actualProfiles}]`);
    }
    const ports = product.portRegistry.servicePorts.filter(({ ownerId }) => ownerId === service.serviceId);
    const expectedInputs = ports.filter(({ direction }) => direction === "input").map(({ portId }) => portId).sort();
    const expectedOutputs = ports.filter(({ direction }) => direction === "output").map(({ portId }) => portId).sort();
    const actualInputs = [...service.inputPorts].sort();
    const actualOutputs = [...service.outputPorts].sort();
    if (expectedInputs.join(",") !== actualInputs.join(",") ||
        expectedOutputs.join(",") !== actualOutputs.join(",")) {
      throw new Error(
        `Showcase native service '${service.serviceId}' ports differ: ` +
        `inputs [${actualInputs}] outputs [${actualOutputs}]`,
      );
    }
  }
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
