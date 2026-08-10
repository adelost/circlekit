import type {
  ComponentType,
  PortableSurfaceClass,
  ProductComponentInstance,
  ScreenComponentFamilyRef,
} from "./component-tree-model.js";
import {
  compileProductGraph,
  type MountedComponentScope,
  type ProductPortRegistry,
} from "./port-graph-model.js";
import type {
  ExactComponentInstances,
  ExactNodeInstances,
  ProductNodeInstance,
} from "./node-instance-model.js";
import {
  requireUnique,
  requireWireId,
  type LegoConfigRef,
  type LegoContract,
  type LegoFiniteValueDeclaration,
  type LegoFiniteValueRef,
  type ProductNodeType,
} from "./node-model.js";
import {
  compileStateAuthorities,
  type CompiledStateAuthority,
  type StateAuthority,
} from "./state-authority-model.js";
import {
  compileProductNavigation,
  type ProductNavigationDeclaration,
  type ProductNavigationIr,
} from "./navigation-model.js";
import {
  definePalette,
  definePortableAssetCatalog,
  paletteTokenIds,
  type PaletteTokenRef,
  type PortableAssetCatalog,
  type PortableAssetCatalogRef,
  type PortablePaletteVariant,
  type ProductIconRef,
  type ProductPalette,
} from "./visual-model.js";

export const PRODUCT_SPEC_SCHEMA_VERSION = 9 as const;

export interface RendererBinding<Id extends string = string, Capability extends string = string> {
  readonly id: Id;
  readonly capabilities: readonly Capability[];
}

export interface ArtifactProfile<
  Id extends string = string,
  RendererRef extends string = string,
  Capability extends string = string,
  ScreenRef extends string = string,
> {
  readonly id: Id;
  readonly rendererRefs: readonly RendererRef[];
  readonly requiredCapabilities: readonly Capability[];
  readonly entryScreen: ScreenRef;
  readonly screenRefs: readonly ScreenRef[];
  readonly serves: readonly PortableSurfaceClass[];
}

export interface ProductArtifactMountScope {
  readonly artifactRef: string;
  readonly screenRef: string;
  readonly surface: PortableSurfaceClass;
  readonly includedMounts: readonly {
    readonly mountRef: string;
    readonly componentInstanceRef: string;
  }[];
  readonly omittedMounts: readonly {
    readonly mountRef: string;
    readonly componentInstanceRef: string;
    readonly reason: "missing-capability";
    readonly capabilities: readonly string[];
  }[];
}

export interface ProductDeclaration<
  PaletteVariant extends PortablePaletteVariant = PortablePaletteVariant,
  Families extends readonly ScreenComponentFamilyRef[] = readonly ScreenComponentFamilyRef[],
  NodeTypes extends readonly ProductNodeType[] = readonly ProductNodeType[],
  Nodes extends readonly ProductNodeInstance[] = readonly ProductNodeInstance[],
  ComponentTypes extends readonly ComponentType[] = readonly ComponentType[],
  Components extends readonly ProductComponentInstance[] = readonly ProductComponentInstance[],
> {
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding[];
  readonly artifacts: readonly ArtifactProfile<string, string, string, NoInfer<Families[number]["screen"]>>[];
  readonly nodeTypes: NodeTypes;
  readonly nodes: Nodes & ExactNodeInstances<NodeTypes, Nodes, ComponentTypes, Components>;
  readonly configs: readonly LegoConfigRef[];
  readonly finiteValues: readonly LegoFiniteValueDeclaration[];
  /** Canonical closed state axes plus their mandatory executable presentation adapters. */
  readonly stateAuthorities: readonly StateAuthority[];
  readonly componentTypes: ComponentTypes;
  readonly components: Components & ExactComponentInstances<NodeTypes, Nodes, ComponentTypes, Components>;
  readonly componentFamilies: Families;
  readonly palette: ProductPalette<PaletteVariant>;
  readonly assetCatalogRef: PortableAssetCatalogRef;
  readonly iconRefs: readonly ProductIconRef<PaletteTokenRef<PaletteVariant>, string>[];
  readonly navigation: ProductNavigationDeclaration<NoInfer<Families[number]["screen"]>>;
}

