import { registryDiagnostic } from "./diagnostics.js";
import type { Diagnostic } from "./model.js";
import type {
  NativeThemeIdentityBinding,
  NativeThemeRegistrySnapshot,
} from "./theme-model.js";

export interface ThemeRegistryDecodeResult {
  readonly registry: NativeThemeRegistrySnapshot | null;
  readonly diagnostics: readonly Diagnostic[];
}

/** Strict authoring-time decoder. The registry is never packaged in the app. */
export function decodeThemeRegistry(input: unknown): ThemeRegistryDecodeResult {
  const diagnostics: Diagnostic[] = [];
  if (!isRecord(input)) return failed("theme.registry.invalid-shape", "theme registry root must be an object");

  const stage = stringField(input, "stage", diagnostics, "<registry>");
  const themeSchemaVersion = numberField(input, "themeSchemaVersion", diagnostics, "<registry>");
  const registryVersion = numberField(input, "registryVersion", diagnostics, "<registry>");
  const circleKitVersion = stringField(input, "circleKitVersion", diagnostics, "<registry>");
  const sourceSha = stringField(input, "sourceSha", diagnostics, "<registry>");
  if (stage !== null && stage !== "fixture" && stage !== "native-export") {
    diagnostics.push(registryDiagnostic("theme.registry.invalid-stage", "<registry>", `unknown registry stage '${stage}'`));
  }
  const rawBindings = input.bindings;
  if (!Array.isArray(rawBindings)) {
    diagnostics.push(registryDiagnostic("theme.registry.invalid-bindings", "<registry>", "bindings must be an array"));
  }
  const bindings = Array.isArray(rawBindings)
    ? rawBindings.flatMap((binding, index) => {
        const decoded = decodeBinding(binding, index, diagnostics);
        return decoded === null ? [] : [decoded];
      })
    : [];

  if (
    diagnostics.length > 0
    || (stage !== "fixture" && stage !== "native-export")
    || themeSchemaVersion === null
    || registryVersion === null
    || circleKitVersion === null
    || sourceSha === null
  ) return { registry: null, diagnostics };

  return {
    registry: { stage, themeSchemaVersion, registryVersion, circleKitVersion, sourceSha, bindings },
    diagnostics,
  };
}

function decodeBinding(input: unknown, index: number, diagnostics: Diagnostic[]): NativeThemeIdentityBinding | null {
  const at = `bindings[${index}]`;
  if (!isRecord(input)) {
    diagnostics.push(registryDiagnostic("theme.registry.invalid-binding", at, "binding must be an object"));
    return null;
  }
  const kind = stringField(input, "kind", diagnostics, at);
  const id = stringField(input, "id", diagnostics, at);
  const portableThemeId = stringField(input, "portableThemeId", diagnostics, id ?? at);
  const nativeTheme = stringField(input, "nativeTheme", diagnostics, id ?? at);
  const optionLabel = stringField(input, "optionLabel", diagnostics, id ?? at);
  const kotlinSymbol = stringField(input, "kotlinSymbol", diagnostics, id ?? at);
  const sourceFile = stringField(input, "sourceFile", diagnostics, id ?? at);
  if (kind !== null && kind !== "theme-identity") {
    diagnostics.push(registryDiagnostic("theme.registry.invalid-kind", id ?? at, `unknown binding kind '${kind}'`));
  }
  if (kind !== "theme-identity" || id === null || portableThemeId === null || nativeTheme === null || optionLabel === null || kotlinSymbol === null || sourceFile === null) return null;
  if (!kotlinSymbol.endsWith(`.${nativeTheme}`)) {
    diagnostics.push(registryDiagnostic(
      "theme.registry.identity-symbol-mismatch",
      id,
      `kotlinSymbol '${kotlinSymbol}' does not identify native theme '${nativeTheme}'`,
    ));
    return null;
  }
  return { kind, id, portableThemeId, nativeTheme, optionLabel, kotlinSymbol, sourceFile };
}

function stringField(input: Record<string, unknown>, field: string, diagnostics: Diagnostic[], id: string): string | null {
  const value = input[field];
  if (typeof value === "string" && value.length > 0) return value;
  diagnostics.push(registryDiagnostic("theme.registry.invalid-field", id, `${field} must be a non-empty string`));
  return null;
}

function numberField(input: Record<string, unknown>, field: string, diagnostics: Diagnostic[], id: string): number | null {
  const value = input[field];
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  diagnostics.push(registryDiagnostic("theme.registry.invalid-field", id, `${field} must be a non-negative integer`));
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failed(rule: string, message: string): ThemeRegistryDecodeResult {
  return { registry: null, diagnostics: [registryDiagnostic(rule, "<registry>", message)] };
}
