import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOutputManifest,
  checkOutputManifest,
  logOutputManifest,
  productJsonEmitter,
  writeOutputManifest,
  type OutputArtifact,
  type ProductEmitterPlugin,
} from "@v1d/product-spec";
import {
  emitComponentFamilyRegistryKotlin,
  emitComponentTreesKotlin,
  emitNativeLegoCatalogKotlinFiles,
  emitNativeLegoKotlin,
  emitNavigationKotlin,
  emitStatePresentationsKotlinFiles,
  kotlinIdentifier,
  projectNativeLegoDomains,
} from "@v1d/product-emit/core";
import { compileLinkProduct } from "./product.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = resolve(packageRoot, "..");
const productSpecPackagePath = resolve(packageRoot, "node_modules/@v1d/product-spec/package.json");
const generatedRoot = "link-product/generated";
const kotlinRoot = `${generatedRoot}/kotlin`;
const packageName = "io.v1d.link.generated";
const symbolPrefix = "Link";
const check = process.argv.includes("--check");

const installed = JSON.parse(await readFile(productSpecPackagePath, "utf8")) as { version?: unknown };
if (installed.version !== "0.3.52") {
  throw new Error(`Link requires @v1d/product-spec 0.3.52, found '${String(installed.version)}'`);
}

const product = compileLinkProduct();
const manifest = buildOutputManifest(product, [
  productJsonEmitter(`${generatedRoot}/link-product.json`),
  linkKotlinEmitter(),
], [generatedRoot]);

if (check) {
  const stale = await checkOutputManifest(repoRoot, manifest);
  if (stale.length > 0) throw new Error(`Generated Link product is stale:\n${stale.join("\n")}`);
} else {
  await writeOutputManifest(repoRoot, manifest);
}

console.log(logOutputManifest(manifest));

function linkKotlinEmitter(): ProductEmitterPlugin {
  return {
    id: "link-kotlin",
    emit(productIr): readonly OutputArtifact[] {
      const graph = projectNativeLegoDomains(productIr);
      const sourceSha = fingerprint(productIr);
      const options = { packageName, symbolPrefix, sourceSha } as const;
      const catalog = emitNativeLegoCatalogKotlinFiles(
        graph.domains,
        graph.aggregate,
        productIr.finiteValues,
        options,
      );
      const state = emitStatePresentationsKotlinFiles(productIr.stateAuthorities, {
        ...options,
        nativePortPackageName: "io.v1d.link.runtime",
      });
      const familyRegistry = emitComponentFamilyRegistryKotlin(productIr.componentFamilies, {
        packageName,
        productId: productIr.id,
        sourceFile: "link-product/src/product.ts",
      }, sourceSha);

      return [
        artifact("native-lego-catalog", "GeneratedLinkNativeLegoCatalog.kt", catalog.aggregate),
        ...catalog.shards.map(({ suffix, content }) =>
          artifact(`native-lego-catalog-${suffix}`, `GeneratedLinkNativeLegoCatalog${suffix}.kt`, content)),
        ...graph.domains.map((domain) => artifact(
          `native-lego-${domain.id}`,
          `GeneratedLink${kotlinIdentifier(domain.id)}Lego.kt`,
          emitNativeLegoKotlin(domain, { ...options, sourceSha: fingerprint(domain) }),
        )),
        artifact("navigation", "GeneratedLinkNavigation.kt",
          emitNavigationKotlin(productIr.navigation, { ...options, sourceSha: fingerprint(productIr.navigation) })),
        artifact("state-presentations", "GeneratedLinkStatePresentations.kt", state.aggregate),
        ...state.shards.map(({ suffix, content }) =>
          artifact(`state-presentations-${suffix}`, `GeneratedLinkStatePresentations${suffix}.kt`, content)),
        artifact("component-families", "GeneratedLinkComponentFamilies.kt", familyRegistry),
        ...productIr.componentFamilies.map(({ family }) => {
          const prefix = `Generated${kotlinIdentifier(family.id)}`;
          return artifact(
            `component-tree-${family.id}`,
            `${prefix}Components.kt`,
            emitComponentTreesKotlin(family, {
              packageName,
              productId: productIr.id,
              sourceFile: "link-product/src/product.ts",
              typePrefix: prefix,
            }, fingerprint(family)),
          );
        }),
      ];
    },
  };
}

function artifact(id: string, filename: string, content: string): OutputArtifact {
  return { id, path: `${kotlinRoot}/${filename}`, mediaType: "text/x-kotlin", content };
}

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
