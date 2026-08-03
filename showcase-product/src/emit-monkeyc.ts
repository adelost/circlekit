import type { ProductEmitterPlugin, ProductIr } from "@v1d/product-spec";
import type { CircleKitShowcaseProductIr } from "./product.js";

const GARMIN_CAPABILITIES = new Set(["ui.component-tree"]);
const GARMIN_NATIVE_SUPPORT: GarminRendererSupport = {
  id: "garmin-connectiq-monkeyc",
  surfaces: ["round"],
  componentIds: ["control.progress"],
  iconRefs: ["showcase.download"],
};

interface GarminRendererSupport {
  readonly id: string;
  readonly surfaces: readonly ("round" | "compact" | "wide")[];
  readonly componentIds: readonly string[];
  readonly iconRefs: readonly string[];
}

interface GarminStyle {
  readonly surface: string;
  readonly action: string;
  readonly actionMuted: string;
  readonly faint: string;
  readonly line: string;
}

interface GarminSelection {
  readonly artifactId: string;
  readonly rendererId: string;
  readonly screenId: string;
  readonly surface: "round" | "compact" | "wide";
  readonly componentId: string;
  readonly componentLabel: string;
  readonly componentOrder: number;
  readonly scenarioId: string;
  readonly scenarioLabel: string;
  readonly activeTicks: number;
  readonly paletteRef: string | undefined;
  readonly iconRef: string;
  readonly iconAssetRef: string;
}

export function showcaseGarminEmitter(
  path: string,
  style: GarminStyle,
): ProductEmitterPlugin {
  return {
    id: "showcase-garmin-limited-ui",
    emit(product) {
      const showcase = requireShowcaseProduct(product);
      const selection = selectLimitedUi(showcase, GARMIN_NATIVE_SUPPORT);
      return [{
        id: "showcase-garmin-limited-ui",
        path,
        mediaType: "text/x-monkey-c",
        content: emitMonkeyC(showcase, selection, style),
      }];
    },
  };
}

function requireShowcaseProduct(product: ProductIr): CircleKitShowcaseProductIr {
  if (product.id !== "circlekit-showcase" || !("showcase" in product)) {
    throw new Error("Showcase Garmin emitter received another product");
  }
  return product as CircleKitShowcaseProductIr;
}

function selectLimitedUi(
  product: CircleKitShowcaseProductIr,
  support: GarminRendererSupport,
): GarminSelection {
  const renderer = product.rendererBindings.find(({ id }) => id === support.id);
  if (renderer === undefined) throw new Error(`Showcase has no Garmin renderer '${support.id}'`);
  const artifacts = product.artifacts.filter(({ rendererRefs }) => rendererRefs.includes(support.id));
  if (artifacts.length !== 1) {
    throw new Error(`Showcase Garmin renderer '${support.id}' must own exactly one artifact, found ${artifacts.length}`);
  }
  const artifact = artifacts[0]!;
  const unsupportedCapability = artifact.requiredCapabilities.find((id) => !GARMIN_CAPABILITIES.has(id));
  if (unsupportedCapability !== undefined) {
    throw new Error(`Showcase Garmin lacks required capability '${unsupportedCapability}'`);
  }
  if (artifact.serves.length !== 1 || !support.surfaces.includes(artifact.serves[0]!)) {
    throw new Error(`Showcase Garmin artifact '${artifact.id}' has unsupported surfaces '${artifact.serves.join(",")}'`);
  }

  const surface = artifact.serves[0]!;
  const family = product.componentFamilies.find(({ screen }) => screen === artifact.entryScreen);
  const tree = family?.family.trees.find((candidate) => candidate.surface === surface);
  if (tree === undefined) throw new Error(`Showcase Garmin entry '${artifact.entryScreen}' lacks '${surface}' tree`);
  if (tree.mounts.length !== 1) {
    throw new Error(`Showcase Garmin limited UI requires exactly one mounted component, found ${tree.mounts.length}`);
  }
  const mount = tree.mounts[0]!;
  if (!support.componentIds.includes(mount.component)) {
    throw new Error(`Showcase Garmin has no native renderer for component '${mount.component}'`);
  }

  const component = product.showcase.cases.find(({ id }) => id === mount.component);
  const scenario = component?.scenarios[0];
  if (component === undefined || scenario === undefined) {
    throw new Error(`Showcase Garmin component '${mount.component}' has no default scenario`);
  }
  const icon = product.iconRefs.find(({ assetRef, artifacts: refs }) =>
    assetRef === component.iconId && refs.includes(artifact.id));
  if (icon === undefined) {
    throw new Error(`Showcase Garmin component '${mount.component}' lacks an icon ref for '${artifact.id}'`);
  }
  if (!support.iconRefs.includes(icon.id)) {
    throw new Error(`Showcase Garmin has no native renderer for icon '${icon.id}'`);
  }

  return {
    artifactId: artifact.id,
    rendererId: renderer.id,
    screenId: artifact.entryScreen,
    surface,
    componentId: mount.component,
    componentLabel: component.title,
    componentOrder: mount.order,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    activeTicks: progressTicks(scenario.id),
    paletteRef: product.palette.variants[0]?.id,
    iconRef: icon.id,
    iconAssetRef: icon.assetRef,
  };
}

