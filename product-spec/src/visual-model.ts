import { frozen } from "./frozen.js";

export interface PortableRampBand {
  readonly id: string;
  readonly upTo: number;
  readonly ruleEdge: boolean;
  readonly hueDeg: number;
  readonly lightness: number;
  readonly lightnessTravel: number;
  readonly chromaMax: number;
  readonly solid?: boolean;
  readonly label: string;
  /** Tones stated instead of derived by CircleKit's tone rule (circlekit-assets circle-tone.ts). */
  readonly dim?: string;
  readonly ground?: string;
}

/**
 * A colour a product writes once, as its strong tone. Its dimmed tone, its ground and an icon disc's edge follow from
 * CircleKit's tone rule unless stated: white has no dimmed self that is not grey.
 */
export interface PortableToneColour {
  readonly id: string;
  readonly hex: string;
  readonly meaning: string;
  readonly dim?: string;
  readonly ground?: string;
}

export interface PortableRamp {
  readonly id: string;
  readonly kind: "safety-envelope" | "magnitude";
  readonly unit: string;
  /**
   * Which edge of every band is its strong end: "high", the default, when the
   * severity rises with the value, as wind does; "low" when it falls, as height.
   */
  readonly strongEdge?: "high" | "low";
  /**
   * Where each band starts along its step's travel: 0, the default, is the
   * palest tone; 0.5 keeps only the strong half, so a band never opens paler
   * than the band before it ended. Below 1.
   */
  readonly travelFrom?: number;
  readonly bands: readonly PortableRampBand[];
}

/** Product-owned semantic colour data. Chrome, typography and spacing stay in CircleKit. */
export interface PortablePaletteVariant {
  readonly id: string;
  readonly identity: Readonly<Record<string, string>>;
  readonly categories: readonly PortableToneColour[];
  readonly status: Readonly<Record<string, string>>;
  readonly ramps: readonly PortableRamp[];
}

export interface ProductPalette<Variant extends PortablePaletteVariant = PortablePaletteVariant> {
  readonly variants: readonly Variant[];
}

export type PaletteTokenRef<Variant extends PortablePaletteVariant> =
  | `identity.${Extract<keyof Variant["identity"], string>}`
  | `category.${Variant["categories"][number]["id"]}`
  | `status.${Extract<keyof Variant["status"], string>}`;

export type PortableVectorPath = Readonly<{
  kind: "fill";
  pathData: string;
  fillRule: "nonzero" | "evenodd";
}> | Readonly<{
  kind: "stroke";
  pathData: string;
  strokeWidth: number;
}>;

export interface PortableVectorAsset {
  readonly id: string;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly paths: readonly PortableVectorPath[];
  readonly layers?: readonly Readonly<{ slot: string; assetRef: string }>[];
}

/** Shared immutable geometry catalog. Product IR stores only its id/version reference. */
export interface PortableAssetCatalog {
  readonly id: string;
  readonly version: string;
  readonly icons: readonly PortableVectorAsset[];
}

export interface PortableAssetCatalogRef {
  readonly id: string;
  readonly version: string;
}

export interface ProductIconRef<
  Accent extends string = string,
  ArtifactRef extends string = string,
> {
  readonly id: string;
  readonly assetRef: string;
  /** Omitted means CircleKit's warm-white action token. */
  readonly accent?: Accent;
  readonly layers?: readonly Readonly<{ slot: string; accent: Accent }>[];
  readonly artifacts: readonly ArtifactRef[];
}

/** Independent native/plugin attestation. It is not product-authored data. */
export interface ProductIconRendererBinding {
  readonly iconRef: string;
  readonly assetRef: string;
  readonly rendererRef: string;
}