export interface ProductIr {
  readonly kind: "product-spec-ir";
  readonly schemaVersion: typeof PRODUCT_SPEC_SCHEMA_VERSION;
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding[];
  readonly artifacts: readonly ArtifactProfile[];
  readonly nodeTypes: readonly ProductNodeType[];
  readonly nodes: readonly ProductNodeInstance[];
  readonly configs: readonly LegoConfigRef[];
  readonly finiteValues: readonly LegoFiniteValueDeclaration[];
  readonly stateAuthorities: readonly CompiledStateAuthority[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly componentFamilies: readonly ScreenComponentFamilyRef[];
  readonly artifactScopes: readonly ProductArtifactMountScope[];
  readonly portRegistry: ProductPortRegistry;
  readonly palette: ProductPalette;
  readonly assetCatalogRef: PortableAssetCatalogRef;
  readonly iconRefs: readonly ProductIconRef[];
  readonly navigation: ProductNavigationIr;
}

export function defineProduct<
  const PaletteVariant extends PortablePaletteVariant,
  const Families extends readonly ScreenComponentFamilyRef[],
  const NodeTypes extends readonly ProductNodeType[],
  const Nodes extends readonly ProductNodeInstance[],
  const ComponentTypes extends readonly ComponentType[],
  const Components extends readonly ProductComponentInstance[],
>(
  declaration: ProductDeclaration<PaletteVariant, Families, NodeTypes, Nodes, ComponentTypes, Components>,
  assetCatalog: PortableAssetCatalog,
): ProductIr {
  requireWireId(declaration.id, "product");
  requireUnique(declaration.rendererBindings.map(({ id }) => id), "renderer binding");
  requireUnique(declaration.artifacts.map(({ id }) => id), "artifact profile");
  requireUnique(declaration.componentFamilies.map(({ screen }) => screen), "component-family screen");
  requireUnique(declaration.componentFamilies.map(({ family }) => family.id), "component-family ref");
  const finiteValues = [...declaration.finiteValues, declaration.navigation.pageValues];
  validateFiniteValues(finiteValues, declaration.nodeTypes, declaration.componentTypes, [
    declaration.navigation.activePageContract,
    ...declaration.navigation.routeContracts,
  ]);
  validateVisuals(declaration, assetCatalog);

  const renderers = new Map(declaration.rendererBindings.map((item) => [item.id, item]));
  for (const renderer of declaration.rendererBindings) {
    requireWireId(renderer.id, "renderer binding");
    requireUnique(renderer.capabilities, `capability in renderer '${renderer.id}'`);
    renderer.capabilities.forEach((id) => requireWireId(id, `capability in renderer '${renderer.id}'`));
  }
  const artifacts = new Map(declaration.artifacts.map((item) => [item.id, item]));
  const familyByScreen = new Map(declaration.componentFamilies.map((item) => [item.screen, item]));
  const componentById = new Map(declaration.components.map((item) => [item.id, item]));
  const componentTypeById = new Map(declaration.componentTypes.map((item) => [item.id, item]));
  const mountedScopes: MountedComponentScope[] = [];
  const artifactScopes: ProductArtifactMountScope[] = [];

  for (const artifact of declaration.artifacts) {
    requireWireId(artifact.id, "artifact profile");
    if (artifact.rendererRefs.length === 0) throw new Error(`artifact '${artifact.id}' has no renderer`);
    if (artifact.serves.length === 0) throw new Error(`artifact '${artifact.id}' serves no surface`);
    requireUnique(artifact.rendererRefs, `renderer in artifact '${artifact.id}'`);
    requireUnique(artifact.requiredCapabilities, `capability in artifact '${artifact.id}'`);
    requireUnique(artifact.serves, `surface in artifact '${artifact.id}'`);
    requireUnique(artifact.screenRefs, `screen in artifact '${artifact.id}'`);
    if (artifact.screenRefs.length === 0) throw new Error(`artifact '${artifact.id}' selects no screen`);
    if (!artifact.screenRefs.includes(artifact.entryScreen)) {
      throw new Error(`artifact '${artifact.id}' entry screen '${artifact.entryScreen}' is not selected`);
    }
    const entry = familyByScreen.get(artifact.entryScreen);
    if (entry === undefined) throw new Error(`artifact '${artifact.id}' uses missing entry screen '${artifact.entryScreen}'`);
    for (const surface of artifact.serves) {
      if (!entry.family.trees.some((tree) => tree.surface === surface)) {
        throw new Error(`artifact '${artifact.id}' entry screen '${artifact.entryScreen}' has no '${surface}' tree`);
      }
    }
    const artifactRenderers = artifact.rendererRefs.map((rendererRef) => {
      const renderer = renderers.get(rendererRef);
      if (renderer === undefined) throw new Error(`artifact '${artifact.id}' uses missing renderer '${rendererRef}'`);
      return renderer;
    });
    for (const capability of artifact.requiredCapabilities) {
      for (const renderer of artifactRenderers) {
        if (!renderer.capabilities.includes(capability)) {
          throw new Error(`artifact '${artifact.id}' renderer '${renderer.id}' lacks capability '${capability}'`);
        }
      }
    }
    for (const screen of artifact.screenRefs) {
      const selected = familyByScreen.get(screen);
      if (selected === undefined) throw new Error(`artifact '${artifact.id}' selects missing screen '${screen}'`);
      const { family } = selected;
      for (const tree of family.trees.filter(({ surface }) => artifact.serves.includes(surface))) {
        const includedMounts: ProductArtifactMountScope["includedMounts"][number][] = [];
        const omittedMounts: ProductArtifactMountScope["omittedMounts"][number][] = [];
        for (const mount of tree.mounts) {
          const component = componentById.get(mount.instance);
          if (component === undefined) {
            throw new Error(`component family '${family.id}' mounts unknown instance '${mount.instance}'`);
          }
          const type = componentTypeById.get(component.componentTypeRef);
          if (type === undefined) {
            throw new Error(`component '${component.id}' uses unknown component type '${component.componentTypeRef}'`);
          }
          const missingCapabilities = type.requiredCapabilities.filter((capability) =>
            artifactRenderers.some((renderer) => !renderer.capabilities.includes(capability)));
          if (missingCapabilities.length > 0) {
            if (mount.requirement.kind === "required") {
              throw new Error(
                `artifact '${artifact.id}' lacks required component '${component.id}' capability '${missingCapabilities.join("', '")}'`,
              );
            }
            omittedMounts.push({
              mountRef: mount.id,
              componentInstanceRef: component.id,
              reason: "missing-capability",
              capabilities: missingCapabilities,
            });
            continue;
          }
          includedMounts.push({ mountRef: mount.id, componentInstanceRef: component.id });
          mountedScopes.push({
            artifactRef: artifact.id,
            screenRef: screen,
            surface: tree.surface,
            mountRef: mount.id,
            componentInstanceRef: component.id,
          });
        }
        artifactScopes.push({
          artifactRef: artifact.id,
          screenRef: screen,
          surface: tree.surface,
          includedMounts,
          omittedMounts,
        });
      }
    }
  }

  for (const icon of declaration.iconRefs) {
    for (const artifactRef of icon.artifacts) {
      if (!artifacts.has(artifactRef)) throw new Error(`product icon '${icon.id}' uses missing artifact '${artifactRef}'`);
    }
  }
  const graph = compileProductGraph({
    nodeTypes: declaration.nodeTypes,
    nodes: declaration.nodes,
    configs: declaration.configs,
    componentTypes: declaration.componentTypes,
    components: declaration.components,
    mountedScopes,
    intrinsicConsumerContractRefs: [declaration.navigation.activePageContract.id],
  });
  const stateAuthorities = compileStateAuthorities(
    declaration.stateAuthorities,
    finiteValues,
    graph,
  );
  const navigation = compileProductNavigation({
    declaration: declaration.navigation,
    artifacts: declaration.artifacts,
    componentFamilies: declaration.componentFamilies,
    artifactScopes,
    graph,
  });
  return {
    kind: "product-spec-ir",
    schemaVersion: PRODUCT_SPEC_SCHEMA_VERSION,
    id: declaration.id,
    rendererBindings: declaration.rendererBindings,
    artifacts: declaration.artifacts,
    nodeTypes: graph.nodeTypes,
    nodes: graph.nodes,
    configs: graph.configs,
    finiteValues,
    stateAuthorities,
    componentTypes: graph.componentTypes,
    components: graph.components,
    componentFamilies: declaration.componentFamilies,
    artifactScopes,
    portRegistry: graph.portRegistry,
    palette: declaration.palette,
    assetCatalogRef: declaration.assetCatalogRef,
    iconRefs: declaration.iconRefs,
    navigation,
  };
}

function validateVisuals(
  declaration: Pick<ProductDeclaration, "palette" | "assetCatalogRef" | "iconRefs">,
  assetCatalog: PortableAssetCatalog,
): void {
  definePalette(declaration.palette.variants);
  definePortableAssetCatalog(assetCatalog);
  if (declaration.assetCatalogRef.id !== assetCatalog.id || declaration.assetCatalogRef.version !== assetCatalog.version) {
    throw new Error(
      `asset catalog reference '${declaration.assetCatalogRef.id}@${declaration.assetCatalogRef.version}' ` +
      `does not match '${assetCatalog.id}@${assetCatalog.version}'`,
    );
  }
  requireUnique(declaration.iconRefs.map(({ id }) => id), "product icon ref");
  const assetsById = new Map(assetCatalog.icons.map((asset) => [asset.id, asset]));
  const paletteTokens = paletteTokenIds(declaration.palette);
  for (const icon of declaration.iconRefs) {
    requireWireId(icon.id, "product icon ref");
    const asset = assetsById.get(icon.assetRef);
    if (asset === undefined) throw new Error(`product icon '${icon.id}' uses missing asset '${icon.assetRef}'`);
    if (icon.accent !== undefined && !paletteTokens.has(icon.accent)) {
      throw new Error(`product icon '${icon.id}' uses missing palette token '${icon.accent}'`);
    }
    const expectedLayers = (asset.layers ?? []).map(({ slot }) => slot);
    const actualLayers = (icon.layers ?? []).map(({ slot }) => slot);
    requireUnique(actualLayers, `layer slot in product icon '${icon.id}'`);
    for (const layer of icon.layers ?? []) {
      if (!paletteTokens.has(layer.accent)) {
        throw new Error(`product icon '${icon.id}' layer '${layer.slot}' uses missing palette token '${layer.accent}'`);
      }
    }
    if (JSON.stringify(actualLayers) !== JSON.stringify(expectedLayers)) {
      throw new Error(`product icon '${icon.id}' must bind exact layer slots [${expectedLayers.join(", ")}]`);
    }
    if (icon.artifacts.length === 0) throw new Error(`product icon '${icon.id}' has no artifact`);
    requireUnique(icon.artifacts, `artifact in product icon '${icon.id}'`);
  }
}

function validateFiniteValues(
  declarations: readonly LegoFiniteValueDeclaration[],
  nodes: readonly ProductNodeType[],
  components: readonly ComponentType[],
  additionalContracts: readonly LegoContract[] = [],
): void {
  const catalog = new Map<string, LegoFiniteValueDeclaration>();
  for (const item of declarations) {
    requireWireId(item.id, "finite value declaration");
    if (catalog.has(item.id)) throw new Error(`duplicate finite value declaration '${item.id}'`);
    if (item.values.length === 0) throw new Error(`finite value declaration '${item.id}' has no values`);
    requireUnique(item.values, `value in finite declaration '${item.id}'`);
    catalog.set(item.id, item);
  }
  const used = new Set<string>();
  const contracts: LegoContract[] = [
    ...nodes.flatMap((node) => [...node.inputs, ...node.outputs].map(({ contract }) => contract)),
    ...components.flatMap((component) => [...component.inputs, ...component.outputs].map(({ contract }) => contract)),
    ...additionalContracts,
  ];
  for (const contract of contracts) {
    for (const item of contract.fields) {
      if (!isFiniteValueRef(item.value)) continue;
      if (!catalog.has(item.value.ref)) {
        throw new Error(`contract '${contract.id}' uses unknown finite value '${item.value.ref}'`);
      }
      used.add(item.value.ref);
    }
  }
  const orphan = [...catalog.keys()].filter((id) => !used.has(id));
  if (orphan.length > 0) throw new Error(`orphan finite value declaration '${orphan.join("', '")}'`);
}

function isFiniteValueRef(value: LegoContract["fields"][number]["value"]): value is LegoFiniteValueRef {
  return typeof value !== "string" && "finite" in value && value.finite === true;
}