function emitMonkeyC(
  product: CircleKitShowcaseProductIr,
  selection: GarminSelection,
  style: GarminStyle,
): string {
  const productLabel = product.id.split("-")[0]?.toUpperCase() ?? product.id.toUpperCase();
  const paletteLabel = selection.paletteRef?.toUpperCase() ?? "INHERITED";
  return `// Generated by showcase-product/src/generate.ts. Do not edit.
module GeneratedCircleKitShowcase {
    const PRODUCT_ID = ${monkeyString(product.id)};
    const PRODUCT_LABEL = ${monkeyString(productLabel)};
    const PRODUCT_SPEC_VERSION = ${monkeyString(product.productSpecVersion)};
    const ARTIFACT_ID = ${monkeyString(selection.artifactId)};
    const RENDERER_ID = ${monkeyString(selection.rendererId)};
    const SCREEN_ID = ${monkeyString(selection.screenId)};
    const SURFACE_CLASS = ${monkeyString(selection.surface)};
    const SURFACE_LABEL = ${monkeyString(selection.surface.toUpperCase())};
    const COMPONENT_ID = ${monkeyString(selection.componentId)};
    const COMPONENT_ID_LABEL = ${monkeyString(selection.componentId.toUpperCase())};
    const COMPONENT_LABEL = ${monkeyString(selection.componentLabel)};
    const COMPONENT_ORDER = ${selection.componentOrder};
    const SCENARIO_ID = ${monkeyString(selection.scenarioId)};
    const SCENARIO_LABEL = ${monkeyString(selection.scenarioLabel)};
    const ACTIVE_TICKS = ${selection.activeTicks};
    const PALETTE_REF = ${monkeyString(selection.paletteRef ?? "")};
    const FOOTER_LABEL = ${monkeyString(`${paletteLabel}  ORDER ${selection.componentOrder}`)};
    const ICON_REF = ${monkeyString(selection.iconRef)};
    const ICON_ASSET_REF = ${monkeyString(selection.iconAssetRef)};
    const COLOR_SURFACE = ${monkeyColor(style.surface)};
    const COLOR_ACTION = ${monkeyColor(style.action)};
    const COLOR_MUTED = ${monkeyColor(style.actionMuted)};
    const COLOR_FAINT = ${monkeyColor(style.faint)};
    const COLOR_LINE = ${monkeyColor(style.line)};
}
`;
}

function progressTicks(scenarioId: string): number {
  switch (scenarioId) {
    case "none":
    case "empty":
    case "failed": return 0;
    case "indeterminate": return 8;
    case "half": return 16;
    case "complete": return 32;
    default: throw new Error(`Showcase Garmin progress renderer lacks scenario '${scenarioId}'`);
  }
}

function monkeyColor(value: string): string {
  if (!/^#[0-9a-f]{6}$/u.test(value)) throw new Error(`Garmin style has invalid colour '${value}'`);
  return `0x${value.slice(1).toUpperCase()}`;
}

function monkeyString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n")}"`;
}
