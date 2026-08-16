/**
 * A status indicator, as grammar.
 *
 * A status indicator is anything a surface says about ITSELF rather than about
 * the world it is measuring: that it is recording, that the battery is low,
 * that a lock is about to re-engage, that a sensor stopped answering. The
 * instruments say what the sky is doing; these say what the app is doing.
 *
 * The seat vocabulary ("CLOCK", "DEVICE") is the product's, so it is a
 * parameter rather than a literal — the same inversion the home-action grammar
 * ended. An emitter that only ever reads `seat` as a string has no business
 * knowing which seats one product's face happens to have.
 *
 * WHAT IS DECLARED HERE is placement and precedence: which indicators exist,
 * which seat each one occupies, who wins when two want the same seat, and
 * whether the indicator has a second level of detail at all.
 *
 * WHAT IS NOT is anything that depends on live state: whether an indicator is
 * currently visible, what it currently reads, or which colour its severity has
 * reached. Placement never depends on those, and a grammar that tried to hold
 * them would be a second copy of the runtime.
 */
export interface StatusIndicatorDeclaration<SeatRef extends string = string> {
  /** Matches StatusIndicatorId in Kotlin exactly; parity is asserted at startup. */
  readonly id: string;
  /**
   * The fixed place this indicator renders in when it renders at all.
   *
   * A seat, not a coordinate. Hand-picked offsets are how two indicators came
   * to share one position on a product surface with neither of them able to
   * know it: independent coordinate offsets let both draw through each other.
   */
  readonly seat: SeatRef;
  /**
   * Who wins when two indicators in one seat are visible at the same moment.
   *
   * Higher wins. Priorities must be unique within a seat — see the emitter.
   * Without that rule the winner would depend on declaration order, which is
   * exactly the kind of answer that is right until somebody reorders a list.
   */
  readonly priority: number;
  /**
   * Whether this indicator has a detail level beyond its glance form.
   *
   * GLANCE_ONLY is the whole indicator. ON_REVEAL means it has more to say
   * when asked, and the HOST binds the asking — a round face has a tilt, a
   * phone has a tap. Declaring the disclosure without declaring the gesture is
   * deliberate: the same indicator must not require a wrist flick on hardware
   * that has no wrist.
   */
  readonly disclosure: StatusDisclosure;
  /** Why this indicator sits where it does. A position without a reason drifts. */
  readonly reason: string;
}

/**
 * The two levels an indicator can speak at.
 *
 * A closed vocabulary of the grammar rather than of any product, so both
 * members always cross over to native — a consumer's exhaustive branch should
 * break when a new level is added, not when a product happens to start using
 * one it had declared all along.
 */
export type StatusDisclosure = "GLANCE_ONLY" | "ON_REVEAL";

/** Every disclosure level, in the order native emits them. */
export const STATUS_DISCLOSURES: readonly StatusDisclosure[] = ["GLANCE_ONLY", "ON_REVEAL"];
