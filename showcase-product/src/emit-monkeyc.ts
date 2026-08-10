import type { NativeBindingManifest, ProductEmitterPlugin, ProductIr } from "@v1d/product-spec";
import {
  compileShowcaseNativeFiniteValues,
  compileShowcaseNativeNavigation,
  compileShowcaseNativeNodes,
  nativeManifestArtifact,
} from "./native-manifest.js";
import { parseSvgPath, type NormalizedPathCommand } from "./parse-svg-path.js";
import type { CircleKitShowcaseProductIr } from "./product.js";

const GARMIN_CAPABILITIES = new Set(["ui.component-tree"]);
const GARMIN_NATIVE_SUPPORT: GarminRendererSupport = {
  id: "garmin-connectiq-monkeyc",
  surfaces: ["round"],
};

interface GarminRendererSupport {
  readonly id: string;
  readonly surfaces: readonly ("round" | "compact" | "wide")[];
}

interface GarminStyle {
  readonly surface: string;
  readonly action: string;
  readonly actionMuted: string;
  readonly faint: string;
  readonly line: string;
}

interface GarminAssetCatalog {
  readonly id: string;
  readonly version: string;
  readonly icons: readonly GarminVectorAsset[];
}

interface GarminVectorAsset {
  readonly id: string;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly paths: readonly (Readonly<{
    kind: "fill";
    pathData: string;
    fillRule: "nonzero" | "evenodd";
  }> | Readonly<{
    kind: "stroke";
    pathData: string;
    strokeWidth: number;
  }>)[];
  readonly layers?: readonly Readonly<{ slot: string; assetRef: string }>[];
}

interface GarminSelection {
  readonly artifactId: string;
  readonly rendererId: string;
  readonly screenId: string;
  readonly surface: "round" | "compact" | "wide";
  readonly componentId: string;
  readonly openPort: string;
  readonly componentLabel: string;
  readonly componentOrder: number;
  readonly scenarioId: string;
  readonly scenarioLabel: string;
  readonly activeTicks: number;
  readonly paletteRef: string | undefined;
  readonly iconRef: string;
  readonly iconAssetRef: string;
  readonly iconAccent: string | undefined;
  readonly iconAsset: GarminVectorAsset;
}

