import type { Diagnostic } from "./model.js";
import { definePalette, type PortablePaletteVariant } from "@v1d/product-spec";
import {
  SUPPORTED_NATIVE_THEME_REGISTRY_VERSION,
  THEME_SCHEMA_VERSION,
  type NativeThemeRegistrySnapshot,
  type Ramp,
  type RampBand,
  type ThemeCatalogIr,
} from "./theme-model.js";

export interface CompileThemesInput {
  readonly declarations: readonly PortablePaletteVariant[];
  readonly declarationSourceFile: string;
  readonly registry: NativeThemeRegistrySnapshot;
  readonly expectedCircleKitVersion: string;
  readonly mode: "fixture" | "production";
}

export interface CompileThemesResult {
  readonly ir: ThemeCatalogIr | null;
  readonly diagnostics: readonly Diagnostic[];
}

export function compileThemes(input: CompileThemesInput): CompileThemesResult {
  const diagnostics: Diagnostic[] = [];
  if (input.registry.themeSchemaVersion !== THEME_SCHEMA_VERSION) {
    issue(diagnostics, "theme.registry.schema-version", "<registry>", "<native-registry>", `expected schema ${THEME_SCHEMA_VERSION}, got ${input.registry.themeSchemaVersion}`);
  }
  if (input.registry.registryVersion !== SUPPORTED_NATIVE_THEME_REGISTRY_VERSION) {
    issue(diagnostics, "theme.registry.version", "<registry>", "<native-registry>", `expected registry ${SUPPORTED_NATIVE_THEME_REGISTRY_VERSION}, got ${input.registry.registryVersion}`);
  }
  if (input.registry.circleKitVersion !== input.expectedCircleKitVersion) {
    issue(diagnostics, "theme.registry.circlekit-pin", "<registry>", "<native-registry>", `registry pins ${input.registry.circleKitVersion}, build pins ${input.expectedCircleKitVersion}`);
  }
  if (input.mode === "production" && input.registry.stage !== "native-export") {
    issue(diagnostics, "theme.registry.production-stage", "<registry>", "<native-registry>", "production requires a compiled native export");
  }

  try {
    definePalette(input.declarations);
  } catch (error) {
    issue(diagnostics, "theme.declaration.invariant", "<catalog>", input.declarationSourceFile, String(error));
  }

  for (const declaration of input.declarations) {
    for (const ramp of declaration.ramps) {
      for (const band of envelopeHueTrespassers(ramp)) {
        issue(
          diagnostics,
          "theme.declaration.ramp-envelope-hue",
          declaration.id,
          input.declarationSourceFile,
          `ramp ${ramp.id}: band ${band.id} takes the envelope hue but is ${ramp.kind}`,
        );
      }
    }
  }

  const bindingById = new Map<string, NativeThemeRegistrySnapshot["bindings"][number]>();
  for (const binding of input.registry.bindings) {
    if (bindingById.has(binding.id)) {
      issue(diagnostics, "theme.registry.duplicate-id", binding.id, binding.sourceFile, `duplicate native binding '${binding.id}'`);
    } else bindingById.set(binding.id, binding);
  }

  const consumed = new Set<string>();
  const portableThemes = new Set<string>();
  const compiled: NonNullable<ThemeCatalogIr["themes"]>[number][] = [];
  for (const declaration of input.declarations) {
    if (portableThemes.has(declaration.id)) {
      issue(diagnostics, "theme.declaration.duplicate-identity", declaration.id, input.declarationSourceFile, `portable theme '${declaration.id}' is declared more than once`);
      continue;
    }
    portableThemes.add(declaration.id);
    const binding = input.registry.bindings.find(({ portableThemeId }) => portableThemeId === declaration.id);
    if (binding === undefined) {
      issue(diagnostics, "theme.declaration.missing-native-binding", declaration.id, input.declarationSourceFile, `native binding for portable theme '${declaration.id}' does not exist`);
      continue;
    }
    consumed.add(binding.id);
    compiled.push({ ...declaration, native: binding });
  }
  for (const binding of input.registry.bindings) {
    if (!consumed.has(binding.id)) {
      issue(diagnostics, "theme.registry.orphan-identity", binding.id, binding.sourceFile, `native theme '${binding.nativeTheme}' has no ThemeSpec declaration`);
    }
  }
  if (diagnostics.length > 0) return { ir: null, diagnostics };
  return {
    ir: {
      kind: "theme-catalog-ir",
      themeSchemaVersion: THEME_SCHEMA_VERSION,
      nativeRegistryVersion: input.registry.registryVersion,
      registrySourceSha: input.registry.sourceSha,
      themes: compiled,
    },
    diagnostics,
  };
}

/**
 * The envelope violet states "past a declared limit". A magnitude ramp that
 * borrowed it would call an intentional head-down forbidden, so the hue is
 * reserved, and a property of the DECLARATION is answered where declarations are
 * compiled rather than by whoever renders one later.
 *
 * Band ORDER is deliberately not checked here: definePalette refuses to build a
 * palette whose bands do not climb, so a declaration that reached this function
 * has already passed that rule twice.
 */
function envelopeHueTrespassers(ramp: Ramp): readonly RampBand[] {
  if (ramp.kind === "safety-envelope") return [];
  return ramp.bands.filter((band) => band.hueDeg > 280 && band.hueDeg < 330);
}

function issue(diagnostics: Diagnostic[], rule: string, id: string, sourceFile: string, message: string): void {
  diagnostics.push({ rule, declarationKind: "theme", declarationId: id, sourceFile, target: "registry", message });
}
