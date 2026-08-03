import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
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
  readonly managedRoots: readonly string[];
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
  managedRoots: readonly string[],
): OutputManifest {
  requireUnique(plugins.map(({ id }) => id), "emitter plugin");
  const artifacts = plugins.flatMap((plugin) => plugin.emit(product));
  requireUnique(artifacts.map(({ id }) => id), "output artifact id");
  requireUnique(artifacts.map(({ path }) => path), "output artifact path");
  requireUnique(managedRoots, "managed output root");
  if (managedRoots.length === 0) throw new Error("output manifest has no managed root");
  managedRoots.forEach((root) => requireSafePath(root, "managed output root"));
  artifacts.forEach((artifact) => {
    requireSafePath(artifact.path, `output artifact '${artifact.id}'`);
    if (!managedRoots.some((root) => artifact.path === root || artifact.path.startsWith(`${root}/`))) {
      throw new Error(`output artifact '${artifact.id}' is outside managed roots`);
    }
  });
  return { productId: product.id, managedRoots, artifacts };
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
  const declared = new Set(manifest.artifacts.map(({ path }) => path));
  for (const artifact of manifest.artifacts) {
    const actual = await readFile(resolve(root, artifact.path), "utf8").catch(() => "");
    if (actual !== artifact.content) stale.push(artifact.path);
  }
  for (const managedRoot of manifest.managedRoots) {
    const absolute = resolve(root, managedRoot);
    for (const file of await filesUnder(absolute)) {
      const path = relative(root, file).replaceAll("\\", "/");
      if (!declared.has(path)) stale.push(path);
    }
  }
  return stale;
}

export function logOutputManifest(manifest: OutputManifest): string {
  return manifest.artifacts.map((artifact) => `${artifact.id}\t${artifact.path}`).join("\n");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

async function filesUnder(root: string): Promise<readonly string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

function requireSafePath(value: string, owner: string): void {
  if (!value || value.startsWith("/") || value.split("/").includes("..")) {
    throw new Error(`${owner} has unsafe path '${value}'`);
  }
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
