import {
  defineComponentType,
  type ComponentTypeDeclaration,
  type NormalizedComponentType,
} from "./component-tree-model.js";
import type { FetchService } from "./fetch-service-model.js";
import type { ProductComponentInstance } from "./component-tree-model.js";
import type { ProductNodeInstance } from "./node-instance-model.js";
import type { NodeOutputRef } from "./node-authoring.js";
import type { ProductNodeType } from "./node-model.js";
import type { StoreService } from "./store-service-model.js";
import { frozen } from "./frozen.js";
import { declarationSite, declaredSite, rememberDeclarationSite } from "./source-site.js";
import { requireUnique, requireWireId } from "./node-model.js";

export const RENDERER_STYLES = {
  terrain: ["relief", "flat"],
  tiles: ["raster", "vector", "dimmed"],
  volume: ["contour", "base", "veil"],
  windMark: ["arrow", "gauge", "station", "altitude"],
  path: ["live", "saved", "drift", "aircraft"],
  marker: ["home", "aircraft", "station", "pile", "you", "cutaway", "point"],
  ring: ["distance", "accuracy", "coverage", "cache"],
  tag: ["place", "height", "wind", "station", "altitude", "distance", "aircraft", "status"],
} as const;

export type RendererKind = keyof typeof RENDERER_STYLES;
export type SceneCamera = "iso" | "replay" | "geo";
export type SceneAction = "time" | "layers" | "refresh" | "home" | "camera";
export type SceneSource = FetchService | StoreService | NodeOutputRef<string, string, string>;
export type RendererStyle<K extends RendererKind> = (typeof RENDERER_STYLES)[K][number];
export type SceneDerive = ProductNodeType & { readonly kind: "derive" };

export interface LayerSpec<K extends RendererKind = RendererKind> {
  readonly source: SceneSource;
  readonly derive?: SceneDerive;
  readonly renderer: K;
  readonly style: (typeof RENDERER_STYLES)[K][number];
}

export interface Layer<Id extends string = string, K extends RendererKind = RendererKind> {
  readonly id: Id;
  readonly source: SceneSource;
  readonly derive?: SceneDerive;
  readonly renderer: K;
  readonly style: RendererStyle<K>;
}

export interface SceneSpec extends Omit<ComponentTypeDeclaration, "id"> {
  readonly frame: "standard";
  readonly camera: SceneCamera;
  readonly layers: readonly Layer[];
  readonly actions: readonly SceneAction[];
}

type SceneComponentDeclaration<Id extends string, Spec extends SceneSpec> =
  Omit<ComponentTypeDeclaration<Id>, "inputs" | "outputs" | "requiredCapabilities"> & {
    readonly inputs: Spec["inputs"];
    readonly outputs: Spec["outputs"];
  } & (Spec extends { readonly requiredCapabilities: infer Capabilities extends readonly string[] }
    ? { readonly requiredCapabilities: Capabilities }
    : {});

type AnySceneComponentDeclaration = Omit<ComponentTypeDeclaration, "requiredCapabilities"> & {
  readonly requiredCapabilities: readonly string[];
};

export type Scene<Declaration extends ComponentTypeDeclaration = AnySceneComponentDeclaration> =
  NormalizedComponentType<Declaration> & {
    readonly camera: SceneCamera;
    readonly layers: readonly Layer[];
    readonly actions: readonly SceneAction[];
  };

export interface CompiledSceneLayer {
  readonly id: string;
  readonly renderer: RendererKind;
  readonly style: string;
  readonly source: { readonly kind: "fetch" | "store" | "node"; readonly id: string };
  readonly derive?: string;
}

export interface CompiledScene {
  readonly id: string;
  readonly camera: SceneCamera;
  readonly actions: readonly SceneAction[];
  readonly layers: readonly CompiledSceneLayer[];
}

export function layer<const Id extends string, const K extends RendererKind>(
  id: Id,
  spec: LayerSpec<K>,
): Layer<Id, K> {
  requireWireId(id, "scene layer");
  const site = declarationSite(layer);
  const sourceKind = sceneSourceKind(spec?.source);
  if (sourceKind === undefined) {
    throw new Error(`layer '${id}' source must be a fetchService, storeService or nodeOutput(...) [${site}]`);
  }
  if (!isRendererKind(spec.renderer)) {
    throw new Error(`layer '${id}' has unknown renderer '${String(spec.renderer)}' [${site}]`);
  }
  if (!RENDERER_STYLES[spec.renderer].includes(spec.style as never)) {
    throw new Error(`layer '${id}' style '${String(spec.style)}' is not a ${spec.renderer} style; use one of ${RENDERER_STYLES[spec.renderer].join(", ")}, or add it to RENDERER_STYLES.${spec.renderer} [${site}]`);
  }
  if (spec.derive !== undefined && (!isRecord(spec.derive) || spec.derive.kind !== "derive" ||
      typeof spec.derive.id !== "string")) {
    throw new Error(`layer '${id}' derive must be a ProductNodeType with kind 'derive' [${site}]`);
  }
  const result: Layer<Id, K> = {
    id,
    source: spec.source,
    ...(spec.derive === undefined ? {} : { derive: spec.derive }),
    renderer: spec.renderer,
    style: spec.style,
  };
  rememberDeclarationSite(result, site);
  return frozen(result);
}

