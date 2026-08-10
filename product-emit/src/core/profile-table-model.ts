/**
 * A profile table: a small set of named rows (low/medium/high) over a fixed,
 * ordered set of fields.
 *
 * The shape exists because a hand-written table has no way to say what it is.
 * Nothing stops a row from missing a field, gaining an extra one, or drifting
 * out of the order the reviewer reads it in — and none of those show up as an
 * error, only as behaviour. Declaring the presets and the fields as ORDERED
 * ARRAYS is what makes completeness derivable: the validator iterates them and
 * the rows answer per element, so a missing preset is a refusal rather than a
 * shorter table.
 */

/**
 * The profile-table grammar's contract number, stamped into every module this
 * kind emits.
 *
 * Separate from APP_SPEC_VERSION on purpose: that one is set by compileSettings
 * and compileInteractions and versions the settings and interaction IR, so a
 * consumer of THIS kind gating on it would be watching a number that never moves
 * for reasons that concern them. A checksum on the tarball catches every change
 * but cannot say which; this says exactly which.
 *
 * Bump when a declaration that was legal stops being legal, or when emitted
 * output changes shape. Adding an optional field that older declarations may
 * omit is not a bump.
 */
export const PROFILE_TABLE_SPEC_VERSION = 1 as const;

export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

/**
 * How a field's value is written and what decides whether it is legal.
 *
 * A range and a guard are the same question asked twice, so a field carries one
 * or the other and the type makes the pair unrepresentable. `range` is a rule
 * this grammar understands and checks at authoring time; `guard` names a rule
 * the CONSUMER already owns and keeps owning — the declaration never restates
 * its content, it only says which function decides.
 */
export type ProfileFieldValue =
  | { readonly kind: "number"; readonly range?: NumberRange }
  | { readonly kind: "guarded-number"; readonly guard: string }
  | { readonly kind: "ref"; readonly member: ProfileRefMember };

/**
 * `none` emits the symbol itself; `per-preset` appends the row's own name, so
 * one declaration produces `.low`, `.medium` and `.high` without repeating the
 * symbol three times.
 */
export type ProfileRefMember = "none" | "per-preset";

export interface ProfileTableField {
  readonly name: string;
  readonly required: boolean;
  readonly value: ProfileFieldValue;
}

/**
 * One row. `notes` is keyed by field name because provenance belongs to a CELL,
 * not to a column: the measurement that explains why one preset holds a value
 * usually says nothing about the others, and hoisting it to the field would
 * print it above rows it does not describe.
 */
export interface ProfileTableRow {
  readonly values: Readonly<Record<string, number | string>>;
  readonly notes?: Readonly<Record<string, string>>;
}

export interface ProfileTableDeclaration {
  /** The emitted binding name, e.g. `WORLD_DETAIL_PROFILES`. */
  readonly symbol: string;
  /** Row names, in emitted order. */
  readonly presets: readonly string[];
  /** Columns, in emitted order — the order is part of the review surface. */
  readonly fields: readonly ProfileTableField[];
  readonly rows: Readonly<Record<string, ProfileTableRow>>;
}

/**
 * What the consumer lends the grammar so a `ref` can be proved and imported.
 *
 * `values` is for proof only: the validator looks a symbol up to confirm it
 * exists and, for a per-preset ref, that it really has that member. The emitted
 * file never contains the VALUE — it contains the symbol expression, because a
 * structural copy of a shared sub-table would create a second object and quietly
 * break the identity the consumer depends on.
 *
 * `sources` is where each emitted symbol comes from, guards included. Only the
 * consumer knows that; an emitter that guessed a module path would be deciding
 * the product's file layout on its behalf.
 */
export interface ProfileTableSymbolRegistry {
  readonly values: Readonly<Record<string, unknown>>;
  readonly sources: Readonly<Record<string, string>>;
}
