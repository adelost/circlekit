/**
 * A home surface tile, as grammar.
 *
 * The group vocabulary ("FLIGHT", "TOOLS") is the product's, so it is a
 * parameter rather than a literal. Foundation importing the product's union was
 * the inversion this ends: an emitter that only ever reads `group` as a string
 * had no business knowing which groups one product happens to have.
 */
export interface HomeActionDeclaration<GroupRef extends string = string> {
  /** Matches HomeActionId in Kotlin exactly; parity is asserted at startup. */
  readonly id: string;
  readonly group: GroupRef;
  /** Why this tile sits where it does. A position without a reason drifts. */
  readonly reason: string;
}
