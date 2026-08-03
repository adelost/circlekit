export const SHOWCASE_NATIVE_REGISTRY_SCHEMA_VERSION = 1 as const;

export interface ShowcaseNativeComponentBinding {
  readonly componentId: string;
  readonly rendererId: string;
  readonly profiles: readonly string[];
}

export interface ShowcaseNativeIconBinding {
  readonly iconId: string;
  readonly nativeSymbol: string;
}

export interface ShowcaseNativeRegistry {
  readonly stage: "native-export";
  readonly schemaVersion: typeof SHOWCASE_NATIVE_REGISTRY_SCHEMA_VERSION;
  readonly sourceFile: string;
  readonly components: readonly ShowcaseNativeComponentBinding[];
  readonly icons: readonly ShowcaseNativeIconBinding[];
}

export function decodeShowcaseNativeRegistry(raw: unknown): ShowcaseNativeRegistry {
  const root = record(raw, "native registry");
  const stage = requiredString(root.stage, "native registry stage");
  if (stage !== "native-export") throw new Error(`native registry stage '${stage}' is not compiled truth`);
  if (root.schemaVersion !== SHOWCASE_NATIVE_REGISTRY_SCHEMA_VERSION) {
    throw new Error(`native registry schema ${String(root.schemaVersion)} is unsupported`);
  }
  const components = array(root.components, "native components").map((value, index) => {
    const item = record(value, `native component ${index}`);
    return {
      componentId: requiredString(item.componentId, `native component ${index} id`),
      rendererId: requiredString(item.rendererId, `native component ${index} renderer`),
      profiles: array(item.profiles, `native component ${index} profiles`)
        .map((profile, profileIndex) => requiredString(profile, `native component ${index} profile ${profileIndex}`)),
    };
  });
  const icons = array(root.icons, "native icons").map((value, index) => {
    const item = record(value, `native icon ${index}`);
    return {
      iconId: requiredString(item.iconId, `native icon ${index} id`),
      nativeSymbol: requiredString(item.nativeSymbol, `native icon ${index} symbol`),
    };
  });
  return {
    stage: "native-export",
    schemaVersion: SHOWCASE_NATIVE_REGISTRY_SCHEMA_VERSION,
    sourceFile: requiredString(root.sourceFile, "native registry source file"),
    components,
    icons,
  };
}

function record(value: unknown, owner: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${owner} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, owner: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${owner} must be an array`);
  return value;
}

function requiredString(value: unknown, owner: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${owner} must be nonblank`);
  return value;
}
