export type PortableRampKind = "safety-envelope" | "magnitude";

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
  readonly kind: PortableRampKind;
  readonly unit: string;
  readonly bands: readonly PortableRampBand[];
}

export interface PortableThemeCategory {
  readonly id: string;
  readonly hex: string;
  readonly meaning: string;
}

export interface PortableThemeSpec {
  readonly id: string;
  readonly chrome: Readonly<{
    surface: string;
    action: string;
    actionMuted: string;
  }>;
  readonly neutrals: Readonly<Record<string, string>>;
  readonly categories: readonly PortableThemeCategory[];
  readonly status: Readonly<Record<"ok" | "caution" | "danger", string>>;
  readonly ramps: readonly PortableRamp[];
}

export type PortableVectorPath = Readonly<{
  kind: "fill";
  pathData: string;
  fillRule: "nonzero" | "evenodd";
}> | Readonly<{
  kind: "stroke";
  pathData: string;
  strokeWidth: number;
}>;

export interface PortableVectorLayer {
  readonly assetRef: string;
  readonly accent: string;
}

export interface PortableIconAsset {
  readonly id: string;
  readonly accent: string;
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly paths: readonly PortableVectorPath[];
  readonly layers?: readonly PortableVectorLayer[];
}

export interface ProductVisuals {
  readonly themes: readonly PortableThemeSpec[];
  readonly icons: readonly PortableIconAsset[];
}

export function defineThemeCatalog<const Themes extends readonly PortableThemeSpec[]>(
  themes: Themes,
): Themes {
  if (themes.length === 0) throw new Error("theme catalog is empty");
  requireUnique(themes.map(({ id }) => id), "theme id");
  themes.forEach(validateTheme);
  const [first, ...rest] = themes;
  const shape = (theme: PortableThemeSpec) => JSON.stringify(theme.ramps.map((ramp) => ({
    id: ramp.id,
    kind: ramp.kind,
    unit: ramp.unit,
    bands: ramp.bands.map((band) => ({
      id: band.id,
      upTo: band.upTo,
      ruleEdge: band.ruleEdge,
      label: band.label,
      hueDeg: band.hueDeg,
      solid: Boolean(band.solid),
    })),
  })));
  const fixed = (theme: PortableThemeSpec) => JSON.stringify({
    chrome: theme.chrome,
    neutrals: theme.neutrals,
    categories: theme.categories,
    status: theme.status,
  });
  const expectedShape = shape(first!);
  const expectedFixed = fixed(first!);
  for (const theme of rest) {
    if (shape(theme) !== expectedShape) {
      throw new Error(`theme '${theme.id}' changes ramp structure`);
    }
    if (fixed(theme) !== expectedFixed) {
      throw new Error(`theme '${theme.id}' changes fixed visual channels`);
    }
  }
  return themes;
}

export function definePortableIconCatalog<const Icons extends readonly PortableIconAsset[]>(
  icons: Icons,
): Icons {
  if (icons.length === 0) throw new Error("icon catalog is empty");
  requireUnique(icons.map(({ id }) => id), "icon id");
  const ids = new Set(icons.map(({ id }) => id));
  for (const icon of icons) {
    requireWireId(icon.id, "icon");
    requireWireId(icon.accent, `icon '${icon.id}' accent`);
    if (icon.viewport.width <= 0 || icon.viewport.height <= 0) {
      throw new Error(`icon '${icon.id}' has an invalid viewport`);
    }
    if (icon.paths.length === 0) throw new Error(`icon '${icon.id}' has no path data`);
    for (const path of icon.paths) {
      if (path.pathData.trim() === "") throw new Error(`icon '${icon.id}' has blank path data`);
      if (path.kind === "stroke" && path.strokeWidth <= 0) {
        throw new Error(`icon '${icon.id}' has an invalid stroke width`);
      }
    }
    for (const layer of icon.layers ?? []) {
      requireWireId(layer.accent, `icon '${icon.id}' layer accent`);
      if (!ids.has(layer.assetRef)) {
        throw new Error(`icon '${icon.id}' uses missing layer asset '${layer.assetRef}'`);
      }
    }
  }
  return icons;
}

function validateTheme(theme: PortableThemeSpec): void {
  requireWireId(theme.id, "theme");
  requireUnique(theme.categories.map(({ id }) => id), `category in theme '${theme.id}'`);
  requireUnique(theme.ramps.map(({ id }) => id), `ramp in theme '${theme.id}'`);
  for (const category of theme.categories) {
    requireWireId(category.id, `category in theme '${theme.id}'`);
    requireHex(category.hex, `category '${category.id}'`);
  }
  Object.entries({ ...theme.chrome, ...theme.neutrals, ...theme.status })
    .forEach(([id, value]) => requireHex(value, `theme token '${id}'`));
  for (const ramp of theme.ramps) {
    requireWireId(ramp.id, `ramp in theme '${theme.id}'`);
    if (ramp.unit.trim() === "" || ramp.bands.length === 0) {
      throw new Error(`ramp '${ramp.id}' is incomplete`);
    }
    requireUnique(ramp.bands.map(({ id }) => id), `band in ramp '${ramp.id}'`);
    ramp.bands.forEach((band, index) => {
      requireWireId(band.id, `band in ramp '${ramp.id}'`);
      if (index > 0 && band.upTo <= ramp.bands[index - 1]!.upTo) {
        throw new Error(`ramp '${ramp.id}' band '${band.id}' does not advance`);
      }
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
