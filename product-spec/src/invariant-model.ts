/**
 * One product statement that must stay true.
 *
 * An invariant is not a comment. A statement claiming machine enforcement must
 * name the artifact that holds it, and the compiler verifies that artifact is
 * really there. A statement no machine holds yet says so out loud with its
 * reason, so it stays reviewable instead of quietly decaying into a wish.
 *
 * The three forms are separate types on purpose: an enforced invariant with no
 * artifact, or an unenforced one with no reason, cannot be written.
 *
 * Prefer [ConstraintHeldInvariant]. A constraint makes the violation
 * unrepresentable — a theme that redefines band limits cannot be generated, an
 * action atom without its label cannot compile — which is strictly stronger
 * than a test that notices afterwards. Reach for a test only where no
 * constraint can carry the statement.
 */
export type InvariantSpec =
  | ConstraintHeldInvariant
  | TestHeldInvariant
  | DesignHeldInvariant;

/**
 * A statement the code cannot violate and still build.
 *
 * [site] names where the constraint lives and [token] is the text that carries
 * it. Both are verified: a refactor that deletes the guard turns the claim into
 * a diagnostic instead of leaving a rule that reads as enforced by nothing.
 */
export interface ConstraintHeldInvariant {
  readonly id: string;
  readonly statement: string;
  readonly enforcement: "constraint";
  /** Repo-relative file carrying the constraint. */
  readonly site: string;
  /** The exact text at [site] that enforces it. Verified to still be present. */
  readonly token: string;
}

/** A statement no constraint can carry, held by a test that already exists. */
export interface TestHeldInvariant {
  readonly id: string;
  readonly statement: string;
  readonly enforcement: "native-test";
  /** Repo-relative path to the test that fails when the statement stops holding. */
  readonly test: string;
  /** Why a constraint cannot carry this — keeps the weaker form deliberate. */
  readonly whyNotAConstraint: string;
}

/** A statement no machine holds yet. Acknowledged, never silent. */
export interface DesignHeldInvariant {
  readonly id: string;
  readonly statement: string;
  readonly enforcement: "design";
  /** Why no machine holds this yet, and what would have to exist for one to. */
  readonly unenforcedReason: string;
}

/** The repo-relative artifact whose presence backs the claim, if any. */
export function enforcingArtifact(invariant: InvariantSpec): string | undefined {
  switch (invariant.enforcement) {
    case "constraint":
      return invariant.site;
    case "native-test":
      return invariant.test;
    case "design":
      return undefined;
  }
}
