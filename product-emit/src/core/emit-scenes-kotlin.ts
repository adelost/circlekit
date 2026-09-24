import {
  RENDERER_STYLES,
  SCENE_PASSES,
  type CompiledScene,
  type ProductEmitterPlugin,
  type ProductIr,
  type RendererKind,
} from "@v1d/product-spec";
import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";

export interface SceneKotlinEmissionOptions extends SourcedKotlinEmissionOptions {
  readonly nativeScenePackage: string;
  readonly sceneRuntimePackage?: string;
  readonly outputDirectory: string;
}

/** Generates only the declared scene data. Rendering and source providers remain platform-owned. */
export function emitScenesKotlin(
  scenes: readonly CompiledScene[],
  options: SceneKotlinEmissionOptions,
): string {
  if (scenes.length === 0) throw new Error("scene Kotlin emission has no scenes");
  const runtimePackage = requireSceneRuntimePackage(options.sceneRuntimePackage);
  const prefix = kotlinIdentifier(options.symbolPrefix);
  const sceneName = `Generated${prefix}Scenes`;
  const layerIdEnum = `Generated${prefix}SceneLayerId`;
  const passEnum = `Generated${prefix}ScenePass`;
  const layers = scenes.flatMap((scene) => scene.layers);
  const renderers = unique(layers.map(({ renderer }) => renderer));
  const sources = uniqueBy(layers.map(({ source }) => source), ({ kind, id }) => `${kind}:${id}`);
  const cameras = unique(scenes.flatMap(({ cameras: sceneCameras }) => sceneCameras));
  const actions = unique(scenes.flatMap(({ actions }) => actions));
  const layerIdRows = scenes.flatMap((scene) => {
    const ids = new Set<string>();
    return scene.layers.map(({ id }) => {
      if (ids.has(id)) throw new Error(`scene '${scene.id}' repeats layer id '${id}', use a unique layer id for each provider`);
      ids.add(id);
      return { id, tokenKey: `${scene.id}.${id}`, refKey: layerRefKey(scene.id, id) };
    });
  });
  const sceneNames = sceneTypeNames(scenes, prefix);

  const styleValues = new Map<RendererKind, string[]>();
  for (const scene of scenes) {
    for (const layer of scene.layers) {
      const renderer = layer.renderer;
      const allowed = RENDERER_STYLES[renderer];
      if (allowed === undefined || !allowed.includes(layer.style as never)) {
        throw new Error(`scene '${scene.id}' layer '${layer.id}' has unsupported ${renderer} style '${layer.style}'`);
      }
      const current = styleValues.get(renderer) ?? [];
      if (!current.includes(layer.style)) current.push(layer.style);
      styleValues.set(renderer, current);
    }
  }
  const sceneTokens = enumRows(scenes.map(({ id }) => id), `scene in ${sceneName}`);
  const rendererTokens = enumRows(renderers, `renderer in ${sceneName}`);
  const sourceEnumRows = sources.map(({ kind, id }) => ({ id, tokenKey: `${kind}_${id}` }));
  const sourceTokens = enumRows(sourceEnumRows.map(({ tokenKey }) => tokenKey), `source in ${sceneName}`);
  const cameraTokens = enumRows(cameras, `camera in ${sceneName}`);
  const actionTokens = enumRows(actions, `action in ${sceneName}`);
  const passTokens = enumRows(SCENE_PASSES, `pass in ${sceneName}`);
  const layerIdTokens = enumRows(layerIdRows.map(({ tokenKey }) => tokenKey), `layer id in ${sceneName}`);
  const scopedLayerTokens = new Map(scenes.map((scene) => [
    scene.id,
    enumRows(scene.layers.map(({ id }) => id), `layer id in ${sceneNames.get(scene.id)}`),
  ] as const));
  const styleTokens = new Map<RendererKind, ReadonlyMap<string, string>>();
  for (const [renderer, values] of styleValues) {
    styleTokens.set(renderer, enumRows(values, `${renderer} style in ${sceneName}`));
  }
  const sourceTokenByRef = new Map(sources.map(({ kind, id }) => [`${kind}:${id}`, sourceTokens.get(`${kind}_${id}`)!] as const));
  const layerIdTokenByRef = new Map(layerIdRows.map(({ tokenKey, refKey }) => [refKey, layerIdTokens.get(tokenKey)!] as const));
  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeScenePackage}.GeneratedScene
import ${options.nativeScenePackage}.GeneratedSceneAction
import ${options.nativeScenePackage}.GeneratedSceneCamera
import ${options.nativeScenePackage}.GeneratedSceneLayer
import ${options.nativeScenePackage}.GeneratedSceneRenderer
import ${runtimePackage}.GeneratedScenePass
import ${options.nativeScenePackage}.GeneratedSceneSource
import ${options.nativeScenePackage}.GeneratedSceneStyle
import ${runtimePackage}.GeneratedSceneLayerId
import ${runtimePackage}.GeneratedSceneLayerToggle