export function showcaseGarminEmitter(
  path: string,
  manifestPath: string,
  assetCatalog: GarminAssetCatalog,
  style: GarminStyle,
): ProductEmitterPlugin {
  return {
    id: "showcase-garmin-limited-ui",
    emit(product) {
      const showcase = requireShowcaseProduct(product);
      const selection = selectLimitedUi(showcase, GARMIN_NATIVE_SUPPORT, assetCatalog);
      const emission = emitMonkeyC(showcase, selection, assetCatalog, style, path);
      return [
        {
          id: "showcase-garmin-limited-ui",
          path,
          mediaType: "text/x-monkey-c",
          content: emission.source,
        },
        nativeManifestArtifact("showcase-garmin-native-manifest", manifestPath, emission.manifest),
      ];
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
  assetCatalog: GarminAssetCatalog,
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
  const scopes = product.artifactScopes.filter((scope) =>
    scope.artifactRef === artifact.id && scope.screenRef === artifact.entryScreen && scope.surface === surface);
  if (scopes.length !== 1) {
    throw new Error(`Showcase Garmin artifact '${artifact.id}' must expose one entry scope, found ${scopes.length}`);
  }
  const scope = scopes[0]!;
  const pageHosts = scope.includedMounts.filter(({ componentInstanceRef }) => componentInstanceRef === "page.host");
  const rendered = scope.includedMounts.filter(({ componentInstanceRef }) => componentInstanceRef !== "page.host");
  if (pageHosts.length !== 1 || rendered.length !== 1 || scope.omittedMounts.length !== 0) {
    throw new Error(
      `Showcase Garmin limited UI requires one page host and one rendered component, found ${scope.includedMounts.length}`,
    );
  }
  const included = rendered[0]!;
  const family = product.componentFamilies.find(({ screen }) => screen === scope.screenRef);
  const tree = family?.family.trees.find((candidate) => candidate.surface === scope.surface);
  const mount = tree?.mounts.find(({ id }) => id === included.mountRef);
  if (mount === undefined || mount.instance !== included.componentInstanceRef) {
    throw new Error(`Showcase Garmin scope mount '${included.mountRef}' does not resolve its component`);
  }

  const component = product.showcase.cases.find(({ id }) => id === included.componentInstanceRef);
  const componentInstance = product.components.find(({ id }) => id === included.componentInstanceRef);
  const scenario = component?.scenarios[0];
  const openRef = componentInstance?.bindings.events.open;
  if (component === undefined || scenario === undefined || openRef === undefined) {
    throw new Error(`Showcase Garmin component '${included.componentInstanceRef}' has no default scenario`);
  }
  const icon = product.iconRefs.find(({ assetRef, artifacts: refs }) =>
    assetRef === component.iconId && refs.includes(artifact.id));
  if (icon === undefined) {
    throw new Error(`Showcase Garmin component '${component.id}' lacks an icon ref for '${artifact.id}'`);
  }
  if (product.assetCatalogRef.id !== assetCatalog.id || product.assetCatalogRef.version !== assetCatalog.version) {
    throw new Error(`Showcase Garmin asset catalog mismatch '${assetCatalog.id}@${assetCatalog.version}'`);
  }
  if ((icon.layers?.length ?? 0) > 0) {
    throw new Error(`Showcase Garmin icon '${icon.id}' uses unsupported layered geometry`);
  }
  const iconAsset = assetCatalog.icons.find(({ id }) => id === icon.assetRef);
  if (iconAsset === undefined) {
    throw new Error(`Showcase Garmin icon '${icon.id}' uses missing asset '${icon.assetRef}'`);
  }

  return {
    artifactId: artifact.id,
    rendererId: renderer.id,
    screenId: scope.screenRef,
    surface,
    componentId: included.componentInstanceRef,
    openPort: openRef.slice(openRef.indexOf(".") + 1),
    componentLabel: component.title,
    componentOrder: mount.order,
    scenarioId: scenario.id,
    scenarioLabel: scenario.label,
    activeTicks: progressTicks(scenario.id),
    paletteRef: product.palette.variants[0]?.id,
    iconRef: icon.id,
    iconAssetRef: icon.assetRef,
    iconAccent: icon.accent,
    iconAsset,
  };
}

function emitMonkeyC(
  product: CircleKitShowcaseProductIr,
  selection: GarminSelection,
  assetCatalog: GarminAssetCatalog,
  style: GarminStyle,
  sourceFile: string,
): Readonly<{
  source: string;
  manifest: Omit<NativeBindingManifest, "stage" | "schemaVersion">;
}> {
  const productLabel = product.id.split("-")[0]?.toUpperCase() ?? product.id.toUpperCase();
  const paletteLabel = selection.paletteRef?.toUpperCase() ?? "INHERITED";
  const profiles = [selection.artifactId];
  const nativeNodes = compileShowcaseNativeNodes(product, profiles, [
    { nodeId: "catalog", nativePortId: "GeneratedCircleKitShowcase.catalogModel" },
    { nodeId: "navigation", nativePortId: "GeneratedCircleKitShowcase.open" },
    { nodeId: "navigation.presentation", nativePortId: "GeneratedCircleKitShowcase.navigationModel" },
  ]);
  const nativeNavigation = compileShowcaseNativeNavigation(product, profiles);
  const nativeIcons = unique(product.iconRefs.map(({ assetRef }) => assetRef)).map((id) => {
    const asset = assetCatalog.icons.find((candidate) => candidate.id === id);
    if (asset === undefined) throw new Error(`Showcase Garmin native registry uses missing icon '${id}'`);
    if ((asset.layers?.length ?? 0) > 0) {
      throw new Error(`Showcase Garmin native registry cannot compile layered icon '${id}'`);
    }
    return { id, geometry: compileIcon(asset), asset };
  });
  const manifest = {
    sourceFile,
    profiles,
    components: [
      {
        componentId: selection.componentId,
        rendererId: "CircleKitShowcaseView.drawProgressDial",
        profiles,
      },
      {
        componentId: "showcase.page-host",
        rendererId: "CircleKitShowcaseView",
        profiles,
      },
    ],
    icons: nativeIcons.map(({ id }) => ({
      iconId: id,
      nativeSymbol: "GeneratedCircleKitShowcase.nativeIcon",
    })),
    nodes: nativeNodes,
    finiteValues: compileShowcaseNativeFiniteValues(product),
    navigation: nativeNavigation,
  } as const;

  const source = `// Generated by showcase-product/src/generate.ts. Do not edit.
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
    const OPEN_PORT = ${monkeyString(selection.openPort)};
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
    const COLOR_ICON = ${monkeyColor(resolveIconColor(product, selection.iconAccent, style))};
    var NATIVE_COMPONENTS = [
        { "componentId" => COMPONENT_ID, "rendererId" => "CircleKitShowcaseView.drawProgressDial" },
        { "componentId" => "showcase.page-host", "rendererId" => "CircleKitShowcaseView" }
    ];
    var NATIVE_ICONS = [
${nativeIcons.map(({ id, asset, geometry }) => `        {
            "id" => ${monkeyString(id)},
            "nativeSymbol" => "GeneratedCircleKitShowcase.nativeIcon",
            "viewportWidth" => ${number(asset.viewport.width)},
            "viewportHeight" => ${number(asset.viewport.height)},
            "fillPaths" => ${pointsArray(geometry.fills)},
            "strokePaths" => ${pointsArray(geometry.strokes.map(({ points }) => points))},
            "strokeWidths" => [${geometry.strokes.map(({ width }) => number(width)).join(", ")}]
        }`).join(",\n")}
    ];
    var NATIVE_NODES = [
${nativeNodes.map((node) => `        {
            "nodeId" => ${monkeyString(node.nodeId)},
            "nativePortId" => ${monkeyString(node.nativePortId)},
            "inputPorts" => [${node.inputPorts.map(monkeyString).join(", ")}],
            "outputPorts" => [${node.outputPorts.map(monkeyString).join(", ")}]
        }`).join(",\n")}
    ];
    var NATIVE_NAVIGATION_ARTIFACTS = [
${nativeNavigation.artifacts.map((artifact) => `        {
            "artifactRef" => ${monkeyString(artifact.artifactRef)},
            "entryPageRef" => ${monkeyString(artifact.entryPageRef)},
            "pages" => [${artifact.pages.map((page) => monkeyString(page.pageRef)).join(", ")}]
        }`).join(",\n")}
    ];
    var NATIVE_ACTIVE_PAGE_BINDINGS = [
${nativeNavigation.activePageBindings.map((binding) => `        {
            "publisherPortRef" => ${monkeyString(binding.publisherPortRef)},
            "pageHostPortRef" => ${monkeyString(binding.pageHostPortRef)}
        }`).join(",\n")}
    ];
    var NATIVE_NAVIGATION_ACTION_GROUPS = [
${nativeNavigation.actionGroups.map((group) => `        {
            "artifactRef" => ${monkeyString(group.artifactRef)},
            "componentInstanceRef" => ${monkeyString(group.componentInstanceRef)},
            "actions" => [${group.actions.map((action) => `{ "sourcePortRef" => ${monkeyString(action.sourcePortRef)}, "targetPortRef" => ${monkeyString(action.targetPortRef)}, "effect" => ${monkeyString(action.effect)} }`).join(", ")}]
        }`).join(",\n")}
    ];
    var _destination = null;
    var _activePage = SCREEN_ID;

    function nativeIcon(iconId) {
        for (var index = 0; index < NATIVE_ICONS.size(); index += 1) {
            var icon = NATIVE_ICONS[index];
            if (icon["id"] == iconId) {
                return icon;
            }
        }
        return null;
    }

    function catalogModel() {
        var component = NATIVE_COMPONENTS[0];
        return {
            "componentId" => component["componentId"],
            "scenarioId" => SCENARIO_ID,
            "iconAssetRef" => ICON_ASSET_REF
        };
    }

    function open(portId, componentId) {
        _destination = { "portId" => portId, "componentId" => componentId };
    }

    function navigationModel() {
        return _destination;
    }

    function activePage() {
        return _activePage;
    }

    function route(pageRef) {
        if (pageRef == SCREEN_ID) {
            _activePage = pageRef;
        }
        return _activePage;
    }

    function requireNativeBindings() {
        for (var index = 0; index < NATIVE_NODES.size(); index += 1) {
            var node = NATIVE_NODES[index];
            if (node["nativePortId"] == null) {
                return null;
            }
        }
        var catalog = catalogModel();
        open(OPEN_PORT, catalog["componentId"]);
        activePage();
        return navigationModel();
    }
}
`;
  return { source, manifest };
}

function compileIcon(asset: GarminVectorAsset): Readonly<{
  fills: readonly (readonly (readonly [number, number])[])[];
  strokes: readonly Readonly<{ width: number; points: readonly (readonly [number, number])[] }>[];
}> {
  const fills: (readonly (readonly [number, number])[])[] = [];
  const strokes: Readonly<{ width: number; points: readonly (readonly [number, number])[] }>[] = [];
  for (const path of asset.paths) {
    if (path.kind === "fill") {
      fills.push(...linearSubpaths(path.pathData, true));
    } else {
      for (const points of linearSubpaths(path.pathData, false)) {
        strokes.push({ width: path.strokeWidth, points });
      }
    }
  }
  if (fills.length === 0 && strokes.length === 0) {
    throw new Error(`Showcase Garmin icon '${asset.id}' has no renderable paths`);
  }
  return { fills, strokes };
}

function linearSubpaths(pathData: string, requireClosed: boolean): readonly (readonly (readonly [number, number])[])[] {
  const paths: (readonly (readonly [number, number])[])[] = [];
  let points: [number, number][] = [];
  let closed = false;
  let current: [number, number] = [0, 0];
  let start: [number, number] = [0, 0];
  const finish = () => {
    if (points.length > 0) {
      if (requireClosed && !closed) throw new Error("Showcase Garmin fill path is not closed");
      paths.push(points);
    }
    points = [];
    closed = false;
  };
  for (const command of parseSvgPath(pathData)) {
    switch (command.kind) {
    case "move":
      finish();
      points.push([command.x, command.y]);
      current = [command.x, command.y];
      start = current;
      break;
    case "line":
      points.push([command.x, command.y]);
      current = [command.x, command.y];
      break;
    case "cubic":
      points.push(...flattenCubic(current, command));
      current = [command.x, command.y];
      break;
    case "quad":
      points.push(...flattenQuad(current, command));
      current = [command.x, command.y];
      break;
    case "arc":
      points.push(...flattenArc(current, command));
      current = [command.x, command.y];
      break;
    case "close":
      closed = true;
      current = start;
      break;
    }
  }
  finish();
  return paths;
}

function flattenCubic(
  [x0, y0]: readonly [number, number],
  command: Extract<NormalizedPathCommand, { kind: "cubic" }>,
): [number, number][] {
  return sampleCurve(12, (t) => {
    const inverse = 1 - t;
    return [
      inverse ** 3 * x0 + 3 * inverse ** 2 * t * command.x1 +
        3 * inverse * t ** 2 * command.x2 + t ** 3 * command.x,
      inverse ** 3 * y0 + 3 * inverse ** 2 * t * command.y1 +
        3 * inverse * t ** 2 * command.y2 + t ** 3 * command.y,
    ];
  });
}

function flattenQuad(
  [x0, y0]: readonly [number, number],
  command: Extract<NormalizedPathCommand, { kind: "quad" }>,
): [number, number][] {
  return sampleCurve(10, (t) => {
    const inverse = 1 - t;
    return [
      inverse ** 2 * x0 + 2 * inverse * t * command.x1 + t ** 2 * command.x,
      inverse ** 2 * y0 + 2 * inverse * t * command.y1 + t ** 2 * command.y,
    ];
  });
}

function flattenArc(
  [startX, startY]: readonly [number, number],
  command: Extract<NormalizedPathCommand, { kind: "arc" }>,
): [number, number][] {
  if ((startX === command.x && startY === command.y) || command.radiusX === 0 || command.radiusY === 0) {
    return [[command.x, command.y]];
  }
  const phi = command.rotation * Math.PI / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (startX - command.x) / 2;
  const dy = (startY - command.y) / 2;
  const transformedX = cosPhi * dx + sinPhi * dy;
  const transformedY = -sinPhi * dx + cosPhi * dy;
  let radiusX = Math.abs(command.radiusX);
  let radiusY = Math.abs(command.radiusY);
  const scale = transformedX ** 2 / radiusX ** 2 + transformedY ** 2 / radiusY ** 2;
  if (scale > 1) {
    const root = Math.sqrt(scale);
    radiusX *= root;
    radiusY *= root;
  }
  const rx2 = radiusX ** 2;
  const ry2 = radiusY ** 2;
  const x2 = transformedX ** 2;
  const y2 = transformedY ** 2;
  const denominator = rx2 * y2 + ry2 * x2;
  const sign = command.largeArc === command.sweep ? -1 : 1;
  const factor = denominator === 0 ? 0 : sign * Math.sqrt(Math.max(0, rx2 * ry2 - denominator) / denominator);
  const centerXPrime = factor * radiusX * transformedY / radiusY;
  const centerYPrime = factor * -radiusY * transformedX / radiusX;
  const centerX = cosPhi * centerXPrime - sinPhi * centerYPrime + (startX + command.x) / 2;
  const centerY = sinPhi * centerXPrime + cosPhi * centerYPrime + (startY + command.y) / 2;
  const startVector = {
    x: (transformedX - centerXPrime) / radiusX,
    y: (transformedY - centerYPrime) / radiusY,
  };
  const endVector = {
    x: (-transformedX - centerXPrime) / radiusX,
    y: (-transformedY - centerYPrime) / radiusY,
  };
  const startAngle = Math.atan2(startVector.y, startVector.x);
  let delta = Math.atan2(
    startVector.x * endVector.y - startVector.y * endVector.x,
    startVector.x * endVector.x + startVector.y * endVector.y,
  );
  if (!command.sweep && delta > 0) delta -= 2 * Math.PI;
  if (command.sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 12)));
  return sampleCurve(segments, (unit) => {
    const angle = startAngle + delta * unit;
    return [
      centerX + radiusX * cosPhi * Math.cos(angle) - radiusY * sinPhi * Math.sin(angle),
      centerY + radiusX * sinPhi * Math.cos(angle) + radiusY * cosPhi * Math.sin(angle),
    ];
  });
}

