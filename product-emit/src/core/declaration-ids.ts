/**
 * The id shapes this DSL has, and what each one is FOR.
 *
 * The charset was checked in exactly one place — menu ids and menu wire ids —
 * so every other declaration kind could name itself however it liked. Not one
 * rule was missing from the others, though: measured against the real ids,
 * there are THREE shapes, and forcing them into one would rename live symbols.
 *
 * Naming them is the point. An id whose shape is unstated gets validated by
 * whatever emitter happens to consume it first, which is how a charset rule
 * ends up living in the menu validator.
 */

/**
 * A wire id: lower kebab, optionally dot-namespaced.
 *
 * `power-settings`, `dial.direction`, `map.layer.cliffs`. This is what a
 * declaration calls itself, and what crosses to Kotlin as a string. Kotlin
 * names are DERIVED from it (kotlin-syntax.ts), so the separators are what
 * make the derivation total: a character outside this set silently becomes
 * `_` in an enum token and disappears from an identifier.
 */
const WIRE_ID = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/u;

/**
 * A reference to a hand-written Kotlin enum entry: `CLOUD_3D`, `HOUR_10`.
 *
 * Deliberately NOT a wire id. A surface's `screen` is spelled the way Kotlin
 * spells it precisely so a reader can see the binding without a lookup, and
 * nothing derives it — it is emitted verbatim into `Screen.CLOUD_3D`. Holding
 * it to the wire-id charset would be renaming the native API to satisfy a rule
 * about declarations.
 */
const NATIVE_ENUM_REF = /^[A-Z][A-Z0-9_]*$/u;

/**
 * A persisted storage key: `altitudeDialDirection`.
 *
 * camelCase because that is what is already written to the device. `_` is
 * permitted for one shipped key (`freefall_time`,
 * log-entry-elements.ts:62) whose value sits in users' preferences: renaming
 * it is a data migration, not a cleanup, so the rule records the exception
 * rather than pretending the estate is uniform.
 */
const STORAGE_KEY = /^[a-z][A-Za-z0-9_]*$/u;

export interface IdRef {
  readonly id: string;
  /** What is being named, for the message: `setting`, `component`, … */
  readonly subject: string;
}

/** Every id kind a product declares, grouped by the shape it must satisfy. */
export interface DeclarationIdGroups {
  readonly wireIds: readonly IdRef[];
  readonly nativeEnumRefs: readonly IdRef[];
  readonly storageKeys: readonly IdRef[];
}

const RULES: Readonly<Record<keyof DeclarationIdGroups, { readonly pattern: RegExp; readonly shape: string }>> = {
  wireIds: { pattern: WIRE_ID, shape: "a wire id (lower kebab, optionally dot-namespaced)" },
  nativeEnumRefs: { pattern: NATIVE_ENUM_REF, shape: "a native enum ref (SCREAMING_SNAKE)" },
  storageKeys: { pattern: STORAGE_KEY, shape: "a storage key (camelCase)" },
};

/**
 * Runs ONCE in the pipeline, before any emitter.
 *
 * An empty group is a failure rather than a pass: a group falls empty when the
 * wiring that fills it is removed, and a validator that reports success for
 * checking nothing is worse than no validator, because it also reports
 * coverage.
 */
export function validateDeclarationIds(groups: DeclarationIdGroups): void {
  for (const [name, rule] of Object.entries(RULES) as [keyof DeclarationIdGroups, typeof RULES[keyof DeclarationIdGroups]][]) {
    const refs = groups[name];
    if (refs.length === 0) throw new Error(`declaration id group '${name}' is empty — nothing is being checked`);
    for (const { id, subject } of refs) {
      if (!rule.pattern.test(id)) throw new Error(`${subject} '${id}' is not ${rule.shape}`);
    }
  }
}

/** Convenience for the common case: one collection, one subject. */
export function idRefs(subject: string, ids: Iterable<string>): IdRef[] {
  return [...ids].map((id) => ({ id, subject }));
}