${emitIdEnum(`${sceneName}Renderer`, "GeneratedSceneRenderer", renderers, rendererTokens)}
${emitIdEnum(`${sceneName}Source`, "GeneratedSceneSource", sourceEnumRows, sourceTokens)}
${emitIdEnum(`${sceneName}Camera`, "GeneratedSceneCamera", cameras, cameraTokens)}
${actions.length === 0 ? "" : emitIdEnum(`${sceneName}Action`, "GeneratedSceneAction", actions, actionTokens)}
${emitIdEnum(passEnum, "GeneratedScenePass", SCENE_PASSES, passTokens)}
${[...styleValues].map(([renderer, values]) => emitStyleEnum(sceneName, renderer, values, styleTokens.get(renderer)!)).join("\n\n")}
${emitIdEnum(layerIdEnum, "GeneratedSceneLayerId", layerIdRows, layerIdTokens)}
${scenes.map((scene) => emitScopedScene(scene, sceneName, sceneNames.get(scene.id)!, layerIdEnum, passEnum, rendererTokens, sourceTokenByRef, layerIdTokenByRef, cameraTokens, passTokens, styleTokens, scopedLayerTokens.get(scene.id)!)).join("\n\n")}
object ${sceneName} {
${scenes.map((scene) => `    val ${sceneTokens.get(scene.id)}: ${sceneNames.get(scene.id)} = ${emitScene(scene, sceneName, sceneNames.get(scene.id)!, cameraTokens, actionTokens, scopedLayerTokens.get(scene.id)!)}`).join("\n\n")}

    val all: List<GeneratedScene> = listOf(${scenes.map(({ id }) => `${sceneName}.${sceneTokens.get(id)}.runtime`).join(", ")})
}
`;
}

/** ProductEmitterPlugin adapter: a scene-free product produces no file. */
export function sceneKotlinEmitter(options: SceneKotlinEmissionOptions): ProductEmitterPlugin {
  validateOutputDirectory(options.outputDirectory);
  const symbol = `Generated${kotlinIdentifier(options.symbolPrefix)}Scenes.kt`;
  const path = `${options.outputDirectory.replace(/\/$/u, "")}/${symbol}`;
  return {
    id: "scene-kotlin",
    emit(product: ProductIr) {
      if (!product.scenes || product.scenes.length === 0) return [];
      requireSceneRuntimePackage(options.sceneRuntimePackage, product.id);
      return [{
        id: `scene-kotlin:${product.id}`,
        path,
        mediaType: "text/x-kotlin",
        content: emitScenesKotlin(product.scenes, options),
      }];
    },
  };
}

function requireSceneRuntimePackage(value: string | undefined, productId = "<unknown>"): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`product '${productId}' declares scenes but sceneRuntimePackage is missing; set sceneRuntimePackage in the product's emit configuration`);
  }
  return value;
}

function emitIdEnum(name: string, implemented: string, values: readonly string[] | readonly { readonly id: string; readonly tokenKey?: string }[], tokens: ReadonlyMap<string, string>): string {
  if (values.length === 0) return "";
  const ids = values.map((value) => typeof value === "string" ? value : value.id);
  const tokenKeys = values.map((value) => typeof value === "string" ? value : value.tokenKey ?? value.id);
  return `enum class ${name}(override val id: String) : ${implemented} {
${ids.map((id, index) => `    ${tokens.get(tokenKeys[index]!)}(${kotlinStringLiteral(id)}),`).join("\n")}
}`;
}

function emitStyleEnum(
  sceneName: string,
  renderer: RendererKind,
  values: readonly string[],
  tokens: ReadonlyMap<string, string>,
): string {
  const name = `${sceneName}${kotlinIdentifier(renderer)}Style`;
  const implemented = `GeneratedSceneStyle.${kotlinIdentifier(renderer)}`;
  return `enum class ${name}(override val id: String) : ${implemented} {
${values.map((id) => `    ${tokens.get(id)}(${kotlinStringLiteral(id)}),`).join("\n")}
}`;
}

