import { frozen } from "./frozen.js";
import { requireIdentifier } from "./node-model.js";
import { rememberCallsite } from "./source-site.js";

/**
 * A stored value: something a product saves under a name, with no settings row of its own. Its kind fixes the type a
 * device holds; its laws run once, when it is declared, so a range that cannot hold its default never reaches a device.
 * Platform-neutral: an emitter projects the declaration into a native descriptor and a typed record with its codec.
 */

/** The type a device holds under a saved name. A different type under a name a device holds fails that read. */
export type StoredType = "boolean" | "int" | "long" | "float" | "string";

interface StoredBase<Store extends string> {
  readonly id: string;
  /** The key a device saves the value under. */
  readonly wireName: string;
  /** Which store owns the saved value. Stated: an implicit default silently decides where a value lives. */
  readonly store: Store;
  /** The native property; the wire name when absent. Never added to the declaration, so it serializes as written. */
  readonly property?: string;
}

/** An optional value reads as absent until something saves it, so it states no default. */
type DefaultOrOptional =
  | { readonly optional: true; readonly defaultValue?: never }
  | { readonly optional?: false; readonly defaultValue: number };

export type StoredFlagSpec<Store extends string = string> = StoredBase<Store> & { readonly defaultValue: boolean };
/** A whole number in an Int, clamped to min..max wherever it is read or written; its editor moves by step. */
export type StoredIntSpec<Store extends string = string> = StoredBase<Store> & {
  readonly unit?: string; readonly min: number; readonly max: number; readonly step: number; readonly defaultValue: number;
};
export type StoredLongSpec<Store extends string = string> = StoredBase<Store> & {
  readonly unit?: string; readonly min?: number; readonly max?: number;
} & DefaultOrOptional;
/** A float; a bound that is stated clamps a defaulted value and turns an optional one outside it into absent. */
export type StoredNumberSpec<Store extends string = string> = StoredBase<Store> & {
  readonly unit?: string; readonly min?: number; readonly max?: number; readonly step?: number;
} & DefaultOrOptional;
/** Saved by the choice's name; a name a device holds that is no longer a choice reads as the default. */
export type StoredChoiceSpec<Store extends string = string> = StoredBase<Store> & {
  readonly values: readonly string[]; readonly defaultValue: string;
};
export type StoredTextSpec<Store extends string = string> = StoredBase<Store> & { readonly defaultValue: string };

export type StoredFlagDeclaration<Store extends string = string> = StoredFlagSpec<Store> & { readonly kind: "stored-flag" };
export type StoredIntDeclaration<Store extends string = string> = StoredIntSpec<Store> & { readonly kind: "stored-int" };
export type StoredLongDeclaration<Store extends string = string> = StoredLongSpec<Store> & { readonly kind: "stored-long" };
export type StoredNumberDeclaration<Store extends string = string> = StoredNumberSpec<Store> & { readonly kind: "stored-number" };
export type StoredChoiceDeclaration<Store extends string = string> = StoredChoiceSpec<Store> & { readonly kind: "stored-choice" };
export type StoredTextDeclaration<Store extends string = string> = StoredTextSpec<Store> & { readonly kind: "stored-text" };

export type StoredValueDeclaration<Store extends string = string> =
  | StoredFlagDeclaration<Store> | StoredIntDeclaration<Store> | StoredLongDeclaration<Store>
  | StoredNumberDeclaration<Store> | StoredChoiceDeclaration<Store> | StoredTextDeclaration<Store>;

const STORED_TYPES: { readonly [Kind in StoredValueDeclaration["kind"]]: StoredType } = {
  "stored-flag": "boolean", "stored-int": "int", "stored-long": "long",
  "stored-number": "float", "stored-choice": "string", "stored-text": "string",
};
const INT_RANGE = { min: -2_147_483_648, max: 2_147_483_647 } as const;
const RANGE = ["min", "max", "step", "defaultValue"] as const;

export function storedTypeOf(value: StoredValueDeclaration): StoredType {
  if (!Object.hasOwn(STORED_TYPES, value.kind)) throw new Error(`stored value '${value.id}' has unknown kind '${String(value.kind)}'`);
  return STORED_TYPES[value.kind];
}

/** The native property a record holds the value in. */
export function storedPropertyOf(value: StoredValueDeclaration): string {
  return value.property ?? value.wireName;
}

export function storedFlag<const Spec extends StoredFlagSpec>(spec: Spec): Spec & { readonly kind: "stored-flag" } {
  return declared({ kind: "stored-flag", ...spec }, storedFlag);
}
export function storedInt<const Spec extends StoredIntSpec>(spec: Spec): Spec & { readonly kind: "stored-int" } {
  return declared({ kind: "stored-int", ...spec }, storedInt);
}
export function storedLong<const Spec extends StoredLongSpec>(spec: Spec): Spec & { readonly kind: "stored-long" } {
  return declared({ kind: "stored-long", ...spec }, storedLong);
}
export function storedNumber<const Spec extends StoredNumberSpec>(spec: Spec): Spec & { readonly kind: "stored-number" } {
  return declared({ kind: "stored-number", ...spec }, storedNumber);
}
export function storedChoice<const Spec extends StoredChoiceSpec>(spec: Spec): Spec & { readonly kind: "stored-choice" } {
  return declared({ kind: "stored-choice", ...spec }, storedChoice);
}
export function storedText<const Spec extends StoredTextSpec>(spec: Spec): Spec & { readonly kind: "stored-text" } {
  return declared({ kind: "stored-text", ...spec }, storedText);
}