export function definePalette<const Variants extends readonly PortablePaletteVariant[]>(
  variants: Variants,
): ProductPalette<Variants[number]> {
  // A product without additional semantic pigment inherits CircleKit style.
  // Empty is data, not a fake "default" palette variant.
  if (variants.length === 0) return frozen({ variants });
  requireUnique(variants.map(({ id }) => id), "palette variant id");
  variants.forEach(validateVariant);
  const [first, ...rest] = variants;
  const shape = (variant: PortablePaletteVariant) => JSON.stringify(variant.ramps.map((ramp) => ({
    id: ramp.id, kind: ramp.kind, unit: ramp.unit,
    strongEdge: ramp.strongEdge ?? "high", travelFrom: ramp.travelFrom ?? 0,
    bands: ramp.bands.map(({ id, upTo, ruleEdge, label, hueDeg, solid }) =>
      ({ id, upTo, ruleEdge, label, hueDeg, solid: Boolean(solid) })),
  })));
  const fixed = (variant: PortablePaletteVariant) => JSON.stringify({
    identity: variant.identity, categories: variant.categories, status: variant.status,
  });
  const expectedShape = shape(first!);
  const expectedFixed = fixed(first!);
  for (const variant of rest) {
    if (shape(variant) !== expectedShape) throw new Error(`palette '${variant.id}' changes ramp structure`);
    if (fixed(variant) !== expectedFixed) throw new Error(`palette '${variant.id}' changes fixed semantic tokens`);
  }
  return frozen({ variants });
}

export function definePortableAssetCatalog<const Catalog extends PortableAssetCatalog>(
  catalog: Catalog,
): Catalog {
  requireWireId(catalog.id, "asset catalog");
  if (catalog.version.trim() === "") throw new Error("asset catalog version is empty");
  requireUnique(catalog.icons.map(({ id }) => id), "icon asset id");
  const ids = new Set(catalog.icons.map(({ id }) => id));
  for (const icon of catalog.icons) {
    requireWireId(icon.id, "icon asset");
    if (icon.viewport.width <= 0 || icon.viewport.height <= 0 || icon.paths.length === 0) {
      throw new Error(`icon asset '${icon.id}' is incomplete`);
    }
    for (const path of icon.paths) {
      if (path.pathData.trim() === "") throw new Error(`icon asset '${icon.id}' has blank path data`);
      if (path.kind === "stroke" && path.strokeWidth <= 0) {
        throw new Error(`icon asset '${icon.id}' has invalid stroke width`);
      }
    }
    for (const layer of icon.layers ?? []) {
      requireWireId(layer.slot, `layer slot in icon asset '${icon.id}'`);
      if (!ids.has(layer.assetRef)) throw new Error(`icon asset '${icon.id}' uses missing layer '${layer.assetRef}'`);
    }
  }
  return frozen(catalog);
}

export function validateProductIconRendererBindings(
  product: {
    readonly artifacts: readonly { id: string; rendererRefs: readonly string[] }[];
    readonly iconRefs: readonly ProductIconRef[];
  },
  bindings: readonly ProductIconRendererBinding[],
): void {
  const artifacts = new Map(product.artifacts.map((artifact) => [artifact.id, artifact]));
  const expected = new Map<string, string>();
  for (const icon of product.iconRefs) {
    for (const artifactRef of icon.artifacts) {
      const artifact = artifacts.get(artifactRef);
      if (artifact === undefined) throw new Error(`icon '${icon.id}' uses missing artifact '${artifactRef}'`);
      for (const rendererRef of artifact.rendererRefs) expected.set(`${icon.id}\u0000${rendererRef}`, icon.assetRef);
    }
  }
  const actual = new Map<string, string>();
  for (const binding of bindings) {
    const key = `${binding.iconRef}\u0000${binding.rendererRef}`;
    if (actual.has(key)) throw new Error(`duplicate renderer binding for icon '${binding.iconRef}'`);
    actual.set(key, binding.assetRef);
  }
  for (const [key, expectedAsset] of expected) {
    const iconRef = key.split("\u0000")[0]!;
    const actualAsset = actual.get(key);
    if (actualAsset === undefined) throw new Error(`missing renderer binding for icon '${iconRef}'`);
    if (actualAsset !== expectedAsset) throw new Error(`renderer binding for icon '${iconRef}' uses '${actualAsset}', expected '${expectedAsset}'`);
  }
  for (const key of actual.keys()) {
    if (!expected.has(key)) throw new Error(`orphan renderer binding for icon '${key.split("\u0000")[0]}'`);
  }
}

