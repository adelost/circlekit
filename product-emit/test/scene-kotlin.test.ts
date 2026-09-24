import assert from "node:assert/strict";
import test from "node:test";
import type { CompiledScene, ProductIr } from "@v1d/product-spec";
import { emitScenesKotlin, sceneKotlinEmitter } from "../src/core/index.js";

const scenes: readonly CompiledScene[] = [
  {
    id: "acme.map-scene",
    cameras: ["geo", "iso"],
    actions: ["layers", "home", "camera"],
    layers: [
      { id: "map-base", renderer: "tiles", style: "raster", source: { kind: "fetch", id: "MAP_TILES" }, cameras: ["geo"], toggle: { group: "ground", default: true }, pass: "raster" },
      { id: "map-points", renderer: "marker", style: "point", source: { kind: "node", id: "map.glyphs.points" }, toggle: { default: true }, pass: "upright" },
      { id: "map-base-copy", renderer: "tiles", style: "vector", source: { kind: "fetch", id: "MAP_TILES" }, cameras: ["iso"], toggle: { group: "ground", default: false }, pass: "world" },
    ],
  },
  {
    id: "acme.replay-scene",
    cameras: ["replay"],
    actions: ["time"],
    layers: [{ id: "recorded-path", renderer: "path", style: "saved", source: { kind: "store", id: "jump-recordings" }, cameras: ["replay"], pass: "world" }],
  },
];

const options = {
  packageName: "com.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "appspec/products/acme/scenes.ts",
  sourceSha: "test-sha",
  outputDirectory: "appspec/generated/acme",
  nativeScenePackage: "com.acme.ui.scene",
  sceneRuntimePackage: "com.acme.skyvwui.scene",
};

