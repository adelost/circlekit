import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

type DependencySection = (typeof DEPENDENCY_SECTIONS)[number];

interface PackageManifest {
  readonly [section: string]: unknown;
}

interface PackageLock {
  readonly packages?: Readonly<Record<string, LockPackage>>;
}

interface LockPackage {
  readonly version?: string;
  readonly resolved?: string;
  readonly integrity?: string;
  readonly [section: string]: unknown;
}

export interface V1dPinCheckResult {
  readonly dependencies: readonly string[];
  readonly errors: readonly string[];
}

/** Check every direct @v1d dependency against its immutable URL and npm lock proof. */
export function checkV1dPins(manifest: PackageManifest, lock: PackageLock): V1dPinCheckResult {
  const declared = new Map<string, { readonly section: DependencySection; readonly spec: string }>();
  const errors: string[] = [];
  for (const section of DEPENDENCY_SECTIONS) {
    const dependencies = manifest[section];
    if (dependencies === undefined) continue;
    if (!isRecord(dependencies)) {
      errors.push(`package.json ${section} must be an object`);
      continue;
    }
    for (const [name, rawSpec] of Object.entries(dependencies)) {
      if (!name.startsWith("@v1d/")) continue;
      if (typeof rawSpec !== "string") {
        errors.push(`${name} in ${section} must be a string`);
        continue;
      }
      const previous = declared.get(name);
      if (previous !== undefined && previous.spec !== rawSpec) {
        errors.push(`${name} has different pins in ${previous.section} and ${section}`);
        continue;
      }
      declared.set(name, { section, spec: rawSpec });
    }
  }

  const packages = lock.packages;
  if (!isRecord(packages)) {
    if (declared.size > 0) errors.push("package-lock.json has no packages registry");
    return { dependencies: [...declared.keys()].sort(), errors };
  }
  const root = isRecord(packages[""]) ? packages[""] as LockPackage : undefined;
  for (const [name, declaration] of declared) {
    const immutable = parseImmutableV1dUrl(name, declaration.spec);
    if (immutable.error !== undefined) errors.push(`${name}: ${immutable.error}`);
    const rootSection = root?.[declaration.section];
    const lockedRootSpec = isRecord(rootSection) ? rootSection[name] : undefined;
    if (lockedRootSpec !== declaration.spec) {
      errors.push(`${name}: package-lock root ${declaration.section} does not contain the exact package.json pin`);
    }
    const locked = packages[`node_modules/${name}`];
    if (!isRecord(locked)) {
      errors.push(`${name}: package-lock has no installed package entry`);
      continue;
    }
    if (locked.resolved !== declaration.spec) {
      errors.push(`${name}: package-lock resolved URL does not equal the package.json pin`);
    }
    if (immutable.version !== undefined && locked.version !== immutable.version) {
      errors.push(`${name}: package-lock version '${String(locked.version)}' does not match '${immutable.version}'`);
    }
    if (typeof locked.integrity !== "string" || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(locked.integrity)) {
      errors.push(`${name}: package-lock is missing sha512 integrity`);
    }
  }
  return { dependencies: [...declared.keys()].sort(), errors };
}

export async function checkV1dPinsAt(packageRoot: string): Promise<V1dPinCheckResult> {
  const [manifest, lock] = await Promise.all([
    readJson(resolve(packageRoot, "package.json")),
    readJson(resolve(packageRoot, "package-lock.json")),
  ]);
  return checkV1dPins(manifest, lock);
}

function parseImmutableV1dUrl(
  name: string,
  spec: string,
): { readonly version?: string; readonly error?: string } {
  let url: URL;
  try {
    url = new URL(spec);
  } catch {
    return { error: `pin '${spec}' is not an immutable HTTPS tarball URL` };
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== ""
      || url.search !== "" || url.hash !== "") {
    return { error: `pin '${spec}' is not an immutable HTTPS tarball URL` };
  }
  const slug = name.slice("@v1d/".length);
  const segments = url.pathname.split("/").filter(Boolean);
  const file = segments.at(-1);
  const version = segments.at(-2);
  const expectedFile = version === undefined ? undefined : `v1d-${slug}-${version}.tgz`;
  const prefix = segments.slice(-5, -2);
  if (version === undefined || !/^\d+\.\d+\.\d+$/u.test(version)
      || file !== expectedFile || prefix.join("/") !== `npm/v1d/${slug}`) {
    return {
      error: `pin '${spec}' must end in /npm/v1d/${slug}/X.Y.Z/v1d-${slug}-X.Y.Z.tgz`,
    };
  }
  return { version };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readJson(path: string): Promise<PackageManifest & PackageLock> {
  return JSON.parse(await readFile(path, "utf8")) as PackageManifest & PackageLock;
}
