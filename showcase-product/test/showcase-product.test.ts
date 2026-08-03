import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { buildOutputManifest, productJsonEmitter } from "@v1d/product-spec";
import { showcaseKotlinEmitter } from "../src/emit-kotlin.js";
import { CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE } from "@v1d/circlekit-assets";
import { showcaseSwiftEmitter } from "../src/emit-swift.js";
import { decodeShowcaseNativeRegistry } from "../src/native-registry.js";
import {
  SHOWCASE_ARTIFACT_PROFILES,
  compileCircleKitShowcaseProduct,
} from "../src/product.js";

const root = resolve(import.meta.dirname, "../..");

async function registry() {
  return decodeShowcaseNativeRegistry(JSON.parse(
    await readFile(resolve(root, "native-registry/showcase.json"), "utf8"),
  ));
}

async function productSpecVersion(): Promise<string> {
  const raw = JSON.parse(await readFile(resolve(root, "node_modules/@v1d/product-spec/package.json"), "utf8")) as {
    version?: unknown;
  };
  assert.equal(typeof raw.version, "string");
  return raw.version as string;
}

test("one compiled ProductSpec owns Android and Apple Showcase structure", async () => {
  const product = compileCircleKitShowcaseProduct(await registry(), await productSpecVersion());
  assert.equal(product.schemaVersion, 2);
  assert.deepEqual(product.artifacts.map(({ id }) => id), SHOWCASE_ARTIFACT_PROFILES);
  assert.equal(product.showcase.sections.length, 7);
  assert.equal(product.showcase.cases.length, 15);
  assert.equal(product.componentCatalog.length, product.showcase.cases.length);
  assert.equal(product.componentFamilies.length, product.showcase.sections.length);
  assert.deepEqual(product.artifacts.map(({ id, serves }) => ({ id, serves })), [
    { id: "phone-full-ui", serves: ["compact", "wide"] },
    { id: "wear-full-ui", serves: ["round"] },
    { id: "iphone-full-ui", serves: ["compact", "wide"] },
    { id: "watchos-full-ui", serves: ["round"] },
  ]);
  for (const family of product.componentFamilies) {
    assert.deepEqual(family.family.trees.map(({ surface }) => surface), ["round", "compact", "wide"]);
  }

  const first = buildOutputManifest(product, [
    productJsonEmitter("generated/showcase-product.json"),
    showcaseKotlinEmitter("generated/GeneratedShowcaseProduct.kt"),
    showcaseSwiftEmitter("generated/GeneratedShowcaseProduct.swift", [
      { id: "apple-iphone-swiftui", surfaces: ["compact", "wide"] },
      { id: "apple-watchos-swiftui", surfaces: ["round"] },
    ], CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE),
  ], ["generated"]);
  const second = buildOutputManifest(product, [
    productJsonEmitter("generated/showcase-product.json"),
    showcaseKotlinEmitter("generated/GeneratedShowcaseProduct.kt"),
    showcaseSwiftEmitter("generated/GeneratedShowcaseProduct.swift", [
      { id: "apple-iphone-swiftui", surfaces: ["compact", "wide"] },
      { id: "apple-watchos-swiftui", surfaces: ["round"] },
    ], CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE),
  ], ["generated"]);
  assert.deepEqual(first, second);

  const swift = showcaseSwiftEmitter("generated/GeneratedShowcaseProduct.swift", [
    { id: "apple-iphone-swiftui", surfaces: ["compact", "wide"] },
    { id: "apple-watchos-swiftui", surfaces: ["round"] },
  ], CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE);
  assert.throws(() => swift.emit({
    ...product,
    artifacts: product.artifacts.filter(({ id }) => id !== "watchos-full-ui"),
  }), /apple-watchos-swiftui.*exactly one artifact, found 0/);
});

test("native component, profile and icon drift stops before emission", async () => {
  const actual = await registry();
  const version = await productSpecVersion();
  assert.throws(() => compileCircleKitShowcaseProduct({
    ...actual,
    components: actual.components.slice(1),
  }, version), /component\/native binding missing/);
  assert.throws(() => compileCircleKitShowcaseProduct({
    ...actual,
    components: actual.components.map((binding, index) => index === 0
      ? { ...binding, profiles: ["phone-full-ui"] }
      : binding),
  }, version), /profile in native component.*missing/);
  assert.throws(() => compileCircleKitShowcaseProduct({
    ...actual,
    icons: [...actual.icons, { iconId: "orphan", nativeSymbol: "RingIcons.Orphan" }],
  }, version), /icon\/native binding orphan/);
});
