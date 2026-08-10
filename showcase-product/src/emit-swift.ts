import type {
  NativeBindingManifest,
  PortablePaletteVariant,
  ProductEmitterPlugin,
  ProductIr,
} from "@v1d/product-spec";
import { compileShowcaseNativeNodes, nativeManifestArtifact } from "./native-manifest.js";
import { parseSvgPath, type NormalizedPathCommand } from "./parse-svg-path.js";
import type { CircleKitShowcaseProductIr } from "./product.js";

const SWIFT_UI_CAPABILITIES = new Set([
  "ui.menu",
  "ui.navigation",
  "ui.component-tree",
]);
interface SwiftArtifact {
  readonly id: string;
  readonly rendererRefs: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly entryScreen: string;
  readonly screenRefs: readonly string[];
  readonly serves: readonly ("round" | "compact" | "wide")[];
}

interface SwiftRendererSupport {
  readonly id: string;
  readonly surfaces: readonly ("round" | "compact" | "wide")[];
}

interface SelectedSwiftArtifact {
  readonly artifact: SwiftArtifact;
  readonly rendererId: string;
}

interface SwiftAssetCatalog {
  readonly id: string;
  readonly version: string;
  readonly icons: readonly Readonly<{
    id: string;
    viewport: Readonly<{ width: number; height: number }>;
    paths: readonly (Readonly<{ kind: "fill"; pathData: string; fillRule: "nonzero" | "evenodd" }> |
      Readonly<{ kind: "stroke"; pathData: string; strokeWidth: number }>)[];
  }>[];
}

interface SwiftStyle {
  readonly surface: string;
  readonly action: string;
  readonly actionMuted: string;
  readonly faint: string;
  readonly line: string;
}

interface SwiftIconRef {
  readonly id: string;
  readonly assetRef: string;
  readonly artifacts: readonly string[];
}

interface SwiftReadyShowcaseProduct extends CircleKitShowcaseProductIr {
  readonly artifacts: readonly SwiftArtifact[];
  readonly palette: { readonly variants: readonly PortablePaletteVariant[] };
  readonly assetCatalogRef: { readonly id: string; readonly version: string };
  readonly iconRefs: readonly SwiftIconRef[];
}

export function showcaseSwiftEmitter(
  path: string,
  manifestPath: string,
  renderers: readonly SwiftRendererSupport[],
  assetCatalog: SwiftAssetCatalog,
  style: SwiftStyle,
): ProductEmitterPlugin {
  return {
    id: "showcase-swiftui",
    emit(product) {
      const showcase = requireSwiftReadyShowcase(product);
      const artifacts = requireArtifacts(showcase, renderers);
      const emission = emitSwift(showcase, artifacts, assetCatalog, style, path);
      return [
        {
          id: "showcase-swiftui",
          path,
          mediaType: "text/x-swift",
          content: emission.source,
        },
        nativeManifestArtifact("showcase-swiftui-native-manifest", manifestPath, emission.manifest),
      ];
    },
  };
}

function requireSwiftReadyShowcase(product: ProductIr): SwiftReadyShowcaseProduct {
  if (product.id !== "circlekit-showcase" || !("showcase" in product)) {
    throw new Error("Showcase Swift emitter received another product");
  }
  const candidate = product as CircleKitShowcaseProductIr & {
    readonly artifacts: readonly Partial<SwiftArtifact>[];
    readonly palette?: { readonly variants?: readonly PortablePaletteVariant[] };
    readonly assetCatalogRef?: { readonly id?: unknown; readonly version?: unknown };
    readonly iconRefs?: readonly SwiftIconRef[];
  };
  if (candidate.palette?.variants === undefined) {
    throw new Error("Showcase Swift emitter requires ProductSpec palette data");
  }
  for (const artifact of candidate.artifacts) {
    if (typeof artifact.entryScreen !== "string" || !Array.isArray(artifact.serves)) {
      throw new Error(`Showcase artifact '${artifact.id ?? "unknown"}' lacks typed entryScreen/serves`);
    }
  }
  if (typeof candidate.assetCatalogRef?.id !== "string" ||
      typeof candidate.assetCatalogRef.version !== "string" ||
      !Array.isArray(candidate.iconRefs)) {
    throw new Error("Showcase Swift emitter requires ProductSpec asset catalog/icon refs");
  }
  return candidate as SwiftReadyShowcaseProduct;
}

