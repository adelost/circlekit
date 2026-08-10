import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeNativeBindingManifest,
  buildOutputManifest,
  checkOutputManifest,
  logOutputManifest,
  productJsonEmitter,
  writeOutputManifest,
} from "@v1d/product-spec";
import { CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE } from "@v1d/circlekit-assets";
import { showcaseKotlinEmitter } from "./emit-kotlin.js";
import { showcaseSwiftEmitter } from "./emit-swift.js";
import { showcaseGarminEmitter } from "./emit-monkeyc.js";
import {
  compileCircleKitShowcaseProduct,
  requireCircleKitShowcaseNativeConformance,
} from "./product.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(packageRoot, "..");
const androidRegistryPath = resolve(packageRoot, "native-registry/showcase.json");
const productSpecPackagePath = resolve(packageRoot, "node_modules/@v1d/product-spec/package.json");
const jsonPath = "showcase-product/generated/showcase-product.json";
const kotlinPath = "showcase-catalog/src/main/java/io/v1d/circlekit/showcase/catalog/generated/GeneratedShowcaseProduct.kt";
const swiftPath = "showcase-iphone/Sources/Generated/GeneratedShowcaseProduct.swift";
const garminPath = "showcase-garmin/source/GeneratedCircleKitShowcase.mc";
const appleRegistryPath = "showcase-product/native-registry/apple.json";
const garminRegistryPath = "showcase-product/native-registry/garmin.json";
const check = process.argv.includes("--check");

const androidRegistry = decodeNativeBindingManifest(JSON.parse(await readFile(androidRegistryPath, "utf8")));
const productSpecPackage = JSON.parse(await readFile(productSpecPackagePath, "utf8")) as { version?: unknown };
if (typeof productSpecPackage.version !== "string") throw new Error("Installed @v1d/product-spec has no version");
const product = compileCircleKitShowcaseProduct(productSpecPackage.version);
const manifest = buildOutputManifest(
  product,
  [
    productJsonEmitter(jsonPath),
    showcaseKotlinEmitter(kotlinPath),
    showcaseSwiftEmitter(swiftPath, appleRegistryPath, [
      { id: "apple-iphone-swiftui", surfaces: ["compact", "wide"] },
      { id: "apple-watchos-swiftui", surfaces: ["round"] },
    ], CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE),
    showcaseGarminEmitter(garminPath, garminRegistryPath, CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE),
  ],
  [jsonPath, kotlinPath, swiftPath, garminPath, appleRegistryPath, garminRegistryPath],
);
const emittedRegistry = (id: string) => {
  const output = manifest.artifacts.find((artifact) => artifact.id === id);
  if (output === undefined) throw new Error(`Showcase emitter omitted native manifest '${id}'`);
  return decodeNativeBindingManifest(JSON.parse(output.content));
};
requireCircleKitShowcaseNativeConformance(product, androidRegistry, [
  androidRegistry,
  emittedRegistry("showcase-swiftui-native-manifest"),
  emittedRegistry("showcase-garmin-native-manifest"),
]);

if (check) {
  const stale = await checkOutputManifest(repoRoot, manifest);
  if (stale.length > 0) {
    throw new Error(`Generated Showcase product is stale:\n${stale.join("\n")}`);
  }
} else {
  await writeOutputManifest(repoRoot, manifest);
}

console.log(logOutputManifest(manifest));
