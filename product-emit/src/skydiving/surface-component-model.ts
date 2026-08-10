/**
 * A declared surface: which screen, what kind of data it shows, and whether it
 * is a debug-only route.
 *
 * The data-surface and spatial-mode vocabularies belong to the product, so they
 * are parameters. A product's route ids are already plain strings here — the
 * narrow route union is DERIVED from the product's own surface table, so this
 * type is where that union is born rather than something it consumes.
 */
interface SurfaceComponentBase<
  DataSurfaceRef extends string = string,
  SpatialModeRef extends string = string,
> {
  readonly screen: string;
  readonly dataSurface: DataSurfaceRef;
  readonly spatialMode: SpatialModeRef | null;
  readonly roundBackChrome: boolean;
}

/** Debug-only routes are explicit native families; production routes stay portable. */
export type SurfaceComponent<
  DataSurfaceRef extends string = string,
  SpatialModeRef extends string = string,
> = SurfaceComponentBase<DataSurfaceRef, SpatialModeRef> & (
  | { readonly debugOnly: false; readonly componentFamilyPolicy: "portable" }
  | { readonly debugOnly: true; readonly componentFamilyPolicy: "native-only" }
);
