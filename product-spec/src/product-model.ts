import type {
  ComponentType,
  PortableSurfaceClass,
  ProductComponentInstance,
  ScreenComponentFamilyRef,
} from "./component-tree-model.js";
import {
  compileProductGraph,
  type ExactComponentInstances,
  type ExactServiceInstances,
  type MountedComponentScope,
  type ProductPortRegistry,
  type ProductServiceInstance,
} from "./port-graph-model.js";
import {
  requireUnique,
  requireWireId,
  type LegoConfigRef,
  type LegoContract,
  type LegoFiniteValueDeclaration,
  type LegoFiniteValueRef,
  type LegoSpec,
} from "./native-lego-model.js";
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

export const PRODUCT_SPEC_SCHEMA_VERSION = 6 as const;

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
  readonly serves: readonly PortableSurfaceClass[];
}

export interface ProductDeclaration<
  PaletteVariant extends PortablePaletteVariant = PortablePaletteVariant,
  Families extends readonly ScreenComponentFamilyRef[] = readonly ScreenComponentFamilyRef[],
  ServiceTypes extends readonly LegoSpec[] = readonly LegoSpec[],
  Services extends readonly ProductServiceInstance[] = readonly ProductServiceInstance[],
  ComponentTypes extends readonly ComponentType[] = readonly ComponentType[],
  Components extends readonly ProductComponentInstance[] = readonly ProductComponentInstance[],
> {
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding[];
  readonly artifacts: readonly ArtifactProfile<string, string, string, NoInfer<Families[number]["screen"]>>[];
  readonly serviceTypes: ServiceTypes;
  readonly services: Services & ExactServiceInstances<ServiceTypes, Services, ComponentTypes, Components>;
  readonly configs: readonly LegoConfigRef[];
  readonly finiteValues: readonly LegoFiniteValueDeclaration[];
  readonly componentTypes: ComponentTypes;
  readonly components: Components & ExactComponentInstances<ServiceTypes, Services, ComponentTypes, Components>;
  readonly componentFamilies: Families;
  readonly palette: ProductPalette<PaletteVariant>;
  readonly assetCatalogRef: PortableAssetCatalogRef;
  readonly iconRefs: readonly ProductIconRef<PaletteTokenRef<PaletteVariant>, string>[];
}

export interface ProductIr {
  readonly kind: "product-spec-ir";
  readonly schemaVersion: typeof PRODUCT_SPEC_SCHEMA_VERSION;
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding[];
  readonly artifacts: readonly ArtifactProfile[];
  readonly serviceTypes: readonly LegoSpec[];
  readonly services: readonly ProductServiceInstance[];
  readonly configs: readonly LegoConfigRef[];
  readonly finiteValues: readonly LegoFiniteValueDeclaration[];
  readonly componentTypes: readonly ComponentType[];
  readonly components: readonly ProductComponentInstance[];
  readonly componentFamilies: readonly ScreenComponentFamilyRef[];
  readonly portRegistry: ProductPortRegistry;
  readonly palette: ProductPalette;
  readonly assetCatalogRef: PortableAssetCatalogRef;
  readonly iconRefs: readonly ProductIconRef[];
}

export function defineProduct<
  const PaletteVariant extends PortablePaletteVariant,
  const Families extends readonly ScreenComponentFamilyRef[],
  const ServiceTypes extends readonly LegoSpec[],
  const Services extends readonly ProductServiceInstance[],
  const ComponentTypes extends readonly ComponentType[],
  const Components extends readonly ProductComponentInstance[],
>(
  declaration: ProductDeclaration<PaletteVariant, Families, ServiceTypes, Services, ComponentTypes, Components>,
  assetCatalog: PortableAssetCatalog,
): ProductIr {
  requireWireId(declaration.id, "product");
  requireUnique(declaration.rendererBindings.map(({ id }) => id), "renderer binding");
  requireUnique(declaration.artifacts.map(({ id }) => id), "artifact profile");
  requireUnique(declaration.componentFamilies.map(({ screen }) => screen), "component-family screen");
  requireUnique(declaration.componentFamilies.map(({ family }) => family.id), "component-family ref");
  validateFiniteValues(declaration.finiteValues, declaration.serviceTypes, declaration.componentTypes);
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

  for (const artifact of declaration.artifacts) {
    requireWireId(artifact.id, "artifact profile");
    if (artifact.rendererRefs.length === 0) throw new Error(`artifact '${artifact.id}' has no renderer`);
    if (artifact.serves.length === 0) throw new Error(`artifact '${artifact.id}' serves no surface`);
    requireUnique(artifact.rendererRefs, `renderer in artifact '${artifact.id}'`);
    requireUnique(artifact.requiredCapabilities, `capability in artifact '${artifact.id}'`);
    requireUnique(artifact.serves, `surface in artifact '${artifact.id}'`);
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
    for (const { screen, family } of declaration.componentFamilies) {
      for (const tree of family.trees.filter(({ surface }) => artifact.serves.includes(surface))) {
        for (const mount of tree.mounts) {
          const component = componentById.get(mount.instance);
          if (component === undefined) {
            throw new Error(`component family '${family.id}' mounts unknown instance '${mount.instance}'`);
          }
          const type = componentTypeById.get(component.componentTypeRef);
          if (type === undefined) {
            throw new Error(`component '${component.id}' uses unknown component type '${component.componentTypeRef}'`);
          }
          for (const capability of type.requiredCapabilities) {
            for (const renderer of artifactRenderers) {
              if (!renderer.capabilities.includes(capability)) {
                throw new Error(
                  `artifact '${artifact.id}' renderer '${renderer.id}' lacks component '${component.id}' capability '${capability}'`,
                );
              }
            }
          }
          mountedScopes.push({
            artifactRef: artifact.id,
            screenRef: screen,
            surface: tree.surface,
            mountRef: mount.id,
            componentInstanceRef: component.id,
          });
        }
      }
    }
  }

  for (const icon of declaration.iconRefs) {
    for (const artifactRef of icon.artifacts) {
      if (!artifacts.has(artifactRef)) throw new Error(`product icon '${icon.id}' uses missing artifact '${artifactRef}'`);
    }
  }
  const graph = compileProductGraph({
    serviceTypes: declaration.serviceTypes,
    services: declaration.services,
    configs: declaration.configs,
    componentTypes: declaration.componentTypes,
    components: declaration.components,
    mountedScopes,
  });
  return {
    kind: "product-spec-ir",
    schemaVersion: PRODUCT_SPEC_SCHEMA_VERSION,
    id: declaration.id,
    rendererBindings: declaration.rendererBindings,
    artifacts: declaration.artifacts,
    serviceTypes: graph.serviceTypes,
    services: graph.services,
    configs: graph.configs,
    finiteValues: declaration.finiteValues,
    componentTypes: graph.componentTypes,
    components: graph.components,
    componentFamilies: declaration.componentFamilies,
    portRegistry: graph.portRegistry,
    palette: declaration.palette,
    assetCatalogRef: declaration.assetCatalogRef,
    iconRefs: declaration.iconRefs,
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
  services: readonly LegoSpec[],
  components: readonly ComponentType[],
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
    ...services.flatMap((service) => [...service.inputs, ...service.outputs].map(({ contract }) => contract)),
    ...components.flatMap((component) => [...component.inputs, ...component.outputs].map(({ contract }) => contract)),
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