/**
 * A product's stored values as one list. Two values, or a value and a setting (`alsoSaved`), saved under one key would
 * read each other's bytes, and two values of one store in one native property would overwrite each other. Every value's
 * own laws run again, so a copy edited after it was declared cannot slip in.
 */
export function storedValueCatalog<Value extends StoredValueDeclaration>(
  values: readonly Value[],
  alsoSaved: readonly { readonly id: string; readonly wireName: string }[] = [],
): readonly Value[] {
  const ids = new Set<string>();
  const wireOwners = new Map(alsoSaved.map(({ id, wireName }) => [wireName, id]));
  const propertyOwners = new Map<string, string>();
  for (const value of values) {
    requireStoredValue(value);
    const { id, wireName, store } = value;
    if (ids.has(id)) throw new Error(`stored value '${id}' is declared twice`);
    ids.add(id);
    const wireOwner = wireOwners.get(wireName);
    if (wireOwner !== undefined) throw new Error(`stored value '${id}' reuses wire name '${wireName}', already saved by '${wireOwner}'`);
    wireOwners.set(wireName, id);
    const property = storedPropertyOf(value);
    const propertyKey = JSON.stringify([store, property]);
    const propertyOwner = propertyOwners.get(propertyKey);
    if (propertyOwner !== undefined) {
      throw new Error(`stored value '${id}' reuses property '${property}' in store '${store}', already used by '${propertyOwner}'`);
    }
    propertyOwners.set(propertyKey, id);
  }
  return frozen([...values]);
}

function declared<Value extends object>(value: Value, owner: Function): Value {
  requireStoredValue(value as unknown as StoredValueDeclaration);
  return frozen(rememberCallsite(value, owner));
}

function requireStoredValue(value: StoredValueDeclaration): void {
  const { id } = value;
  storedTypeOf(value);
  const property = storedPropertyOf(value);
  try {
    requireIdentifier(property, "stored value property");
  } catch {
    throw new Error(`stored value '${id}': property '${property}' is not an identifier`);
  }
  switch (value.kind) {
    case "stored-flag":
      if (typeof value.defaultValue !== "boolean") throw new Error(`stored value '${id}': default must be true or false`);
      return;
    case "stored-text":
      if (typeof value.defaultValue !== "string") throw new Error(`stored value '${id}': default must be text`);
      return;
    case "stored-choice":
      return requireChoices(value);
    case "stored-int":
      requireNumbers(value, RANGE, true, Number.isSafeInteger, "be whole numbers");
      requireNumbers(value, RANGE, true, (number) => number >= INT_RANGE.min && number <= INT_RANGE.max,
        `fit an Int, ${INT_RANGE.min}..${INT_RANGE.max}: a wider value is a storedLong`);
      return requireRange(value);
    case "stored-long":
      requireDefaultOrOptional(value);
      requireNumbers(value, ["min", "max", "defaultValue"], false, Number.isSafeInteger, "be whole numbers");
      return requireRange(value);
    case "stored-number":
      requireDefaultOrOptional(value);
      requireNumbers(value, RANGE, false, isFiniteFloat, "be finite numbers");
      return requireRange(value);
  }
}

function requireChoices({ id, values, defaultValue }: StoredChoiceDeclaration): void {
  const twice = values.find((choice, index) => values.indexOf(choice) !== index);
  if (twice !== undefined) throw new Error(`stored value '${id}': choice '${twice}' is listed twice`);
  if (!values.includes(defaultValue)) {
    throw new Error(`stored value '${id}': default '${defaultValue}' is not one of its choices ${values.join(", ")}`);
  }
}

function requireDefaultOrOptional({ id, optional, defaultValue }: StoredLongDeclaration | StoredNumberDeclaration): void {
  if (optional === true && defaultValue !== undefined) {
    throw new Error(`stored value '${id}' is optional and states a default: an optional value reads as absent until something saves it`);
  }
  if (optional !== true && defaultValue === undefined) throw new Error(`stored value '${id}' needs a default or optional: true`);
}

function requireRange(value: StoredIntDeclaration | StoredLongDeclaration | StoredNumberDeclaration): void {
  const { id, min, max, defaultValue } = value;
  const step = "step" in value ? value.step : undefined;
  if (step !== undefined && !(step > 0)) throw new Error(`stored value '${id}': step ${step} must be above zero`);
  if (min !== undefined && max !== undefined && min > max) throw new Error(`stored value '${id}': min ${min} is above max ${max}`);
  if (defaultValue !== undefined && (min !== undefined && defaultValue < min || max !== undefined && defaultValue > max)) {
    throw new Error(`stored value '${id}': default ${defaultValue} is outside ${min ?? ""}..${max ?? ""}`);
  }
}

/** Refuses each named number the rule does not accept; an absent one counts only where the kind requires it. */
function requireNumbers(value: StoredValueDeclaration, names: readonly string[], required: boolean,
  accepts: (number: number) => boolean, must: string): void {
  const numbers = value as unknown as Readonly<Record<string, unknown>>;
  const refused = names.filter((name) => (required || numbers[name] !== undefined)
    && (typeof numbers[name] !== "number" || !accepts(numbers[name])));
  if (refused.length > 0) throw new Error(`stored value '${value.id}': ${refused.join(", ")} must ${must}`);
}

/** A device holds a 32-bit float: a finite double past its range would be saved as infinity. */
const isFiniteFloat = (value: number): boolean => Number.isFinite(Math.fround(value));
