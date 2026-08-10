/**
 * Which control owns which clock hour on a round face.
 *
 * The hour vocabulary is CircleKit's and reaches this grammar through the
 * product, so it is a parameter. What the grammar knows is the SHAPE: escape,
 * paging, the item run and the rail, each a position rather than a count.
 */
export interface WatchChromeSlotDeclaration<HourRef extends string = string> {
  /** Escape. Present at every level, on every page. */
  readonly back: HourRef;
  /** Forward one page. Rendered only when a further page exists. */
  readonly next: HourRef;
  /** Back one page. Rendered only once paged away from the first. */
  readonly previous: HourRef;
  /**
   * Where the page's items land, in fill order. Declared as a run so the
   * first item's hour and the item count cannot disagree.
   */
  readonly items: readonly HourRef[];
  /**
   * Shell rail buttons (MODE first), mounted by surfaces that have a rail.
   * A surface with a rail has no pager, which is why these may share hours
   * with paging controls — see the co-render sets below.
   */
  readonly rail: readonly HourRef[];
  /**
   * The one data-status slot: a glyph that appears only when what a surface
   * fetched does not match what its settings promised.
   *
   * A position, not a button run — one slot, because a face that can report
   * two problems at once reports neither. It co-renders with everything, so
   * the collision check treats it as always present.
   */
  readonly status: HourRef;
  /** Why this arrangement, in one sentence per moved control. */
  readonly reason: string;
}
