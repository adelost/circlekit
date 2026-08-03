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
}

export interface PortableRamp {
  readonly id: string;
  readonly kind: "safety-envelope" | "magnitude";
  readonly unit: string;
  readonly bands: readonly PortableRampBand[];
}

/** Product-owned semantic colour data. Chrome, typography and spacing stay in CircleKit. */
export interface PortablePaletteVariant {
  readonly id: string;
  readonly identity: Readonly<Record<string, string>>;
  readonly categories: readonly Readonly<{ id: string; hex: string; meaning: string }>[];
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
  if (variants.length === 0) return { variants };
  requireUnique(variants.map(({ id }) => id), "palette variant id");
  variants.forEach(validateVariant);
  const [first, ...rest] = variants;
  const shape = (variant: PortablePaletteVariant) => JSON.stringify(variant.ramps.map((ramp) => ({
    id: ramp.id, kind: ramp.kind, unit: ramp.unit,
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
  return { variants };
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
  return catalog;
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
  variant.categories.forEach(({ id, hex }) => { requireWireId(id, "palette category"); requireHex(hex, id); });
  Object.entries(variant.status).forEach(([id, value]) => requireHex(value, id));
  for (const ramp of variant.ramps) {
    requireWireId(ramp.id, "palette ramp");
    if (ramp.unit.trim() === "" || ramp.bands.length === 0) throw new Error(`ramp '${ramp.id}' is incomplete`);
    requireUnique(ramp.bands.map(({ id }) => id), `band in ramp '${ramp.id}'`);
    ramp.bands.forEach((band, index) => {
      requireWireId(band.id, "palette band");
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