function requireArtifacts(
  product: SwiftReadyShowcaseProduct,
  renderers: readonly SwiftRendererSupport[],
): readonly SelectedSwiftArtifact[] {
  requireUnique(renderers.map(({ id }) => id), "Swift renderer");
  return renderers.map((support) => {
    const renderer = product.rendererBindings.find(({ id }) => id === support.id);
    if (renderer === undefined) throw new Error(`Showcase has no renderer '${support.id}'`);
    const artifacts = product.artifacts.filter(({ rendererRefs }) => rendererRefs.includes(support.id));
    if (artifacts.length !== 1) {
      throw new Error(`Showcase renderer '${support.id}' must own exactly one artifact, found ${artifacts.length}`);
    }
    const artifact = artifacts[0]!;
    const unsupportedCapability = artifact.requiredCapabilities.find((id) => !SWIFT_UI_CAPABILITIES.has(id));
    if (unsupportedCapability !== undefined) {
      throw new Error(`Showcase SwiftUI lacks required capability '${unsupportedCapability}'`);
    }
    const supportedSurfaces = new Set(support.surfaces);
    const unsupportedSurface = artifact.serves.find((surface) => !supportedSurfaces.has(surface));
    if (unsupportedSurface !== undefined) {
      throw new Error(`Showcase SwiftUI renderer '${support.id}' cannot render '${unsupportedSurface}'`);
    }
    return { artifact, rendererId: support.id };
  });
}

