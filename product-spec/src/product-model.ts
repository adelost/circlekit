import {
  type LegoContract,
  type ProductInputPortRef,
  type ProductLegoConfig,
  type ProductLegoDeclaration,
  type ProductLegoMount,
  type ProductOutputPortRef,
  validateProductLegoConfig,
} from "./native-lego-model.js";
import type {
  ComponentSpec,
  PortableSurfaceClass,
  ScreenComponentFamilyRef,
} from "./component-tree-model.js";
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

export const PRODUCT_SPEC_SCHEMA_VERSION = 4 as const;

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

export interface UiPortRefs<InputRef extends string = string, OutputRef extends string = string> {
  readonly state?: OutputRef;
  readonly value?: OutputRef;
  readonly enabled?: OutputRef;
  readonly active?: OutputRef;
  readonly action?: InputRef;
}

export interface ProductUiEntry<
  InputRef extends string = string,
  OutputRef extends string = string,
  ArtifactRef extends string = string,
  Capability extends string = string,
> {
  readonly id: string;
  readonly kind: "menu-entry" | "component-entry";
  readonly artifacts: readonly ArtifactRef[];
  readonly requiredCapabilities: readonly Capability[];
  readonly ports: UiPortRefs<InputRef, OutputRef>;
}

export interface ProductDeclaration<
  Mounts extends readonly ProductLegoMount[],
  RendererId extends string,
  Capability extends string,
  ArtifactId extends string,
  PaletteVariant extends PortablePaletteVariant,
  Families extends readonly ScreenComponentFamilyRef[],
> {
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding<RendererId, Capability>[];
  readonly artifacts: readonly ArtifactProfile<
    ArtifactId,
    RendererId,
    Capability,
    NoInfer<Families[number]["screen"]>
  >[];
  readonly legos: ProductLegoDeclaration<Mounts>;
  readonly componentCatalog: readonly ComponentSpec[];
  readonly componentFamilies: Families;
  readonly palette: ProductPalette<PaletteVariant>;
  readonly assetCatalogRef: PortableAssetCatalogRef;
  readonly iconRefs: readonly ProductIconRef<PaletteTokenRef<PaletteVariant>, ArtifactId>[];
  readonly ui: readonly ProductUiEntry<
    ProductInputPortRef<Mounts>,
    ProductOutputPortRef<Mounts>,
    ArtifactId,
    Capability
  >[];
}

export interface ProductIr {
  readonly kind: "product-spec-ir";
  readonly schemaVersion: typeof PRODUCT_SPEC_SCHEMA_VERSION;
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding[];
  readonly artifacts: readonly ArtifactProfile[];
  readonly legos: ProductLegoConfig;
  readonly componentCatalog: readonly ComponentSpec[];
  readonly componentFamilies: readonly ScreenComponentFamilyRef[];
  readonly palette: ProductPalette;
  readonly assetCatalogRef: PortableAssetCatalogRef;
  readonly iconRefs: readonly ProductIconRef[];
  readonly ui: readonly ProductUiEntry[];
}

export function defineProduct<
  const Mounts extends readonly ProductLegoMount[],
  const RendererId extends string,
  const Capability extends string,
  const ArtifactId extends string,
  const PaletteVariant extends PortablePaletteVariant,
  const Families extends readonly ScreenComponentFamilyRef[],
