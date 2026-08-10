import type {
  PortableRamp,
  PortableRampBand,
  PortablePaletteVariant,
} from "@v1d/product-spec";

export const THEME_SCHEMA_VERSION = 1 as const;
export const SUPPORTED_NATIVE_THEME_REGISTRY_VERSION = 1 as const;

/** Native-only attestation. Portable theme declarations never carry these fields. */
export interface NativeThemeIdentityBinding {
  readonly kind: "theme-identity";
  readonly id: string;
  readonly portableThemeId: string;
  readonly nativeTheme: string;
  readonly optionLabel: string;
  readonly kotlinSymbol: string;
  readonly sourceFile: string;
}

export interface NativeThemeRegistrySnapshot {
  readonly stage: "fixture" | "native-export";
  readonly themeSchemaVersion: number;
  readonly registryVersion: number;
  readonly circleKitVersion: string;
  readonly sourceSha: string;
  readonly bindings: readonly NativeThemeIdentityBinding[];
}

export interface CompiledTheme extends PortablePaletteVariant {
  readonly native: NativeThemeIdentityBinding;
}

export interface ThemeCatalogIr {
  readonly kind: "theme-catalog-ir";
  readonly themeSchemaVersion: number;
  readonly nativeRegistryVersion: number;
  readonly registrySourceSha: string;
  readonly themes: readonly CompiledTheme[];
}

export type Ramp = PortableRamp;
export type RampBand = PortableRampBand;
export type ThemeSpec = PortablePaletteVariant;

/** How far down the chroma range a band starts. 2.4x travel to its high end. */
export const CHROMA_FLOOR_RATIO = 0.42;

/** Stops emitted per band. Enough to read a slide, few enough to stay data. */
export const STOPS_PER_BAND = 5;