function emitSwift(
  product: SwiftReadyShowcaseProduct,
  selections: readonly SelectedSwiftArtifact[],
  assetCatalog: SwiftAssetCatalog,
  style: SwiftStyle,
  sourceFile: string,
): Readonly<{
  source: string;
  manifest: Omit<NativeBindingManifest, "stage" | "schemaVersion">;
}> {
  if (product.assetCatalogRef.id !== assetCatalog.id || product.assetCatalogRef.version !== assetCatalog.version) {
    throw new Error(`Showcase SwiftUI asset catalog mismatch '${assetCatalog.id}@${assetCatalog.version}'`);
  }
  const trees = selections.flatMap(({ artifact }) => product.artifactScopes
    .filter((scope) => scope.artifactRef === artifact.id)
    .map((scope) => ({ artifact, scope, tree: requireFamilyTree(product, scope.screenRef, scope.surface) })));
  const componentIds = unique(trees.flatMap(({ scope }) =>
    scope.includedMounts.map(({ componentInstanceRef }) => componentInstanceRef)));
  const components = componentIds.map((id) => {
    const component = product.showcase.cases.find((candidate) => candidate.id === id);
    if (component === undefined) throw new Error(`Showcase SwiftUI tree uses missing case '${id}'`);
    return component;
  });
  const palette = product.palette.variants[0];
  const nodeIds = product.nodes.map(({ id }) => id);
  const portIds = unique([
    ...product.portRegistry.nodePorts,
    ...product.portRegistry.componentPorts,
  ].map(({ ref }) => ref));
  const artifactIds = selections.map(({ artifact }) => artifact.id);
  const componentBindings = components.map((component) => {
    const ref = product.iconRefs.find(({ assetRef }) => assetRef === component.iconId);
    if (ref === undefined) throw new Error(`Showcase SwiftUI component '${component.id}' lacks icon ref '${component.iconId}'`);
    const usedBy = selections.map(({ artifact }) => artifact).filter(({ id }) => trees.some(({ artifact, scope }) =>
      artifact.id === id && scope.includedMounts.some(({ componentInstanceRef }) => componentInstanceRef === component.id)));
    const missingArtifact = usedBy.find(({ id }) => !ref.artifacts.includes(id));
    if (missingArtifact !== undefined) {
      throw new Error(`Showcase SwiftUI icon '${ref.id}' does not serve '${missingArtifact.id}'`);
    }
    return { component, ref, profiles: usedBy.map(({ id }) => id) };
  });
  const icons = unique(componentBindings.map(({ ref }) => ref.id)).map((id) => {
    const ref = componentBindings.find(({ ref }) => ref.id === id)!.ref;
    const asset = assetCatalog.icons.find(({ id: assetId }) => assetId === ref.assetRef);
    if (asset === undefined) throw new Error(`Showcase SwiftUI icon '${id}' uses missing asset '${ref.assetRef}'`);
    return { ref, asset };
  });
  requireDistinctSwiftCases(componentIds, "component");
  requireDistinctSwiftCases(artifactIds, "artifact");
  requireDistinctSwiftCases(nodeIds, "native node");
  requireDistinctSwiftCases(portIds, "UI port");

  const profiles = selections.map(({ artifact }) => artifact.id);
  const nativeNodes = compileShowcaseNativeNodes(product, profiles, [
    { nodeId: "catalog", nativePortId: "ShowcaseCatalogSource" },
    { nodeId: "navigation", nativePortId: "ShowcaseNavigationController" },
    { nodeId: "navigation.presentation", nativePortId: "ShowcaseNavigationController" },
  ]);
  const manifest = {
    sourceFile,
    profiles,
    components: componentBindings.map(({ component, profiles: componentProfiles }) => ({
      componentId: component.id,
      rendererId: "ShowcaseComponentScreen",
      profiles: componentProfiles,
    })),
    icons: icons.map(({ ref }) => ({
      iconId: ref.assetRef,
      nativeSymbol: "ShowcaseVectorIcon",
    })),
    nodes: nativeNodes,
    finiteValues: [],
  } as const;

  const source = `// Generated by showcase-product/src/generate.ts. Do not edit.
import Foundation

enum GeneratedShowcaseSurface: String, CaseIterable, Hashable {
${unique(selections.flatMap(({ artifact }) => artifact.serves)).map((surface) => `    case ${swiftCase(surface)} = ${swiftString(surface)}`).join("\n")}
}

enum GeneratedShowcaseArtifactId: String, CaseIterable, Hashable {
${artifactIds.map((id) => `    case ${swiftCase(id)} = ${swiftString(id)}`).join("\n")}
}

enum GeneratedShowcaseComponentId: String, CaseIterable, Hashable {
${componentIds.map((id) => `    case ${swiftCase(id)} = ${swiftString(id)}`).join("\n")}
}

enum GeneratedShowcaseNodeId: String, CaseIterable, Hashable {
${nodeIds.map((id) => `    case ${swiftCase(id)} = ${swiftString(id)}`).join("\n")}
}

enum GeneratedShowcasePortId: String, CaseIterable, Hashable {
${portIds.map((id) => `    case ${swiftCase(id)} = ${swiftString(id)}`).join("\n")}
}

enum GeneratedShowcaseProduct {
    static let productId = ${swiftString(product.id)}
    static let productSpecVersion = ${swiftString(product.productSpecVersion)}
    static let artifacts: [ShowcaseArtifact] = [
${selections.map(({ artifact, rendererId }) => `        ShowcaseArtifact(
            id: .${swiftCase(artifact.id)},
            rendererId: ${swiftString(rendererId)},
            entryScreen: ${swiftString(artifact.entryScreen)},
            screenRefs: [${artifact.screenRefs.map(swiftString).join(", ")}],
            surfaces: [${artifact.serves.map((surface) => `.${swiftCase(surface)}`).join(", ")}]
        )`).join(",\n")}
    ]
    static let style = ShowcaseStyle(
        surfaceHex: ${swiftString(style.surface)},
        actionHex: ${swiftString(style.action)},
        actionMutedHex: ${swiftString(style.actionMuted)},
        faintHex: ${swiftString(style.faint)},
        lineHex: ${swiftString(style.line)}
    )
    static let palette = ShowcasePalette(
        id: ${palette === undefined ? "nil" : swiftString(palette.id)},
        tokens: [
${palette === undefined ? "" : emitPaletteTokens(palette)}
        ]
    )
    static let components: [ShowcaseComponent] = [
${componentBindings.map(({ component, ref }) => `        ShowcaseComponent(
            id: .${swiftCase(component.id)},
            rendererId: "ShowcaseComponentScreen",
            title: ${swiftString(component.title)},
            iconId: ${swiftString(ref.assetRef)},
            scenarios: [${component.scenarios.map((scenario) => `ShowcaseScenario(id: ${swiftString(scenario.id)}, label: ${swiftString(scenario.label)})`).join(", ")}]
        )`).join(",\n")}
    ]
    static let trees: [ShowcaseTree] = [
${trees.map(({ artifact, scope, tree }) => `        ShowcaseTree(
            artifactId: .${swiftCase(artifact.id)},
            screenId: ${swiftString(scope.screenRef)},
            surface: .${swiftCase(scope.surface)},
            mounts: [
${scope.includedMounts.map((included) => {
  const mount = requireMount(tree, included.mountRef, included.componentInstanceRef);
  return `                ShowcaseComponentMount(id: ${swiftString(mount.id)}, componentId: .${swiftCase(included.componentInstanceRef)}, region: ${swiftString(mount.region)}, order: ${mount.order})`;
}).join(",\n")}
            ]
        )`).join(",\n")}
    ]
    static let icons: [ShowcaseIconAsset] = [
${icons.map(({ ref, asset }) => emitIconAsset(ref.assetRef, asset)).join(",\n")}
    ]
    static let nodes: [ShowcaseNode] = [
${nativeNodes.map((nativeNode) => {
  const node = product.nodes.find(({ id }) => id === nativeNode.nodeId)!;
  const kind = product.nodeTypes.find(({ id }) => id === node.nodeTypeRef)?.kind;
  if (kind === undefined) throw new Error(`Showcase node '${node.id}' has unknown type '${node.nodeTypeRef}'`);
  return `        ShowcaseNode(
            id: .${swiftCase(node.id)},
            typeRef: ${swiftString(node.nodeTypeRef)},
            kind: ${swiftString(kind)},
            nativePortId: ${swiftString(nativeNode.nativePortId)},
            profiles: [${nativeNode.profiles.map((profile) => `.${swiftCase(profile)}`).join(", ")}],
            inputPorts: [${nativeNode.inputPorts.map(swiftString).join(", ")}],
            outputPorts: [${nativeNode.outputPorts.map(swiftString).join(", ")}]
        )`;
}).join(",\n")}
    ]
    static let portBindings: [ShowcasePortBinding] = [
${product.portRegistry.bindings.map((binding) => `        ShowcasePortBinding(kind: ${swiftString(binding.kind)}, from: .${swiftCase(binding.from)}, to: .${swiftCase(binding.to)}, purpose: ${swiftString(binding.purpose)})`).join(",\n")}
    ]
}
`;
  return { source, manifest };
}