export function scene<const Id extends string, const Spec extends SceneSpec>(
  id: Id,
  spec: Spec,
): Scene<SceneComponentDeclaration<Id, Spec>> {
  requireWireId(id, "scene");
  const site = declarationSite(scene);
  if (spec?.frame !== "standard") throw new Error(`scene '${id}' needs frame: "standard" [${site}]`);
  if (!isSceneCamera(spec.camera)) throw new Error(`scene '${id}' has unknown camera '${String(spec.camera)}' [${site}]`);
  if (!Array.isArray(spec.layers)) throw new Error(`scene '${id}' needs layers [${site}]`);
  if (!Array.isArray(spec.actions) || spec.actions.some((action) => !isSceneAction(action))) {
    throw new Error(`scene '${id}' has an unknown action [${site}]`);
  }
  requireUnique(spec.actions, `action in scene '${id}'`);
  const componentType = defineComponentType({
    id,
    inputs: spec.inputs,
    outputs: spec.outputs,
    ...(spec.requiredCapabilities === undefined ? {} : { requiredCapabilities: spec.requiredCapabilities }),
  } as const);
  const result = {
    ...componentType,
    camera: spec.camera,
    layers: spec.layers,
    actions: spec.actions,
  } as unknown as Scene<SceneComponentDeclaration<Id, Spec>>;
  rememberDeclarationSite(result, site);
  return frozen(result);
}

export function compileScenes(
  scenes: readonly Scene[],
  nodes: readonly { readonly id: string; readonly nodeTypeRef: string }[],
  nodeTypes: readonly ProductNodeType[],
  componentTypes: readonly { readonly id: string }[],
): { readonly scenes?: readonly CompiledScene[] } {
  if (scenes.length === 0) return {};
  requireUnique(scenes.map(({ id }) => id), "scene");
  const nodeTypeById = new Map(nodeTypes.map((type) => [type.id, type]));
  const componentTypeIds = componentTypes.map(({ id }) => id);
  const compiled = scenes.map((declared) => {
    const site = declaredSite(declared) ?? "source unknown";
    const namespace = declared.id.endsWith(".scene") ? declared.id.slice(0, -".scene".length) : declared.id;
    const chrome = componentTypeIds.find((componentTypeId) =>
      componentTypeId.startsWith(namespace) && isChromeType(componentTypeId.slice(namespace.length)));
    if (chrome !== undefined) {
      throw new Error(`scene '${declared.id}' declares its own chrome component '${chrome}'; use frame: "standard" [${site}]`);
    }
    const seen = new Map<string, Layer>();
    const layers = declared.layers.map((item) => {
      const layerSite = declaredSite(item) ?? site;
      const kind = sceneSourceKind(item.source);
      if (kind === undefined) throw new Error(`layer '${item.id}' source must be a fetchService, storeService or nodeOutput(...) [${layerSite}]`);
      const sourceId = sourceIdFor(item.source, kind);
      const duplicateKey = JSON.stringify([kind, sourceId, item.derive?.id ?? null, item.renderer, item.style]);
      const previous = seen.get(duplicateKey);
      if (previous !== undefined) {
        throw new Error(`scene '${declared.id}' has two layers with the same source, derive, renderer and style: '${previous.id}', '${item.id}' [${layerSite}]`);
      }
      seen.set(duplicateKey, item);
      if (kind === "node") {
        const resolved = resolveNodeOutput(item.source as NodeOutputRef<string, string, string>, nodes, nodeTypeById);
        if (resolved === undefined) {
          throw new Error(`layer '${item.id}' uses unresolved node output '${sourceId}' [${layerSite}]`);
        }
        const { nodeType } = resolved;
        if (nodeType.runtime.effects.some((effect) => effect.startsWith("network."))) {
          throw new Error(`layer '${item.id}' reads network output '${sourceId}' directly; declare a fetchService and use it as the source [${layerSite}]`);
        }
      }
      return {
        id: item.id,
        renderer: item.renderer,
        style: item.style,
        source: { kind, id: sourceId },
        ...(item.derive === undefined ? {} : { derive: item.derive.id }),
      };
    });
    return { id: declared.id, camera: declared.camera, actions: declared.actions, layers };
  });
  return { scenes: compiled };
}

