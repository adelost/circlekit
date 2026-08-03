export const PORTABLE_SURFACE_CLASSES = ["round", "compact", "wide"] as const;

export type PortableSurfaceClass = (typeof PORTABLE_SURFACE_CLASSES)[number];
export type ComponentRequirement =
  | { readonly kind: "required" }
  | { readonly kind: "optional"; readonly fallback: "omit" };

export interface ComponentSpec<Id extends string = string> {
  readonly id: Id;
}

export interface ComponentMount<ComponentId extends string = string> {
  readonly id: string;
  readonly component: ComponentId;
  readonly region: string;
  readonly order: number;
  readonly priority: number;
  readonly capacity: number | null;
  readonly requirement: ComponentRequirement;
}

export interface ComponentMountDeclaration<ComponentId extends string = string> {
  readonly component: ComponentId;
  readonly region: string;
  readonly instance?: string;
  readonly priority?: number;
  readonly capacity?: number;
  readonly requirement?: ComponentRequirement;
}

export interface SurfaceComponentTree<ComponentId extends string = string> {
  readonly surface: PortableSurfaceClass;
  readonly mounts: readonly ComponentMount<ComponentId>[];
}

export interface SurfaceFamily<ComponentId extends string = string> {
  readonly id: string;
  readonly trees: readonly SurfaceComponentTree<ComponentId>[];
}

export interface SurfaceFamilyDeclaration<ComponentId extends string = string> {
  readonly id: string;
  readonly trees: readonly {
    readonly surface: PortableSurfaceClass;
    readonly mounts: readonly ComponentMountDeclaration<ComponentId>[];
  }[];
}

export interface ScreenComponentFamilyRef<
  ScreenRef extends string = string,
  Family extends SurfaceFamily = SurfaceFamily,
> {
  readonly screen: ScreenRef;
  readonly family: Family;
}

export function defineComponentCatalog<const Specs extends readonly ComponentSpec[]>(specs: Specs): Specs {
  requireUnique(specs.map(({ id }) => id), "component id");
  specs.forEach(({ id }) => requireWireId(id, "component id"));
  return specs;
}

export function defineSurfaceFamily(
  catalog: readonly ComponentSpec[],
  family: SurfaceFamilyDeclaration,
): SurfaceFamily {
  requireWireId(family.id, "surface family id");
  requireUnique(family.trees.map(({ surface }) => surface), `${family.id} surface`);
  const surfaces = new Set(family.trees.map(({ surface }) => surface));
  if (surfaces.size !== PORTABLE_SURFACE_CLASSES.length ||
      PORTABLE_SURFACE_CLASSES.some((surface) => !surfaces.has(surface))) {
    throw new Error(`${family.id} must cover round, compact and wide exactly once`);
  }

  const componentIds = new Set(catalog.map(({ id }) => id));
  const trees = family.trees.map((tree) => ({
    surface: tree.surface,
    mounts: tree.mounts.map((mount, order) => ({
      id: mount.instance ?? mount.component,
      component: mount.component,
      region: mount.region,
      order,
      priority: mount.priority ?? 0,
      capacity: mount.capacity ?? null,
      requirement: mount.requirement ?? { kind: "required" as const },
    })),
  }));
  for (const tree of trees) {
    requireUnique(tree.mounts.map(({ id }) => id), `${family.id}/${tree.surface} mount id`);
    requireUnique(
      tree.mounts.map(({ region, order }) => `${region}:${order}`),
      `${family.id}/${tree.surface} region order`,
    );
    for (const item of tree.mounts) {
      requireWireId(item.id, `${family.id}/${tree.surface} mount id`);
      requireWireId(item.region, `${family.id}/${tree.surface} region`);
      if (!componentIds.has(item.component)) {
        throw new Error(`${family.id}/${tree.surface} uses unknown component '${item.component}'`);
      }
      if (!Number.isSafeInteger(item.order) || item.order < 0) {
        throw new Error(`${family.id}/${tree.surface}/${item.id} has invalid order`);
      }
      if (!Number.isSafeInteger(item.priority) || item.priority < 0) {
        throw new Error(`${family.id}/${tree.surface}/${item.id} has invalid priority`);
      }
      if (item.capacity !== null && (!Number.isSafeInteger(item.capacity) || item.capacity < 1)) {
        throw new Error(`${family.id}/${tree.surface}/${item.id} has invalid capacity`);
      }
      if (item.requirement.kind === "optional" && item.requirement.fallback !== "omit") {
        throw new Error(`${family.id}/${tree.surface}/${item.id} has no explicit optional fallback`);
      }
    }
  }
  return { id: family.id, trees };
}

/** One product route owns at most one portable component family. */
export function defineScreenComponentFamilyRegistry<ScreenRef extends string>(
  entries: readonly {
    readonly screen: ScreenRef;
    readonly family: SurfaceFamilyDeclaration;
  }[],
): readonly ScreenComponentFamilyRef<ScreenRef>[] {
  requireUnique(entries.map(({ screen }) => screen), "component-family screen");
  requireUnique(entries.map(({ family }) => family.id), "component-family ref");
  const componentIds = [...new Set(entries.flatMap(({ family }) =>
    family.trees.flatMap(({ mounts }) => mounts.map(({ component }) => component))
  ))];
  const catalog = componentIds.map((id) => ({ id }));
  return entries.map(({ screen, family }) => ({
    screen,
    family: defineSurfaceFamily(catalog, family),
  }));
}

function requireWireId(value: string, owner: string): void {
  if (!/^[a-z][a-z0-9.-]*$/u.test(value)) throw new Error(`${owner} has invalid wire id '${value}'`);
}

function requireUnique(values: readonly string[], owner: string): void {
  if (new Set(values).size !== values.length) throw new Error(`duplicate ${owner}`);
}
