import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOutputManifest,
  checkOutputManifest,
  logOutputManifest,
  productJsonEmitter,
  writeOutputManifest,
} from "@v1d/product-spec";
import { CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE } from "@v1d/circlekit-assets";
import { showcaseKotlinEmitter } from "./emit-kotlin.js";
import { showcaseSwiftEmitter } from "./emit-swift.js";
import { decodeShowcaseNativeRegistry } from "./native-registry.js";
import { compileCircleKitShowcaseProduct } from "./product.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(packageRoot, "..");
const registryPath = resolve(packageRoot, "native-registry/showcase.json");
const productSpecPackagePath = resolve(packageRoot, "node_modules/@v1d/product-spec/package.json");
const jsonPath = "showcase-product/generated/showcase-product.json";
const kotlinPath = "showcase-catalog/src/main/java/io/v1d/circlekit/showcase/catalog/generated/GeneratedShowcaseProduct.kt";
const swiftPath = "showcase-iphone/Sources/Generated/GeneratedShowcaseProduct.swift";
const check = process.argv.includes("--check");

const registry = decodeShowcaseNativeRegistry(JSON.parse(await readFile(registryPath, "utf8")));
const productSpecPackage = JSON.parse(await readFile(productSpecPackagePath, "utf8")) as { version?: unknown };
if (typeof productSpecPackage.version !== "string") throw new Error("Installed @v1d/product-spec has no version");
const product = compileCircleKitShowcaseProduct(registry, productSpecPackage.version);
const manifest = buildOutputManifest(
  product,
  [
    productJsonEmitter(jsonPath),
    showcaseKotlinEmitter(kotlinPath),
    showcaseSwiftEmitter(swiftPath, [
      { id: "apple-iphone-swiftui", surfaces: ["compact", "wide"] },
      { id: "apple-watchos-swiftui", surfaces: ["round"] },
    ], CIRCLEKIT_ASSET_CATALOG, CIRCLEKIT_STYLE),
  ],
  [jsonPath, kotlinPath, swiftPath],
);

if (check) {
  const stale = await checkOutputManifest(repoRoot, manifest);
  if (stale.length > 0) {
    throw new Error(`Generated Showcase product is stale:\n${stale.join("\n")}`);
  }
} else {
  await writeOutputManifest(repoRoot, manifest);
}

console.log(logOutputManifest(manifest));
