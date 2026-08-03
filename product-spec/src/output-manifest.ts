import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ProductIr } from "./product-model.js";

export interface OutputArtifact {
  readonly id: string;
  readonly path: string;
  readonly mediaType: string;
  readonly content: string;
}

export interface ProductEmitterPlugin {
  readonly id: string;
  emit(product: ProductIr): readonly OutputArtifact[];
}

export interface OutputManifest {
  readonly productId: string;
  readonly artifacts: readonly OutputArtifact[];
}

export function productJsonEmitter(path: string): ProductEmitterPlugin {
  return {
    id: "product-json",
    emit: (product) => [{
      id: "product-json",
      path,
      mediaType: "application/json",
      content: `${canonicalJson(product)}\n`,
    }],
  };
}

export function buildOutputManifest(
  product: ProductIr,
  plugins: readonly ProductEmitterPlugin[],
): OutputManifest {
  requireUnique(plugins.map(({ id }) => id), "emitter plugin");
  const artifacts = plugins.flatMap((plugin) => plugin.emit(product));
  requireUnique(artifacts.map(({ id }) => id), "output artifact id");
  requireUnique(artifacts.map(({ path }) => path), "output artifact path");
  artifacts.forEach((artifact) => {
    if (!artifact.path || artifact.path.startsWith("/") || artifact.path.includes("..")) {
      throw new Error(`output artifact '${artifact.id}' has unsafe path '${artifact.path}'`);
    }
  });
  return { productId: product.id, artifacts };
}

export async function writeOutputManifest(root: string, manifest: OutputManifest): Promise<void> {
  for (const artifact of manifest.artifacts) {
    const file = resolve(root, artifact.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, artifact.content, "utf8");
  }
}

export async function checkOutputManifest(root: string, manifest: OutputManifest): Promise<readonly string[]> {
  const stale: string[] = [];
  for (const artifact of manifest.artifacts) {
    const actual = await readFile(resolve(root, artifact.path), "utf8").catch(() => "");
    if (actual !== artifact.content) stale.push(artifact.path);
  }
  return stale;
}

export function logOutputManifest(manifest: OutputManifest): string {
  return manifest.artifacts.map((artifact) => `${artifact.id}\t${artifact.path}`).join("\n");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortJson(item)]));
  }
  return value;
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