/** Every declared layer source must occur in the data path feeding an instance of its scene. */
export function requireSceneLayerSourcesReachInputs(
  scenes: readonly Scene[],
  components: readonly ProductComponentInstance[],
  nodes: readonly ProductNodeInstance[],
  nodeTypes: readonly ProductNodeType[],
): void {
  const nodeTypeById = new Map(nodeTypes.map((type) => [type.id, type]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIdsByLength = [...nodeById.keys()].sort((left, right) => right.length - left.length);
  for (const declaredScene of scenes) {
    const instances = components.filter(({ componentTypeRef }) => componentTypeRef === declaredScene.id);
    const inputSources = instances.flatMap(({ bindings }) => Object.values(bindings.inputs));
    for (const item of declaredScene.layers) {
      if (sceneSourceReachesInputs(item.source, inputSources, nodeIdsByLength, nodeById, nodeTypeById)) continue;
      const kind = sceneSourceKind(item.source)!;
      const sourceId = sourceIdFor(item.source, kind);
      throw new Error(`layer '${item.id}' source '${sourceId}' never reaches scene '${declaredScene.id}' inputs; bind the source into the scene's projection or name the source it really reads [${declaredSite(item) ?? "source unknown"}]`);
    }
  }
}

function sceneSourceReachesInputs(
  source: SceneSource,
  inputSources: readonly string[],
  nodeIdsByLength: readonly string[],
  nodeById: ReadonlyMap<string, ProductNodeInstance>,
  nodeTypeById: ReadonlyMap<string, ProductNodeType>,
): boolean {
  const kind = sceneSourceKind(source);
  if (kind === undefined || inputSources.length === 0) return false;
  const sourceId = sourceIdFor(source, kind);
  const pending = [...inputSources];
  const visitedPorts = new Set<string>();
  const visitedNodes = new Set<string>();
  while (pending.length > 0) {
    const ref = pending.pop()!;
    if (visitedPorts.has(ref)) continue;
    visitedPorts.add(ref);
    if (kind === "node" && ref === sourceId) return true;
    const producerId = nodeIdsByLength.find((id) => ref.startsWith(`${id}.`));
    if (producerId === undefined) continue;
    const node = nodeById.get(producerId)!;
    const nodeType = nodeTypeById.get(node.nodeTypeRef);
    if (nodeType === undefined) continue;
    if (kind !== "node" && serviceSourceMatchesNode(source as FetchService | StoreService, node, nodeType)) return true;
    if (visitedNodes.has(node.id)) continue;
    visitedNodes.add(node.id);
    for (const input of nodeType.inputs) {
      if (input.purpose !== "data") continue;
      const upstream = node.bindings[input.id];
      if (upstream !== undefined) pending.push(upstream);
    }
  }
  return false;
}

function serviceSourceMatchesNode(
  source: FetchService | StoreService,
  node: ProductNodeInstance,
  nodeType: ProductNodeType,
): boolean {
  if (source.id === node.id || source.id === node.nodeTypeRef) return true;
  if ("flow" in source) {
    const declaredService = (source as FetchService & { readonly service?: unknown }).service;
    if (declaredService !== undefined) {
      return declaredService === node.id || declaredService === node.nodeTypeRef;
    }
  }
  const nodeEffects = new Set(nodeType.runtime.effects);
  return source.effectIds.every((effect) => nodeEffects.has(effect));
}

function resolveNodeOutput(
  source: NodeOutputRef<string, string, string>,
  nodes: readonly { readonly id: string; readonly nodeTypeRef: string }[],
  nodeTypeById: ReadonlyMap<string, ProductNodeType>,
): { readonly nodeType: ProductNodeType } | undefined {
  const producer = [...nodes].sort((left, right) => right.id.length - left.id.length)
    .find(({ id }) => source.ref.startsWith(`${id}.`));
  if (producer === undefined) return undefined;
  const portId = source.ref.slice(producer.id.length + 1);
  const nodeType = nodeTypeById.get(producer.nodeTypeRef);
  const output = nodeType?.outputs.find((port) => port.id === portId && port.purpose === source.purpose &&
    port.contract.id === source.contract);
  return output === undefined || nodeType === undefined ? undefined : { nodeType };
}

function sceneSourceKind(source: unknown): "fetch" | "store" | "node" | undefined {
  if (!isRecord(source)) return undefined;
  if (source.pattern === "fetch" && typeof source.id === "string" && "failure" in source &&
      "flow" in source && "freshness" in source && Array.isArray(source.effectIds)) return "fetch";
  if (source.pattern === "store" && typeof source.id === "string" &&
      (source.backend === "file" || source.backend === "preferences") && "codec" in source &&
      typeof source.identity === "string" && Array.isArray(source.effectIds)) return "store";
  if (typeof source.ref === "string" && typeof source.contract === "string" &&
      typeof source.purpose === "string") return "node";
  return undefined;
}

function sourceIdFor(source: SceneSource, kind: "fetch" | "store" | "node"): string {
  if (kind === "node") return (source as NodeOutputRef<string, string, string>).ref;
  return (source as FetchService | StoreService).id;
}

function isRendererKind(value: unknown): value is RendererKind {
  return typeof value === "string" && Object.hasOwn(RENDERER_STYLES, value);
}

function isSceneCamera(value: unknown): value is SceneCamera {
  return value === "iso" || value === "replay" || value === "geo";
}

function isSceneAction(value: unknown): value is SceneAction {
  return value === "time" || value === "layers" || value === "refresh" || value === "home" || value === "camera";
}

function isChromeType(suffix: string): boolean {
  const kebab = suffix.replace(/([a-z])([A-Z])/gu, "$1-$2").toLowerCase();
  return /(?:^|[._-])(?:header|controls?|title)(?:$|[._-])/u.test(kebab);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
