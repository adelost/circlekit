import { MENU_LABEL_MAX_CHARS, SURFACE_SUMMARY_MAX_CHARS } from "./menu-text-budget.js";

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
  /**
   * What the page calls itself on its own header. Display copy, not a wire
   * name: uppercase display grammar, and no single word longer than
   * {@link MENU_LABEL_MAX_CHARS} because a word past that breaks mid-word on
   * the round face instead of shrinking. Declared here so a host reads the
   * title instead of restating it (the "SETTINGS"/"Skyvw Log" literals were
   * exactly this field missing).
   */
  readonly title: string;
  /**
   * One line saying what the page is for. Any menu row that links to this
   * surface inherits it as the row's inline sub, so the copy lives with the
   * page it describes instead of being re-written at every door.
   * Budget: {@link SURFACE_SUMMARY_MAX_CHARS}.
   */
  readonly summary: string;
  /**
   * The one line the page shows when it has nothing to show — "NO JUMPS
   * INDEXED YET", "LONG-PRESS TO PIN". Null is a statement, not an omission:
   * this declaration carries no STATIC empty line — either the page cannot
   * be empty, or its empty copy is state-dependent and owned by its state
   * authority (the flight log's reason-based empty state is the shipped
   * example). A host hand-writing a STATIC line for a null surface is
   * restating copy that belongs here.
   * Same glass as the summary: display grammar, {@link MENU_LABEL_MAX_CHARS}
   * word cap, {@link SURFACE_SUMMARY_MAX_CHARS} budget.
   */
  readonly emptyState: string | null;
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

/** Uppercase display grammar: letters, digits, and the separators titles ship. */
const TITLE_GRAMMAR = /^[A-Z0-9][A-Z0-9 ·+\-/']*$/u;

/**
 * Refuse bad surface copy at the declaration (D4), never downstream.
 * The word cap reuses the measured round-face law: a single word longer than
 * {@link MENU_LABEL_MAX_CHARS} breaks mid-word rather than shrinking, and a
 * page title is subject to the same glass as a row label.
 */
export function validateSurfaceCopy(surfaces: readonly SurfaceComponent[]): void {
  for (const surface of surfaces) {
    const where = `surface '${surface.screen}'`;
    if (surface.title.trim().length === 0) throw new Error(`${where} has a blank title`);
    if (!TITLE_GRAMMAR.test(surface.title)) {
      throw new Error(`${where} title '${surface.title}' is not uppercase display grammar`);
    }
    for (const word of surface.title.split(" ")) {
      if (word.length > MENU_LABEL_MAX_CHARS) {
        throw new Error(
          `${where} title word '${word}' is ${word.length} chars; ` +
            `a word past ${MENU_LABEL_MAX_CHARS} breaks mid-word on the round face`,
        );
      }
    }
    if (surface.summary.trim().length === 0) throw new Error(`${where} has a blank summary`);
    if (surface.summary.length > SURFACE_SUMMARY_MAX_CHARS) {
      throw new Error(
        `${where} summary is ${surface.summary.length} chars; ` +
          `the inline-sub budget is ${SURFACE_SUMMARY_MAX_CHARS}`,
      );
    }
    if (surface.emptyState !== null) {
      if (surface.emptyState.trim().length === 0) {
        throw new Error(`${where} empty-state is blank; declare null when no static empty line exists`);
      }
      if (!TITLE_GRAMMAR.test(surface.emptyState)) {
        throw new Error(`${where} empty-state '${surface.emptyState}' is not uppercase display grammar`);
      }
      for (const word of surface.emptyState.split(" ")) {
        if (word.length > MENU_LABEL_MAX_CHARS) {
          throw new Error(
            `${where} empty-state word '${word}' is ${word.length} chars; ` +
              `a word past ${MENU_LABEL_MAX_CHARS} breaks mid-word on the round face`,
          );
        }
      }
      if (surface.emptyState.length > SURFACE_SUMMARY_MAX_CHARS) {
        throw new Error(
          `${where} empty-state is ${surface.emptyState.length} chars; ` +
            `the one-line budget is ${SURFACE_SUMMARY_MAX_CHARS}`,
        );
      }
    }
  }
}