function emitIconAsset(id: string, asset: SwiftAssetCatalog["icons"][number]): string {
  const paths = asset.paths.map((path) => {
    const style = path.kind === "fill"
      ? `ShowcaseIconPathStyle.fill(evenOdd: ${path.fillRule === "evenodd"})`
      : `ShowcaseIconPathStyle.stroke(width: ${swiftNumber(path.strokeWidth)})`;
    return `                ShowcaseIconPath(style: ${style}, commands: [
${parseSvgPath(path.pathData).map((command) => `                    ${emitPathCommand(command)}`).join(",\n")}
                ])`;
  }).join(",\n");
  return `        ShowcaseIconAsset(
            id: ${swiftString(id)},
            nativeSymbol: "ShowcaseVectorIcon",
            viewportWidth: ${swiftNumber(asset.viewport.width)},
            viewportHeight: ${swiftNumber(asset.viewport.height)},
            paths: [
${paths}
            ]
        )`;
}

function emitPathCommand(command: NormalizedPathCommand): string {
  switch (command.kind) {
  case "move": return `.move(x: ${swiftNumber(command.x)}, y: ${swiftNumber(command.y)})`;
  case "line": return `.line(x: ${swiftNumber(command.x)}, y: ${swiftNumber(command.y)})`;
  case "cubic": return `.cubic(x1: ${swiftNumber(command.x1)}, y1: ${swiftNumber(command.y1)}, x2: ${swiftNumber(command.x2)}, y2: ${swiftNumber(command.y2)}, x: ${swiftNumber(command.x)}, y: ${swiftNumber(command.y)})`;
  case "quad": return `.quad(x1: ${swiftNumber(command.x1)}, y1: ${swiftNumber(command.y1)}, x: ${swiftNumber(command.x)}, y: ${swiftNumber(command.y)})`;
  case "arc": return `.arc(radiusX: ${swiftNumber(command.radiusX)}, radiusY: ${swiftNumber(command.radiusY)}, rotation: ${swiftNumber(command.rotation)}, largeArc: ${command.largeArc}, sweep: ${command.sweep}, x: ${swiftNumber(command.x)}, y: ${swiftNumber(command.y)})`;
  case "close": return ".close";
  }
}

