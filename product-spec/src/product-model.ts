import {
  type CompatibleConnection,
  type LegoContract,
  type ProductInputPortRef,
  type ProductLegoConfig,
  type ProductLegoMount,
  type ProductOutputPortRef,
  validateProductLegoConfig,
} from "./native-lego-model.js";
import type { ComponentSpec, ScreenComponentFamilyRef } from "./component-tree-model.js";

export const PRODUCT_SPEC_SCHEMA_VERSION = 1 as const;

export interface RendererBinding<Id extends string = string, Capability extends string = string> {
  readonly id: Id;
  readonly capabilities: readonly Capability[];
}

export interface ArtifactProfile<
  Id extends string = string,
  RendererRef extends string = string,
  Capability extends string = string,
> {
  readonly id: Id;
  readonly rendererRefs: readonly RendererRef[];
  readonly requiredCapabilities: readonly Capability[];
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

export interface ProductLegoDeclaration<Mounts extends readonly ProductLegoMount[]> {
  readonly id: string;
  readonly contracts: readonly LegoContract[];
  readonly configs: readonly { readonly id: string }[];
  readonly mounts: Mounts;
  readonly wiring: readonly CompatibleConnection<Mounts>[];
}

export interface ProductDeclaration<
  Mounts extends readonly ProductLegoMount[],
  RendererId extends string,
  Capability extends string,
  ArtifactId extends string,
> {
  readonly id: string;
  readonly rendererBindings: readonly RendererBinding<RendererId, Capability>[];
  readonly artifacts: readonly ArtifactProfile<ArtifactId, RendererId, Capability>[];
  readonly legos: ProductLegoDeclaration<Mounts>;
  readonly componentCatalog: readonly ComponentSpec[];
  readonly componentFamilies: readonly ScreenComponentFamilyRef[];
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
  readonly ui: readonly ProductUiEntry[];
}

export function defineProduct<
  const Mounts extends readonly ProductLegoMount[],
  const RendererId extends string,
  const Capability extends string,
  const ArtifactId extends string,
>(declaration: ProductDeclaration<Mounts, RendererId, Capability, ArtifactId>): ProductIr {
  requireWireId(declaration.id, "product");
  requireUnique(declaration.rendererBindings.map(({ id }) => id), "renderer binding");
  requireUnique(declaration.artifacts.map(({ id }) => id), "artifact profile");
  requireUnique(declaration.ui.map(({ id }) => id), "UI entry");
  requireUnique(declaration.componentCatalog.map(({ id }) => id), "component id");
  requireUnique(declaration.componentFamilies.map(({ screen }) => screen), "component-family screen");
  requireUnique(declaration.componentFamilies.map(({ family }) => family.id), "component-family ref");
  const declaredComponents = new Set(declaration.componentCatalog.map(({ id }) => id));
  for (const { screen, family } of declaration.componentFamilies) {
    if (screen.trim() === "") throw new Error("component-family screen is empty");
    for (const tree of family.trees) {
      for (const item of tree.mounts) {
        if (!declaredComponents.has(item.component)) {
          throw new Error(`component family '${family.id}' uses missing component '${item.component}'`);
        }
      }
    }
  }

  const rendererById = new Map(declaration.rendererBindings.map((item) => [item.id, item]));
  for (const renderer of declaration.rendererBindings) {
    requireWireId(renderer.id, "renderer binding");
    requireUnique(renderer.capabilities, `capability in renderer '${renderer.id}'`);
    renderer.capabilities.forEach((id) => requireWireId(id, `capability in renderer '${renderer.id}'`));
  }

  const artifactById = new Map(declaration.artifacts.map((item) => [item.id, item]));
  for (const artifact of declaration.artifacts) {
    requireWireId(artifact.id, "artifact profile");
    if (artifact.rendererRefs.length === 0) throw new Error(`artifact '${artifact.id}' has no renderer`);
    requireUnique(artifact.rendererRefs, `renderer in artifact '${artifact.id}'`);
    requireUnique(artifact.requiredCapabilities, `capability in artifact '${artifact.id}'`);
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
  const contractById = new Map(declaration.legos.contracts.map((item) => [item.id, item]));
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
      const contractId = contractByPort.get(ref);
      const contract = contractId === undefined ? undefined : contractById.get(contractId);
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
    ui: declaration.ui,
  };
}

function contractMap(mounts: readonly ProductLegoMount[]): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
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