export function paletteTokenIds(palette: ProductPalette): ReadonlySet<string> {
  const variant = palette.variants[0];
  if (variant === undefined) return new Set();
  return new Set([
    ...Object.keys(variant.identity).map((id) => `identity.${id}`),
    ...variant.categories.map(({ id }) => `category.${id}`),
    ...Object.keys(variant.status).map((id) => `status.${id}`),
  ]);
}

function validateVariant(variant: PortablePaletteVariant): void {
  requireWireId(variant.id, "palette variant");
  requireUnique(variant.categories.map(({ id }) => id), `category in palette '${variant.id}'`);
  requireUnique(variant.ramps.map(({ id }) => id), `ramp in palette '${variant.id}'`);
  Object.entries(variant.identity).forEach(([id, value]) => { requireWireId(id, "identity token"); requireHex(value, id); });
  variant.categories.forEach(({ id, hex, dim, ground }) => {
    requireWireId(id, "palette category");
    [hex, dim, ground].forEach((value) => value === undefined || requireHex(value, id));
  });
  Object.entries(variant.status).forEach(([id, value]) => requireHex(value, id));
  for (const ramp of variant.ramps) {
    requireWireId(ramp.id, "palette ramp");
    if (ramp.unit.trim() === "" || ramp.bands.length === 0) throw new Error(`ramp '${ramp.id}' is incomplete`);
    if (ramp.strongEdge !== undefined && ramp.strongEdge !== "high" && ramp.strongEdge !== "low") {
      throw new Error(`ramp '${ramp.id}' has invalid strong edge '${String(ramp.strongEdge)}'`);
    }
    if (ramp.travelFrom !== undefined && !(ramp.travelFrom >= 0 && ramp.travelFrom < 1)) {
      throw new Error(`ramp '${ramp.id}' starts its bands at ${ramp.travelFrom}, outside 0 to below 1`);
    }
    requireUnique(ramp.bands.map(({ id }) => id), `band in ramp '${ramp.id}'`);
    ramp.bands.forEach((band, index) => {
      requireWireId(band.id, "palette band");
      [band.dim, band.ground].forEach((value) => value === undefined || requireHex(value, band.id));
      if (index > 0 && band.upTo <= ramp.bands[index - 1]!.upTo) throw new Error(`ramp '${ramp.id}' does not advance`);
    });
  }
}

function requireHex(value: string, owner: string): void {
  if (!/^#[0-9a-f]{6}$/u.test(value)) throw new Error(`${owner} has invalid colour '${value}'`);
}

function requireWireId(value: string, owner: string): void {
  if (!/^[a-z][a-z0-9.-]*$/u.test(value)) throw new Error(`${owner} has invalid wire id '${value}'`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}

/**
 * A flat step of a scale written as its strong tone: the OKLCH a band declares, read off [hex], with no travel, so the
 * band is that one colour (style C: "Stegen är platta", the step is the reading). A theme that retunes lightness and
 * chroma still can, since the step is stated in OKLCH.
 */
export function flatStep(hex: string): Pick<PortableRampBand, "hueDeg" | "lightness" | "lightnessTravel" | "chromaMax" | "solid"> {
  requireHex(hex, "flat step");
  const [r, g, b] = [1, 3, 5].map((at) => {
    const v = parseInt(hex.slice(at, at + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hueDeg = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { hueDeg, lightness, lightnessTravel: 0, chromaMax: Math.hypot(a, bb), solid: true };
}