function sampleCurve(
  segments: number,
  point: (unit: number) => readonly [number, number],
): [number, number][] {
  return Array.from({ length: segments }, (_, index) => [...point((index + 1) / segments)] as [number, number]);
}

function resolveIconColor(
  product: CircleKitShowcaseProductIr,
  accent: string | undefined,
  style: GarminStyle,
): string {
  if (accent === undefined) return style.action;
  const palette = product.palette.variants[0];
  if (palette === undefined) throw new Error(`Showcase Garmin icon accent '${accent}' has no product palette`);
  const [kind, id] = accent.split(".", 2);
  const value = kind === "identity"
    ? palette.identity[id!]
    : kind === "status"
      ? palette.status[id!]
      : kind === "category"
        ? palette.categories.find((category) => category.id === id)?.hex
        : undefined;
  if (value === undefined) throw new Error(`Showcase Garmin icon uses missing palette token '${accent}'`);
  return value;
}

function pointsArray(paths: readonly (readonly (readonly [number, number])[])[]): string {
  return `[${paths.map((path) => `[${path.map(([x, y]) => `[${number(x)}, ${number(y)}]`).join(", ")}]`).join(", ")}]`;
}

function number(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Showcase Garmin geometry has invalid number '${value}'`);
  return String(Math.round(value * 1_000_000) / 1_000_000);
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

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