>(
  declaration: ProductDeclaration<Mounts, RendererId, Capability, ArtifactId, PaletteVariant, Families>,
  assetCatalog: PortableAssetCatalog,
): ProductIr {
  requireWireId(declaration.id, "product");
  requireUnique(declaration.rendererBindings.map(({ id }) => id), "renderer binding");
  requireUnique(declaration.artifacts.map(({ id }) => id), "artifact profile");
  requireUnique(declaration.ui.map(({ id }) => id), "UI entry");
  requireUnique(declaration.componentCatalog.map(({ id }) => id), "component id");
  requireUnique(declaration.componentFamilies.map(({ screen }) => screen), "component-family screen");
  requireUnique(declaration.componentFamilies.map(({ family }) => family.id), "component-family ref");
  definePalette(declaration.palette.variants);
  definePortableAssetCatalog(assetCatalog);
  if (declaration.assetCatalogRef.id !== assetCatalog.id || declaration.assetCatalogRef.version !== assetCatalog.version) {
    throw new Error(`asset catalog reference '${declaration.assetCatalogRef.id}@${declaration.assetCatalogRef.version}' does not match '${assetCatalog.id}@${assetCatalog.version}'`);
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
    const expectedLayerSlots = (asset.layers ?? []).map(({ slot }) => slot);
    const actualLayerSlots = (icon.layers ?? []).map(({ slot }) => slot);
    requireUnique(actualLayerSlots, `layer slot in product icon '${icon.id}'`);
    for (const layer of icon.layers ?? []) {
      if (!paletteTokens.has(layer.accent)) throw new Error(`product icon '${icon.id}' layer '${layer.slot}' uses missing palette token '${layer.accent}'`);
    }
    if (JSON.stringify(actualLayerSlots) !== JSON.stringify(expectedLayerSlots)) {
      throw new Error(`product icon '${icon.id}' must bind exact layer slots [${expectedLayerSlots.join(", ")}]`);
    }
    if (icon.artifacts.length === 0) throw new Error(`product icon '${icon.id}' has no artifact`);
    requireUnique(icon.artifacts, `artifact in product icon '${icon.id}'`);
  }
  const declaredComponents = new Set(declaration.componentCatalog.map(({ id }) => id));
  const usedComponents = new Set<string>();
  for (const { screen, family } of declaration.componentFamilies) {
    if (screen.trim() === "") throw new Error("component-family screen is empty");
    for (const tree of family.trees) {
      for (const item of tree.mounts) {
        usedComponents.add(item.component);
        if (!declaredComponents.has(item.component)) {
          throw new Error(`component family '${family.id}' uses missing component '${item.component}'`);
        }
      }
    }
  }
  const orphanComponents = [...declaredComponents].filter((id) => !usedComponents.has(id));
  if (orphanComponents.length > 0) {
    throw new Error(`product has orphan component '${orphanComponents.join("', '")}'`);
  }

  const rendererById = new Map(declaration.rendererBindings.map((item) => [item.id, item]));
  for (const renderer of declaration.rendererBindings) {
    requireWireId(renderer.id, "renderer binding");
    requireUnique(renderer.capabilities, `capability in renderer '${renderer.id}'`);
    renderer.capabilities.forEach((id) => requireWireId(id, `capability in renderer '${renderer.id}'`));
  }

  const artifactById = new Map(declaration.artifacts.map((item) => [item.id, item]));
  for (const icon of declaration.iconRefs) {
    for (const artifactRef of icon.artifacts) {
      if (!artifactById.has(artifactRef)) throw new Error(`product icon '${icon.id}' uses missing artifact '${artifactRef}'`);
    }
  }
  for (const artifact of declaration.artifacts) {
    requireWireId(artifact.id, "artifact profile");
    if (artifact.rendererRefs.length === 0) throw new Error(`artifact '${artifact.id}' has no renderer`);
    if (artifact.serves.length === 0) throw new Error(`artifact '${artifact.id}' serves no surface`);
    requireUnique(artifact.rendererRefs, `renderer in artifact '${artifact.id}'`);
    requireUnique(artifact.requiredCapabilities, `capability in artifact '${artifact.id}'`);
    requireUnique(artifact.serves, `surface in artifact '${artifact.id}'`);
    const entry = declaration.componentFamilies.find(({ screen }) => screen === artifact.entryScreen);
    if (entry === undefined) throw new Error(`artifact '${artifact.id}' uses missing entry screen '${artifact.entryScreen}'`);
    for (const surface of artifact.serves) {
      if (!entry.family.trees.some((tree) => tree.surface === surface)) {
        throw new Error(`artifact '${artifact.id}' entry screen '${artifact.entryScreen}' has no '${surface}' tree`);
      }
    }
    for (const rendererRef of artifact.rendererRefs) {
      const renderer = rendererById.get(rendererRef);
      if (renderer === undefined) throw new Error(`artifact '${artifact.id}' uses missing renderer '${rendererRef}'`);
      for (const capability of artifact.requiredCapabilities) {
        if (!renderer.capabilities.includes(capability)) {
          throw new Error(`artifact '${artifact.id}' renderer '${rendererRef}' lacks capability '${capability}'`);
        }
      }
    }
  }

  const externalInputs = new Set<string>();
  const externalOutputs = new Set<string>();
  const contractByPort = contractMap(declaration.legos.mounts);
  for (const entry of declaration.ui) {
    requireWireId(entry.id, "UI entry");
    if (entry.artifacts.length === 0) throw new Error(`UI entry '${entry.id}' has no artifact`);
    requireUnique(entry.artifacts, `artifact in UI entry '${entry.id}'`);
    for (const artifactRef of entry.artifacts) {
      const artifact = artifactById.get(artifactRef);
      if (artifact === undefined) throw new Error(`UI entry '${entry.id}' uses missing artifact '${artifactRef}'`);
      for (const capability of entry.requiredCapabilities) {
        for (const rendererRef of artifact.rendererRefs) {
          const renderer = rendererById.get(rendererRef);
          if (renderer === undefined || !renderer.capabilities.includes(capability)) {
            throw new Error(`UI entry '${entry.id}' lacks capability '${capability}' in artifact '${artifactRef}'`);
          }
        }
      }
    }
    const refs = Object.values(entry.ports);
    if (refs.length === 0) throw new Error(`UI entry '${entry.id}' has no port reference`);
    for (const [role, ref] of Object.entries(entry.ports)) {
      if (ref === undefined) continue;
      const contract = contractByPort.get(ref);
      if (contract === undefined) throw new Error(`UI entry '${entry.id}' uses missing ${role} port '${ref}'`);
      if (role === "action") {
        if (externalInputs.has(ref)) throw new Error(`input port '${ref}' is produced by two UI entries`);
        if (contract.kind !== "event") throw new Error(`UI action port '${ref}' must use an event contract`);
        externalInputs.add(ref);
      } else {
        if (contract.kind === "event") throw new Error(`UI ${role} port '${ref}' cannot use an event contract`);
        if ((role === "enabled" || role === "active") && !isBooleanContract(contract)) {
          throw new Error(`UI ${role} port '${ref}' must use a single boolean field contract`);
        }
        externalOutputs.add(ref);
      }
    }
  }

  const legos = validateProductLegoConfig(
    declaration.legos,
    externalInputs,
    externalOutputs,
  );
  return {
    kind: "product-spec-ir",
    schemaVersion: PRODUCT_SPEC_SCHEMA_VERSION,
    id: declaration.id,
    rendererBindings: declaration.rendererBindings,
    artifacts: declaration.artifacts,
    legos,
    componentCatalog: declaration.componentCatalog,
    componentFamilies: declaration.componentFamilies,
    palette: declaration.palette,
    assetCatalogRef: declaration.assetCatalogRef,
    iconRefs: declaration.iconRefs,
    ui: declaration.ui,
  };
}

function contractMap(mounts: readonly ProductLegoMount[]): ReadonlyMap<string, LegoContract> {
  const result = new Map<string, LegoContract>();
  for (const mount of mounts) {
    for (const item of mount.lego.inputs) result.set(`${mount.id}.${item.id}`, item.contract);
    for (const item of mount.lego.outputs) result.set(`${mount.id}.${item.id}`, item.contract);
  }
  return result;
}

function isBooleanContract(contract: LegoContract): boolean {
  return contract.fields.length === 1 && contract.fields[0]?.value === "boolean";
}

function requireWireId(value: string, owner: string): void {
  if (!/^[a-z][a-z0-9.-]*$/u.test(value)) throw new Error(`${owner} has invalid wire id '${value}'`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