function emitScopedScene(
  scene: CompiledScene,
  sceneName: string,
  sceneType: string,
  layerIdEnum: string,
  passEnum: string,
  rendererTokens: ReadonlyMap<string, string>,
  sourceTokens: ReadonlyMap<string, string>,
  layerIdTokens: ReadonlyMap<string, string>,
  cameraTokens: ReadonlyMap<string, string>,
  passTokens: ReadonlyMap<string, string>,
  styleTokens: ReadonlyMap<RendererKind, ReadonlyMap<string, string>>,
  scopedLayerTokens: ReadonlyMap<string, string>,
): string {
  const layers = scene.layers.map((layer) => {
    const layerId = layerIdTokens.get(layerRefKey(scene.id, layer.id));
    const renderer = rendererTokens.get(layer.renderer);
    const style = styleTokens.get(layer.renderer)?.get(layer.style);
    const source = sourceTokens.get(`${layer.source.kind}:${layer.source.id}`);
    if (!layerId || !renderer || !style || !source) throw new Error(`scene '${scene.id}' layer '${layer.id}' has an incomplete generated enum mapping`);
    const cameras = layer.cameras === undefined ? "" : `, cameras = listOf(${layer.cameras.map((camera) => `${sceneName}Camera.${cameraTokens.get(camera)}`).join(", ")})`;
    const toggle = layer.toggle === undefined ? "" : `, toggle = GeneratedSceneLayerToggle(${layer.toggle.group === undefined ? "" : `group = ${kotlinStringLiteral(layer.toggle.group)}, `}default = ${layer.toggle.default})`;
    const pass = passTokens.get(layer.pass);
    if (!pass) throw new Error(`scene '${scene.id}' layer '${layer.id}' has unknown pass '${layer.pass}'`);
    return `    ${scopedLayerTokens.get(layer.id)}(${kotlinStringLiteral(layer.id)}, GeneratedSceneLayer(id = ${layerIdEnum}.${layerId}, renderer = ${sceneName}Renderer.${renderer}, style = ${sceneName}${kotlinIdentifier(layer.renderer)}Style.${style}, source = ${sceneName}Source.${source}${cameras}${toggle}, pass = ${passEnum}.${pass})),`;
  });
  const sceneLayerName = `${sceneType}Layer`;
  return `enum class ${sceneLayerName}(override val id: String, val value: GeneratedSceneLayer) : GeneratedSceneLayerId {
${layers.join("\n")}
}

data class ${sceneType}(
    val id: String,
    val cameras: List<GeneratedSceneCamera>,
    val actions: List<GeneratedSceneAction>,
    val layers: List<${sceneLayerName}>,
) {
    val runtime: GeneratedScene = GeneratedScene(
        id = id,
        cameras = cameras,
        actions = actions,
        layers = layers.map { it.value },
    )
}`;
}

function emitScene(
  scene: CompiledScene,
  sceneName: string,
  sceneType: string,
  cameraTokens: ReadonlyMap<string, string>,
  actionTokens: ReadonlyMap<string, string>,
  scopedLayerTokens: ReadonlyMap<string, string>,
): string {
  const actions = scene.actions.map((action) => `${sceneName}Action.${actionTokens.get(action)}`);
  const cameras = scene.cameras.map((camera) => `${sceneName}Camera.${cameraTokens.get(camera)}`);
  const layers = scene.layers.map(({ id }) => `${sceneType}Layer.${scopedLayerTokens.get(id)}`);
  return `${sceneType}(
        id = ${kotlinStringLiteral(scene.id)},
        cameras = listOf(${cameras.join(", ")}),
        actions = ${actions.length === 0 ? "emptyList()" : `listOf(${actions.join(", ")})`},
        layers = ${layers.length === 0 ? "emptyList()" : `listOf(${layers.join(", ")})`},
    )`;
}

function sceneTypeNames(scenes: readonly CompiledScene[], prefix: string): ReadonlyMap<string, string> {
  const nameById = new Map<string, string>();
  const idByName = new Map<string, string>();
  for (const scene of scenes) {
    const segments = scene.id.split(/[./]/u);
    const scopedSegments = segments[0]?.toLowerCase() === prefix.toLowerCase() ? segments.slice(1) : segments;
    const scenePart = kotlinIdentifier(scopedSegments.join("."));
    const name = `Generated${prefix}${scenePart.endsWith("Scene") ? scenePart : `${scenePart}Scene`}`;
    const prior = idByName.get(name);
    if (prior !== undefined) throw new Error(`scenes '${prior}' and '${scene.id}' both emit Kotlin scene type '${name}'`);
    nameById.set(scene.id, name);
    idByName.set(name, scene.id);
  }
  return nameById;
}

function layerRefKey(sceneId: string, layerId: string): string {
  return JSON.stringify([sceneId, layerId]);
}

function enumRows(values: readonly string[], owner: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const idByToken = new Map<string, string>();
  for (const value of values) {
    const token = kotlinEnumToken(value);
    const prior = idByToken.get(token);
    if (prior !== undefined && prior !== value) {
      throw new Error(`${owner} ids '${prior}' and '${value}' both emit Kotlin enum entry '${token}'`);
    }
    idByToken.set(token, value);
    result.set(value, token);
  }
  return result;
}

function unique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const valueKey = key(value);
    if (seen.has(valueKey)) return false;
    seen.add(valueKey);
    return true;
  });
}

function validateOutputDirectory(value: string): void {
  if (!value || value.startsWith("/") || value.split(/[\\/]/u).includes("..")) {
    throw new Error(`scene Kotlin output directory must be a safe relative path, got '${value}'`);
  }
}