function emitPaletteTokens(palette: PortablePaletteVariant): string {
  const tokens = [
    ...Object.entries(palette.identity).map(([id, hex]) => ({ id: `identity.${id}`, kind: "identity", hex })),
    ...palette.categories.map(({ id, hex }) => ({ id: `category.${id}`, kind: "category", hex })),
    ...Object.entries(palette.status).map(([id, hex]) => ({ id: `status.${id}`, kind: "status", hex })),
  ];
  return tokens.map(({ id, kind, hex }) =>
    `            ShowcasePaletteToken(id: ${swiftString(id)}, kind: .${kind}, hex: ${swiftString(hex)})`).join(",\n");
}

function swiftCase(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/u).filter(Boolean);
  const [first = "value", ...rest] = parts;
  const identifier = `${first.toLowerCase()}${rest.map(capitalize).join("")}`;
  return /^[A-Za-z_]/u.test(identifier) ? identifier : `value${capitalize(identifier)}`;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function swiftString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n")}"`;
}

function swiftNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Showcase SwiftUI cannot emit number '${value}'`);
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function requireFamilyTree(
  product: CircleKitShowcaseProductIr,
  screen: string,
  surface: "round" | "compact" | "wide",
) {
  const family = product.componentFamilies.find((candidate) => candidate.screen === screen);
  const tree = family?.family.trees.find((candidate) => candidate.surface === surface);
  if (tree === undefined) throw new Error(`Showcase SwiftUI scope '${screen}' lacks '${surface}' tree`);
  return tree;
}

function requireMount(
  tree: CircleKitShowcaseProductIr["componentFamilies"][number]["family"]["trees"][number],
  mountRef: string,
  componentInstanceRef: string,
) {
  const mount = tree.mounts.find((candidate) => candidate.id === mountRef);
  if (mount === undefined || mount.instance !== componentInstanceRef) {
    throw new Error(`Showcase SwiftUI scope mount '${mountRef}' does not resolve '${componentInstanceRef}'`);
  }
  return mount;
}

function requireDistinctSwiftCases(values: readonly string[], owner: string): void {
  const cases = values.map(swiftCase);
  if (new Set(cases).size !== cases.length) throw new Error(`Showcase SwiftUI ${owner} identifiers collide`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
