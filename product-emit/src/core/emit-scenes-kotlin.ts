import {
  RENDERER_STYLES,
  type CompiledScene,
  type ProductEmitterPlugin,
  type ProductIr,
  type RendererKind,
} from "@v1d/product-spec";
import { kotlinEnumToken, kotlinIdentifier, kotlinStringLiteral } from "./kotlin-syntax.js";
import type { SourcedKotlinEmissionOptions } from "./emission-options.js";

export interface SceneKotlinEmissionOptions extends SourcedKotlinEmissionOptions {
  readonly nativeScenePackage: string;
  readonly outputDirectory: string;
}

/** Generates only the declared scene data. Rendering and source providers remain platform-owned. */
export function emitScenesKotlin(
  scenes: readonly CompiledScene[],
  options: SceneKotlinEmissionOptions,
): string {
  if (scenes.length === 0) throw new Error("scene Kotlin emission has no scenes");
  const prefix = kotlinIdentifier(options.symbolPrefix);
  const sceneName = `Generated${prefix}Scenes`;
  const layers = scenes.flatMap((scene) => scene.layers);
  const renderers = unique(layers.map(({ renderer }) => renderer));
  const sources = uniqueBy(layers.map(({ source }) => source), ({ kind, id }) => `${kind}:${id}`);
  const cameras = unique(scenes.map(({ camera }) => camera));
  const actions = unique(scenes.flatMap(({ actions }) => actions));

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
  const styleTokens = new Map<RendererKind, ReadonlyMap<string, string>>();
  for (const [renderer, values] of styleValues) {
    styleTokens.set(renderer, enumRows(values, `${renderer} style in ${sceneName}`));
  }
  const sourceTokenByRef = new Map(sources.map(({ kind, id }) => [`${kind}:${id}`, sourceTokens.get(`${kind}_${id}`)!] as const));

  return `// GENERATED FILE. DO NOT EDIT.
// GENERATED FROM ${options.sourceFile}
// Product declaration SHA-256: ${options.sourceSha}
package ${options.packageName}

import ${options.nativeScenePackage}.GeneratedScene
import ${options.nativeScenePackage}.GeneratedSceneAction
import ${options.nativeScenePackage}.GeneratedSceneCamera
import ${options.nativeScenePackage}.GeneratedSceneLayer
import ${options.nativeScenePackage}.GeneratedSceneRenderer
import ${options.nativeScenePackage}.GeneratedSceneSource
import ${options.nativeScenePackage}.GeneratedSceneStyle

${emitIdEnum(`${sceneName}Renderer`, "GeneratedSceneRenderer", renderers, rendererTokens)}
${emitIdEnum(`${sceneName}Source`, "GeneratedSceneSource", sourceEnumRows, sourceTokens)}
${emitIdEnum(`${sceneName}Camera`, "GeneratedSceneCamera", cameras, cameraTokens)}
${actions.length === 0 ? "" : emitIdEnum(`${sceneName}Action`, "GeneratedSceneAction", actions, actionTokens)}
${[...styleValues].map(([renderer, values]) => emitStyleEnum(sceneName, renderer, values, styleTokens.get(renderer)!)).join("\n\n")}
object ${sceneName} {
${scenes.map((scene) => emitScene(scene, sceneName, sceneTokens, rendererTokens, sourceTokenByRef, cameraTokens, actionTokens, styleTokens)).join("\n\n")}

    val all: List<GeneratedScene> = listOf(${scenes.map(({ id }) => `${sceneName}.${sceneTokens.get(id)}`).join(", ")})
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
      return [{
        id: `scene-kotlin:${product.id}`,
        path,
        mediaType: "text/x-kotlin",
        content: emitScenesKotlin(product.scenes, options),
      }];
    },
  };
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

function emitScene(
  scene: CompiledScene,
  sceneName: string,
  sceneTokens: ReadonlyMap<string, string>,
  rendererTokens: ReadonlyMap<string, string>,
  sourceTokens: ReadonlyMap<string, string>,
  cameraTokens: ReadonlyMap<string, string>,
  actionTokens: ReadonlyMap<string, string>,
  styleTokens: ReadonlyMap<RendererKind, ReadonlyMap<string, string>>,
): string {
  const layers = scene.layers.map((layer) => {
    const renderer = rendererTokens.get(layer.renderer);
    const style = styleTokens.get(layer.renderer)?.get(layer.style);
    const source = sourceTokens.get(`${layer.source.kind}:${layer.source.id}`);
    if (!renderer || !style || !source) throw new Error(`scene '${scene.id}' layer '${layer.id}' has an incomplete generated enum mapping`);
    return `GeneratedSceneLayer(id = ${kotlinStringLiteral(layer.id)}, renderer = ${sceneName}Renderer.${renderer}, style = ${sceneName}${kotlinIdentifier(layer.renderer)}Style.${style}, source = ${sceneName}Source.${source})`;
  });
  const actions = scene.actions.map((action) => `${sceneName}Action.${actionTokens.get(action)}`);
  return `    val ${sceneTokens.get(scene.id)}: GeneratedScene = GeneratedScene(
        id = ${kotlinStringLiteral(scene.id)},
        camera = ${sceneName}Camera.${cameraTokens.get(scene.camera)},
        actions = ${actions.length === 0 ? "emptyList()" : `listOf(${actions.join(", ")})`},
        layers = ${layers.length === 0 ? "emptyList()" : `listOf(\n${layers.map((row) => `            ${row},`).join("\n")}\n        )`},
    )`;
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