test("a generic scene emitter generates the ordered declared values against the shared scene ABI", () => {
  const kotlin = emitScenesKotlin(scenes, options);
  assert.match(kotlin, /enum class GeneratedAcmeScenesRenderer\(override val id: String\) : GeneratedSceneRenderer/u);
  assert.match(kotlin, /import com\.acme\.skyvwui\.scene\.GeneratedScenePass/u);
  assert.match(kotlin, /enum class GeneratedAcmeScenePass\(override val id: String\) : GeneratedScenePass \{\n    RASTER\("raster"\),\n    WORLD\("world"\),\n    UPRIGHT\("upright"\),/u);
  assert.match(kotlin, /import com\.acme\.skyvwui\.scene\.GeneratedSceneLayerId/u);
  assert.match(kotlin, /import com\.acme\.skyvwui\.scene\.GeneratedSceneLayerToggle/u);
  assert.match(kotlin, /enum class GeneratedAcmeSceneLayerId\(override val id: String\) : GeneratedSceneLayerId/u);
  assert.match(kotlin, /ACME_MAP_SCENE_MAP_BASE\("map-base"\)/u);
  assert.match(kotlin, /ACME_MAP_SCENE_MAP_POINTS\("map-points"\)/u);
  assert.match(kotlin, /enum class GeneratedAcmeScenesSource\(override val id: String\) : GeneratedSceneSource/u);
  assert.match(kotlin, /enum class GeneratedAcmeScenesTilesStyle\(override val id: String\) : GeneratedSceneStyle\.Tiles/u);
  assert.match(kotlin, /enum class GeneratedAcmeScenesMarkerStyle\(override val id: String\) : GeneratedSceneStyle\.Marker \{\n    POINT\("point"\),/u);
  assert.match(kotlin, /FETCH_MAP_TILES\("MAP_TILES"\)/u);
  assert.match(kotlin, /NODE_MAP_GLYPHS_POINTS\("map\.glyphs\.points"\)/u);
  assert.match(kotlin, /STORE_JUMP_RECORDINGS\("jump-recordings"\)/u);
  const firstLayer = kotlin.indexOf('GeneratedSceneLayer(id = GeneratedAcmeSceneLayerId.ACME_MAP_SCENE_MAP_BASE');
  const pointLayer = kotlin.indexOf('GeneratedSceneLayer(id = GeneratedAcmeSceneLayerId.ACME_MAP_SCENE_MAP_POINTS');
  const repeatedLayer = kotlin.indexOf('GeneratedSceneLayer(id = GeneratedAcmeSceneLayerId.ACME_MAP_SCENE_MAP_BASE_COPY');
  const replayLayer = kotlin.indexOf('GeneratedSceneLayer(id = GeneratedAcmeSceneLayerId.ACME_REPLAY_SCENE_RECORDED_PATH');
  assert.ok(firstLayer < pointLayer && pointLayer < repeatedLayer && repeatedLayer < replayLayer,
    "scene and layer declaration order is the draw order");
  assert.match(kotlin, /cameras = listOf\(GeneratedAcmeScenesCamera\.GEO, GeneratedAcmeScenesCamera\.ISO\)/u);
  assert.match(kotlin, /GeneratedSceneLayer\(id = GeneratedAcmeSceneLayerId\.ACME_MAP_SCENE_MAP_BASE, renderer = GeneratedAcmeScenesRenderer\.TILES, style = GeneratedAcmeScenesTilesStyle\.RASTER, source = GeneratedAcmeScenesSource\.FETCH_MAP_TILES, cameras = listOf\(GeneratedAcmeScenesCamera\.GEO\), toggle = GeneratedSceneLayerToggle\(group = "ground", default = true\), pass = GeneratedAcmeScenePass\.RASTER\)/u);
  assert.match(kotlin, /GeneratedSceneLayer\(id = GeneratedAcmeSceneLayerId\.ACME_MAP_SCENE_MAP_POINTS, renderer = GeneratedAcmeScenesRenderer\.MARKER, style = GeneratedAcmeScenesMarkerStyle\.POINT, source = GeneratedAcmeScenesSource\.NODE_MAP_GLYPHS_POINTS, toggle = GeneratedSceneLayerToggle\(default = true\), pass = GeneratedAcmeScenePass\.UPRIGHT\)/u);
  assert.match(kotlin, /val all: List<GeneratedScene> = listOf\(GeneratedAcmeScenes\.ACME_MAP_SCENE\.runtime, GeneratedAcmeScenes\.ACME_REPLAY_SCENE\.runtime\)/u);
});

test("each scene carries only its own layer enum and typed layer list", () => {
  const kotlin = emitScenesKotlin(scenes, options);
  assert.match(kotlin, /enum class GeneratedAcmeMapSceneLayer\(override val id: String, val value: GeneratedSceneLayer\) : GeneratedSceneLayerId/u);
  assert.match(kotlin, /enum class GeneratedAcmeReplaySceneLayer\(override val id: String, val value: GeneratedSceneLayer\) : GeneratedSceneLayerId/u);
  assert.match(kotlin, /enum class GeneratedAcmeMapSceneLayer[\s\S]*?MAP_BASE\("map-base",[\s\S]*?MAP_POINTS\("map-points",[\s\S]*?MAP_BASE_COPY\("map-base-copy",[\s\S]*?data class GeneratedAcmeMapScene\([\s\S]*?val layers: List<GeneratedAcmeMapSceneLayer>/u);
  assert.match(kotlin, /enum class GeneratedAcmeReplaySceneLayer[\s\S]*?RECORDED_PATH\("recorded-path",[\s\S]*?data class GeneratedAcmeReplayScene\([\s\S]*?val layers: List<GeneratedAcmeReplaySceneLayer>/u);
  assert.doesNotMatch(kotlin.match(/enum class GeneratedAcmeMapSceneLayer[\s\S]*?\n\}/u)?.[0] ?? "", /RECORDED_PATH/u);
  assert.doesNotMatch(kotlin.match(/enum class GeneratedAcmeReplaySceneLayer[\s\S]*?\n\}/u)?.[0] ?? "", /MAP_BASE|MAP_POINTS|MAP_BASE_COPY/u);
  assert.match(kotlin, /layers = layers\.map \{ it\.value \}/u);
});

test("scene ids that collapse to the same generated scene type are refused", () => {
  const collidingScenes = [
    { ...scenes[0]!, id: "acme.mapScene" },
    { ...scenes[1]!, id: "acme.map.scene" },
  ];
  assert.throws(
    () => emitScenesKotlin(collidingScenes, options),
    /scenes 'acme\.mapScene' and 'acme\.map\.scene' both emit Kotlin scene type 'GeneratedAcmeMapScene'/u,
  );
});

test("the ProductEmitterPlugin writes the per-product Generated<Product>Scenes file only when scenes exist", () => {
  const emitter = sceneKotlinEmitter(options);
  const product = { id: "acme", scenes } as unknown as ProductIr;
  const [artifact] = emitter.emit(product);
  assert.equal(artifact?.path, "appspec/generated/acme/GeneratedAcmeScenes.kt");
  assert.equal(artifact?.mediaType, "text/x-kotlin");
  assert.match(artifact?.content ?? "", /object GeneratedAcmeScenes/u);
  assert.deepEqual(emitter.emit({ id: "acme" } as ProductIr), []);
});

test("a product with scenes needs sceneRuntimePackage, while a scene-free product does not", () => {
  const { sceneRuntimePackage: _configuredPackage, ...withoutRuntimePackage } = options;
  const emitter = sceneKotlinEmitter(withoutRuntimePackage);
  assert.throws(() => emitter.emit({ id: "acme", scenes } as unknown as ProductIr),
    /product 'acme' declares scenes but sceneRuntimePackage is missing; set sceneRuntimePackage in the product's emit configuration/u);
  assert.deepEqual(emitter.emit({ id: "acme" } as ProductIr), []);
});
