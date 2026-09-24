import assert from "node:assert/strict";
import test from "node:test";
import type { CompiledScene, ProductIr } from "@v1d/product-spec";
import { emitScenesKotlin, sceneKotlinEmitter } from "../src/core/index.js";

const scenes: readonly CompiledScene[] = [
  {
    id: "acme.map-scene",
    camera: "geo",
    actions: ["layers", "home"],
    layers: [
      { id: "map-base", renderer: "tiles", style: "raster", source: { kind: "fetch", id: "MAP_TILES" } },
      { id: "map-points", renderer: "marker", style: "point", source: { kind: "node", id: "map.glyphs.points" } },
      { id: "map-base-copy", renderer: "tiles", style: "vector", source: { kind: "fetch", id: "MAP_TILES" } },
    ],
  },
  {
    id: "acme.replay-scene",
    camera: "replay",
    actions: ["time"],
    layers: [{ id: "recorded-path", renderer: "path", style: "saved", source: { kind: "store", id: "jump-recordings" } }],
  },
];

const options = {
  packageName: "com.acme.generated",
  symbolPrefix: "Acme",
  sourceFile: "appspec/products/acme/scenes.ts",
  sourceSha: "test-sha",
  outputDirectory: "appspec/generated/acme",
  nativeScenePackage: "com.acme.ui.scene",
  sceneLayerIdPackage: "com.acme.skyvwui.scene",
};

test("a generic scene emitter generates the ordered declared values against the shared scene ABI", () => {
  const kotlin = emitScenesKotlin(scenes, options);
  assert.match(kotlin, /enum class GeneratedAcmeScenesRenderer\(override val id: String\) : GeneratedSceneRenderer/u);
  assert.match(kotlin, /import com\.acme\.skyvwui\.scene\.GeneratedSceneLayerId/u);
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
  assert.match(kotlin, /GeneratedSceneLayer\(id = GeneratedAcmeSceneLayerId\.ACME_MAP_SCENE_MAP_BASE, renderer = GeneratedAcmeScenesRenderer\.TILES, style = GeneratedAcmeScenesTilesStyle\.RASTER, source = GeneratedAcmeScenesSource\.FETCH_MAP_TILES\)/u);
  assert.match(kotlin, /GeneratedSceneLayer\(id = GeneratedAcmeSceneLayerId\.ACME_MAP_SCENE_MAP_BASE_COPY, renderer = GeneratedAcmeScenesRenderer\.TILES, style = GeneratedAcmeScenesTilesStyle\.VECTOR, source = GeneratedAcmeScenesSource\.FETCH_MAP_TILES\)/u);
  assert.match(kotlin, /val all: List<GeneratedScene> = listOf\(GeneratedAcmeScenes\.ACME_MAP_SCENE, GeneratedAcmeScenes\.ACME_REPLAY_SCENE\)/u);
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
